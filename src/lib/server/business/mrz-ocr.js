import { parseTD3, repairByPosition, MrzError } from '$lib/server/business/mrz.js';

/**
 * Server-side OCR pipeline for the passport MRZ.
 *
 * The critical design constraint (rule 1): the browser never reads the MRZ.
 * Only this server code path may derive passport identity data, and it only
 * accepts a result after every MRZ check digit passes (parseTD3 throws
 * otherwise). Nothing the user types can reach the protected columns.
 *
 * OCR is deliberately separated from the MRZ *decoder* (mrz.js), which is the
 * part with full automated coverage. The OCR front-end uses Tesseract (a
 * local WASM engine, no network at runtime) and needs an OCR-B-trained model
 * committed under TESSDATA_PATH to be accurate; generic English models are
 * poor at the OCR-B font that the standard mandates.
 */

function stripToMrzChars(raw) {
  return raw.toUpperCase().replace(/[^A-Z0-9<]/g, '<');
}

/**
 * Pick the two most MRZ-like lines from raw OCR output. MRZ line 1 starts
 * with "P" and both lines are exactly 44 chars; OCR text is often noisy so we
 * score candidates rather than require an exact match.
 */
export function pickMrzLines(rawText) {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => stripToMrzChars(l).replace(/<+$/g, ''))
    .filter((l) => l.length >= 30);

  const scored = lines.map((l) => {
    let score = 0;
    if (l.startsWith('P')) score += 3;
    if (l.includes('<<')) score += 2;
    if (/[0-9]{4,}/.test(l)) score += 2;
    score += Math.min(l.length, 44);
    return { l, score };
  });

  scored.sort((a, b) => b.score - a.score);
  if (scored.length < 2) {
    throw new MrzError(['No MRZ found in the document. The uploaded file may not be a passport data page.']);
  }
  const line1 = scored[0].l.slice(0, 44).padEnd(44, '<');
  const line2 = scored[1].l.slice(0, 44).padEnd(44, '<');
  return { line1, line2 };
}

/**
 * Pick the OCR engine at runtime. Default is the offline Tesseract engine;
 * set `OCR_PROVIDER=typhoon` to use the OpenTyphoon cloud OCR instead. Both
 * engines expose `runOcr(buffer, meta)` and return raw text, so the rest of
 * this pipeline is identical regardless of provider.
 */
async function runOcrForEngine(buffer, meta) {
  const provider = (process.env.OCR_PROVIDER || 'offline').toLowerCase();
  if (provider === 'typhoon' || provider === 'opentyphoon') {
    const { runOcr } = await import('$lib/server/business/ocr-typhoon.js');
    return runOcr(buffer, meta);
  }
  const { runOcr } = await import('$lib/server/business/ocr-engine.js');
  return runOcr(buffer);
}

/**
 * Run the full scan: OCR -> positional repair -> parse/verify. Throws on any
 * integrity failure, in which case the caller must delete the uploaded file.
 */
export async function scanPassportImage(buffer, meta = {}) {
  const raw = await runOcrForEngine(buffer, meta);
  const { line1, line2 } = pickMrzLines(raw);
  const repaired = repairByPosition(line1, line2);
  return parseTD3(repaired.line1, repaired.line2);
}

export { MrzError };
