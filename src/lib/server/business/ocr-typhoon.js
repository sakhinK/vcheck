/**
 * OpenTyphoon AI OCR engine (cloud).
 *
 * This is the *cloud* alternative to the offline Tesseract engine
 * (`ocr-engine.js`). Both expose the same `runOcr(buffer, meta)` contract so
 * the MRZ pipeline in `mrz-ocr.js` can swap engines purely by configuration.
 *
 * Select it with `OCR_PROVIDER=typhoon` and provide `OPENTYPHOON_API_KEY`.
 * When the provider is not selected the app keeps using the fully-offline
 * Tesseract path (no network at runtime), which remains the default.
 *
 * The endpoint contract (from the OpenTyphoon docs):
 *   POST /v1/ocr  (multipart/form-data)
 *     file, model, task_type, max_tokens, temperature, top_p,
 *     repetition_penalty, pages?
 *   -> { results: [{ success, filename, message, error }] }
 *   where `message.choices[0].message.content` is the OCR text (optionally a
 *   JSON object whose `natural_text` field carries the plain text).
 */

const DEFAULT_OCR_URL = 'https://api.opentyphoon.ai/v1/ocr';
const DEFAULT_MODEL = 'typhoon-ocr';

function readConfig() {
  const apiKey = process.env.OPENTYPHOON_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OPENTYPHOON_API_KEY is not set. Add it to the environment (or switch OCR_PROVIDER back to "offline").'
    );
  }
  return {
    apiKey,
    url: process.env.OPENTYPHOON_OCR_URL || DEFAULT_OCR_URL,
    model: process.env.OPENTYPHOON_OCR_MODEL || DEFAULT_MODEL,
    taskType: process.env.OPENTYPHOON_OCR_TASK_TYPE || 'default',
    maxTokens: Number(process.env.OPENTYPHOON_OCR_MAX_TOKENS || 16384),
    temperature: Number(process.env.OPENTYPHOON_OCR_TEMPERATURE || 0.1),
    topP: Number(process.env.OPENTYPHOON_OCR_TOP_P || 0.6),
    repetitionPenalty: Number(process.env.OPENTYPHOON_OCR_REPETITION_PENALTY || 1.2)
  };
}

/**
 * Parse the OpenTyphoon `/v1/ocr` response body into plain text.
 * Kept pure (no network) so the parsing rules are unit-testable.
 */
export function extractTextFromResponse(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('OpenTyphoon OCR returned an empty response.');
  }

  const pages = Array.isArray(result.results) ? result.results : [];
  const texts = [];
  const failures = [];

  for (const page of pages) {
    if (page && page.success) {
      let content = page?.message?.choices?.[0]?.message?.content ?? page?.text ?? '';
      if (content) {
        try {
          // Structured outputs sometimes wrap the text as JSON.
          const parsed = JSON.parse(content);
          content = parsed.natural_text || parsed.text || content;
        } catch {
          // Not JSON — use the raw text as-is.
        }
        texts.push(content);
      }
    } else if (page && page.success === false) {
      failures.push(`${page.filename || 'unknown page'}: ${page.error || 'Unknown error'}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`OpenTyphoon OCR failed — ${failures.join('; ')}`);
  }

  const text = texts.join('\n').trim();
  if (!text) {
    throw new Error('OpenTyphoon OCR returned no text.');
  }
  return text;
}

/**
 * Send a buffer (image or PDF) to the OpenTyphoon OCR endpoint and return the
 * joined plain text. Mirrors the reference `extractTextFromImage` client
 * example, adapted for Node (Buffer -> Blob -> FormData).
 */
export async function extractTextFromBuffer(
  buffer,
  { filename = 'upload.pdf', mimeType = 'application/octet-stream', pages = null } = {}
) {
  const cfg = readConfig();

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: mimeType }), filename);
  formData.append('model', cfg.model);
  formData.append('task_type', cfg.taskType);
  formData.append('max_tokens', String(cfg.maxTokens));
  formData.append('temperature', String(cfg.temperature));
  formData.append('top_p', String(cfg.topP));
  formData.append('repetition_penalty', String(cfg.repetitionPenalty));
  if (pages) {
    formData.append('pages', JSON.stringify(pages));
  }

  const response = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.apiKey}` },
    body: formData
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`OpenTyphoon OCR request failed (${response.status}): ${detail}`);
  }

  const result = await response.json();
  return extractTextFromResponse(result);
}

/**
 * Same signature as `ocr-engine.js`'s `runOcr` so the MRZ pipeline can swap
 * engines by configuration. `meta` may carry `{ filename, mimeType, pages }`.
 */
export async function runOcr(buffer, meta = {}) {
  return extractTextFromBuffer(buffer, meta);
}
