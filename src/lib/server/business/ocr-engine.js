/**
 * OCR engine (Tesseract + sharp). Fully offline at runtime: no CDN, no
 * external API. Tesseract is a local WASM worker; the trained data must be
 * committed under TESSDATA_PATH (an OCR-B-tuned model is strongly preferred
 * for the fixed-width OCR-B font the ICAO standard mandates).
 */

const MRZ_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

/** Crop the bottom ~22% (the MRZ band), grayscale, boost contrast, resize. */
export async function preprocessMrzBand(buffer) {
  const sharp = (await import('sharp')).default;
  const meta = await sharp(buffer).metadata();
  const width = meta.width || 2200;
  const height = meta.height || 1400;
  const bandHeight = Math.max(120, Math.floor(height * 0.22));
  return sharp(buffer)
    .extract({ left: 0, top: height - bandHeight, width, height: bandHeight })
    .greyscale()
    .normalize()
    .resize({ width: 2000 })
    .png()
    .toBuffer();
}

async function recognize(image) {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', 1, {
    workerPath: process.env.TESSERACT_WORKER_PATH || undefined,
    corePath: process.env.TESSERACT_CORE_PATH || undefined,
    langPath: process.env.TESSDATA_PATH || './tessdata'
  });
  try {
    await worker.setParameters({ tessedit_char_whitelist: MRZ_WHITELIST });
    const { data } = await worker.recognize(image);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

/** OCR a passport image, retrying with a wider crop then a 180° rotation. */
export async function runOcr(buffer) {
  const attempts = [];
  attempts.push(await preprocessMrzBand(buffer));

  // Wider crop fallback (whole lower half).
  const sharp = (await import('sharp')).default;
  const meta = await sharp(buffer).metadata();
  const height = meta.height || 1400;
  attempts.push(
    await sharp(buffer)
      .extract({ left: 0, top: Math.floor(height / 2), width: meta.width || 2200, height: height - Math.floor(height / 2) })
      .greyscale()
      .normalize()
      .resize({ width: 2000 })
      .png()
      .toBuffer()
  );
  // Rotated 180° fallback.
  attempts.push(await sharp(buffer).rotate(180).greyscale().normalize().resize({ width: 2000 }).png().toBuffer());

  for (const image of attempts) {
    const text = await recognize(image);
    if (/[A-Z0-9<]{30,}/.test(text)) return text;
  }

  // One last full-image attempt before giving up.
  return recognize(await sharp(buffer).greyscale().normalize().resize({ width: 2000 }).png().toBuffer());
}
