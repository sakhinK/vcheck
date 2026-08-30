/**
 * Machine Readable Zone (MRZ) decoding for ICAO Doc 9303 TD3 (passports).
 *
 * A passport is *always* a TD3 document. The MRZ is two fixed-width lines of
 * 44 characters each, printed in OCR-B. Allowed characters are A-Z, 0-9 and
 * the filler "<" only.
 *
 * Why this lives server-side and is so strict: the passport number, date of
 * birth, expiry date and nationality are identity data that MUST be derived
 * from a server-verified scan. A browser that sends these values could be
 * trivially fed arbitrary data, so nothing from a form is ever trusted.
 *
 * References:
 *  - ICAO Doc 9303-3 (TD3 layout / field positions)
 *  - ICAO Doc 9303-4 §4.2.2.2 (check digit algorithm)
 */

export const MRZ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
export const ALLOWED_MRZ_CHARS = new Set(MRZ_CHARS.split(''));

const CHAR_VALUES = (() => {
  const map = {};
  for (let i = 0; i < 26; i++) map[String.fromCharCode(65 + i)] = 10 + i;
  for (let i = 0; i < 10; i++) map[String(i)] = i;
  map['<'] = 0;
  return map;
})();

/** Numeric weight of a single MRZ character (0-9 -> 0-9, A-Z -> 10-35, < -> 0). */
export function charValue(ch) {
  const v = CHAR_VALUES[ch];
  if (v === undefined) {
    throw new Error(`Invalid MRZ character: "${ch}"`);
  }
  return v;
}

/**
 * ICAO 9303-4 §4.2.2.2 check digit: weights 7,3,1 repeating left-to-right,
 * sum products, take modulo 10.
 *
 * Specified test vectors:
 *   checkDigit('520727')    === '3'
 *   checkDigit('AB2134<<<') === '5'
 */
export function checkDigit(value) {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    sum += charValue(value[i]) * weights[i % 3];
  }
  return String(sum % 10);
}

/** MRZ uses two-digit years. Birth dates are always in the past, expiry dates
 * are roughly ten years ahead, so each needs a different century cutoff.
 * `now` is injectable for deterministic tests. */
export function resolveTwoDigitYear(yy, kind, now = new Date()) {
  const currentYear = now.getFullYear();
  const currentYY = currentYear % 100;
  if (kind === 'birth') {
    // Birth is always in the past: a two-digit year that resolves into the
    // future must belong to the previous century.
    return yy > currentYY ? 1900 + yy : 2000 + yy;
  }
  // Expiry: a passport is valid for roughly ten years, so the expiry date is
  // within [-10, +10] years of "now" (newly issued -> +10y, about to lapse
  // -> +0y, recently lapsed -> -1y). Choose the century that lands there.
  const base = 2000 + yy;
  if (base < currentYear - 10) return base + 100;
  if (base > currentYear + 10) return base - 100;
  return base;
}

/**
 * Parse a six-char YYMMDD field. Unknown components may be represented with
 * "<" and the check digit still passes (because "<" has value 0), so missing
 * date parts are *not* a read error — they are a "recorded incomplete date".
 */
export function parseDateField(field, kind, now = new Date()) {
  const complete = !field.includes('<');
  const yy = field.slice(0, 2);
  const mm = field.slice(2, 4);
  const dd = field.slice(4, 6);
  const year = yy.includes('<') ? null : resolveTwoDigitYear(parseInt(yy, 10), kind, now);
  const month = mm.includes('<') ? null : parseInt(mm, 10);
  const day = dd.includes('<') ? null : parseInt(dd, 10);
  let iso = null;
  if (year !== null && month !== null && day !== null) {
    iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return { year, month, day, iso, complete };
}

/**
 * Split the 39-char name field into primary and secondary identifiers.
 *
 * MRZ name encoding is lossy: "<<" separates primary from secondary
 * identifier, a single "<" separates components, hyphens become "<" and
 * apostrophes vanish. We therefore keep the two identifiers separate and in
 * MRZ order — never force "given-name surname" because which part is the
 * surname is culture-dependent.
 */
export function parseNameField(nameField) {
  const sep = nameField.indexOf('<<');
  const primaryRaw = sep === -1 ? nameField : nameField.slice(0, sep);
  const secondaryRaw = sep === -1 ? '' : nameField.slice(sep + 2);
  const primary = primaryRaw.split('<').filter(Boolean);
  const secondary = secondaryRaw.split('<').filter(Boolean);
  // The only signal that a >39-char name was truncated is that the final
  // character of the field is a letter instead of a filler.
  const truncated = nameField.length === 39 && nameField[38] !== '<';
  return { primary, secondary, truncated };
}

/**
 * Thrown when an MRZ fails integrity checks. `errors` explains each failure
 * so the user knows exactly what to fix (or which check digit did not pass).
 */
export class MrzError extends Error {
  constructor(errors, warnings = []) {
    super(errors.join('; '));
    this.name = 'MrzError';
    this.errors = errors;
    this.warnings = warnings;
  }
}

export function parseTD3(line1, line2, now = new Date()) {
  const errors = [];
  const warnings = [];

  if (typeof line1 !== 'string' || typeof line2 !== 'string') {
    throw new MrzError(['MRZ lines must be provided as strings.']);
  }
  const l1 = line1.trim();
  const l2 = line2.trim();

  if (l1.length !== 44 || l2.length !== 44) {
    errors.push(`Each MRZ line must be exactly 44 characters (got ${l1.length} and ${l2.length}).`);
    throw new MrzError(errors, warnings);
  }

  const illegal = [...(l1 + l2)].filter((ch) => !ALLOWED_MRZ_CHARS.has(ch));
  if (illegal.length > 0) {
    errors.push(`Illegal MRZ character(s): ${[...new Set(illegal)].map((c) => `"${c}"`).join(', ')}. Only A-Z, 0-9 and "<" are allowed.`);
  }

  const documentCode = l1.slice(0, 2);
  if (documentCode[0] !== 'P') {
    errors.push(`Document code must begin with "P" for a passport (got "${documentCode[0]}").`);
  }
  const issuingState = l1.slice(2, 5);
  if (issuingState === 'UTO') {
    // "UTO" is the specimen document in the published standard. Seeing it on a
    // real passport is an anomaly signal.
    warnings.push('Issuing state "UTO" is the ICAO specimen code — a real passport should not carry it.');
  }

  const nameField = l1.slice(5, 44);

  const passportNumber = l2.slice(0, 9);
  const passportNumberCheck = l2.slice(9, 10);
  const nationality = l2.slice(10, 13);
  const dobField = l2.slice(13, 19);
  const dobCheck = l2.slice(19, 20);
  const sex = l2.slice(20, 21);
  const expiryField = l2.slice(21, 27);
  const expiryCheck = l2.slice(27, 28);
  const personalNumber = l2.slice(28, 42);
  const personalNumberCheck = l2.slice(42, 43);
  const compositeCheck = l2.slice(43, 44);

  // Per-field check digits — reject the scan unless *all* of them pass.
  const expectPassport = checkDigit(passportNumber);
  if (expectPassport !== passportNumberCheck) {
    errors.push(`Passport number check digit failed: expected "${expectPassport}", got "${passportNumberCheck}".`);
  }

  const expectDob = checkDigit(dobField);
  if (expectDob !== dobCheck) {
    errors.push(`Date of birth check digit failed: expected "${expectDob}", got "${dobCheck}".`);
  }

  const expectExpiry = checkDigit(expiryField);
  if (expectExpiry !== expiryCheck) {
    errors.push(`Expiry date check digit failed: expected "${expectExpiry}", got "${expiryCheck}".`);
  }

  // Position 43 may legitimately be "0" OR "<" when the optional data field is
  // unused (ICAO lets the issuing state choose). Treating it as a plain digit
  // would reject valid passports, so accept either representation of zero.
  const expectPersonal = checkDigit(personalNumber);
  if (personalNumberCheck !== expectPersonal && !(personalNumberCheck === '<' && expectPersonal === '0')) {
    errors.push(`Personal number check digit failed: expected "${expectPersonal}" (or "<"), got "${personalNumberCheck}".`);
  }

  // Composite check digit covers positions 1-10, 14-20, 22-43 — it skips
  // nationality (11-13) and sex (21), which is why those three fields have NO
  // integrity protection and must never be shown as "verified".
  const compositeData =
    passportNumber + passportNumberCheck + dobField + dobCheck + expiryField + expiryCheck + personalNumber + personalNumberCheck;
  const expectComposite = checkDigit(compositeData);
  if (expectComposite !== compositeCheck) {
    errors.push(`Composite check digit failed: expected "${expectComposite}", got "${compositeCheck}".`);
  }

  if (sex !== 'M' && sex !== 'F' && sex !== '<') {
    errors.push(`Sex field must be "M", "F" or "<" (got "${sex}").`);
  }

  if (errors.length > 0) {
    throw new MrzError(errors, warnings);
  }

  // Recoverable anomalies — these must be surfaced, not treated as read errors.
  const dob = parseDateField(dobField, 'birth', now);
  const expiry = parseDateField(expiryField, 'expiry', now);
  if (!dob.complete) warnings.push('Passport recorded an incomplete date of birth (some parts are "<").');
  if (!expiry.complete) warnings.push('Passport recorded an incomplete expiry date (some parts are "<").');

  const name = parseNameField(nameField);
  if (name.truncated) {
    warnings.push('The name field appears truncated (a >39-character name is cut off by the MRZ). The stored name may be incomplete.');
  }

  return {
    documentCode,
    issuingState,
    nationality,
    sex,
    passportNumber,
    dob,
    expiry,
    personalNumber: personalNumber.replace(/</g, '') || null,
    name,
    // Identity fields protected by a check digit — safe to prefill.
    verified: {
      passportNumber,
      dob: dob.iso,
      expiry: expiry.iso
    },
    // Identity fields NOT covered by any check digit — never mark verified.
    unverified: {
      name,
      nationality,
      sex
    },
    warnings
  };
}

/**
 * OCR post-processing: maps the most common OCR-B misreads back to legal MRZ
 * characters, restricted to the 37-char MRZ alphabet. This is deliberately
 * conservative — the check digits must still pass, so an aggressive repair
 * cannot smuggle a wrong value through.
 *
 * Line 1 is letters (name / code), line 2 has digit slots for numbers and
 * check digits plus letter slots for nationality. An illegal character in a
 * slot is a definite OCR error, not real data.
 */
const DIGIT_SLOT_FIXES = { O: '0', Q: '0', D: '0', I: '1', L: '1', B: '8', S: '5', Z: '2', G: '6', A: '4', T: '7' };
const LETTER_SLOT_FIXES = { 0: 'O', 1: 'I', 2: 'Z', 3: 'E', 4: 'A', 5: 'S', 6: 'G', 7: 'T', 8: 'B', 9: 'P' };

function sanitizeRawLine(raw) {
  return raw.toUpperCase().replace(/[^A-Z0-9<]/g, '<');
}

export function repairByPosition(line1Raw, line2Raw) {
  const l1 = sanitizeRawLine(line1Raw);
  const l2 = sanitizeRawLine(line2Raw);
  if (l1.length !== 44 || l2.length !== 44) {
    return { line1: l1, line2: l2, repaired: false };
  }

  // Only true digit-only slots. The passport number (0-9) and the optional-data
  // / personal number (28-42) are ALPHANUMERIC in TD3, so a letter there is real
  // data, never an OCR misread — repairing it would corrupt valid passports.
  const line2DigitRanges = [
    [9, 10], // passport number check digit
    [13, 19], // date of birth
    [19, 20], // DOB check digit
    [21, 27], // expiry
    [27, 28], // expiry check digit
    [42, 43], // personal number check digit
    [43, 44] // composite check digit
  ];

  let repaired = false;
  const fixed1 = l1.split('');
  const fixed2 = l2.split('');

  // Line 1: digits are never legal anywhere (name + document code region).
  for (let i = 0; i < 44; i++) {
    const ch = fixed1[i];
    if (ch >= '0' && ch <= '9' && LETTER_SLOT_FIXES[ch]) {
      fixed1[i] = LETTER_SLOT_FIXES[ch];
      repaired = true;
    }
  }

  // Line 2: letters are never legal inside digit slots.
  for (const [start, end] of line2DigitRanges) {
    for (let i = start; i < end; i++) {
      const ch = fixed2[i];
      if (ch >= 'A' && ch <= 'Z' && DIGIT_SLOT_FIXES[ch]) {
        fixed2[i] = DIGIT_SLOT_FIXES[ch];
        repaired = true;
      }
    }
  }

  // Filler repair: a real human name never contains the same letter three
  // times in a row. A run like "KKK" near the end of the name field is almost
  // always OCR misreading the padding "<" as repeated letters. Only rewrite a
  // run that reaches the field boundary so we never swallow a real name.
  const nameRegion = fixed1.slice(5, 44);
  const tail = nameRegion.join('').replace(/([A-Z])\1{2,}$/g, (m) => '<'.repeat(m.length));
  if (tail !== nameRegion.join('')) {
    for (let i = 0; i < nameRegion.length; i++) {
      fixed1[5 + i] = tail[i];
    }
    repaired = true;
  }

  return { line1: fixed1.join(''), line2: fixed2.join(''), repaired };
}

/**
 * Reduce raw OCR output to legal MRZ characters. Everything that is not A-Z,
 * 0-9 or the filler "<" (spaces, punctuation, non-Latin script, OCR artifacts)
 * collapses to "<".
 */
export function stripToMrzChars(raw) {
  return raw.toUpperCase().replace(/[^A-Z0-9<]/g, '<');
}

/**
 * Pick the two MRZ lines out of a full-page OCR dump.
 *
 * OCR returns the whole passport page, so most lines are human-readable labels
 * ("Date of Expiry", "Identification No", Thai text, …) and only two are the
 * fixed-width MRZ. We score every sanitized line and keep the best line-1
 * (starts with "P") and the best line-2 (a long alphanumeric run full of
 * digits), rather than assuming the MRZ is in a fixed position.
 *
 * Note: the trailing "<" fillers of MRZ line 1 must NOT be trimmed before
 * measuring length — a short name is padded with many fillers, so trimming them
 * would drop a perfectly valid line 1 below the length threshold.
 */
export function pickMrzLines(rawText) {
  const candidates = rawText
    .split(/\r?\n/)
    .map((l) => stripToMrzChars(l))
    .filter((l) => l.replace(/</g, '').length > 0);

  const scored = candidates.map((l) => {
    const alnum = l.replace(/</g, '');
    const digits = (alnum.match(/[0-9]/g) || []).length;
    const letters = (alnum.match(/[A-Z]/g) || []).length;
    let score = 0;
    if (l.length >= 40) score += 30;        // near-MRZ width
    else if (l.length >= 30) score += 15;
    if (l.startsWith('P')) score += 25;      // line-1 signature
    if (digits >= 15) score += 25;           // line-2 signature (many digits)
    else if (digits >= 8) score += 10;
    score += Math.min(alnum.length, 30);     // reward alphanumeric density
    if (digits === 0 && letters < 15) score -= 40; // penalize filler-only labels
    return { l, score, startsP: l.startsWith('P') };
  });

  scored.sort((a, b) => b.score - a.score);

  if (scored.length < 2) {
    throw new MrzError(['No MRZ found in the document. The uploaded file may not be a passport data page.']);
  }

  let line1 = null;
  let line2 = null;
  for (const c of scored) {
    if (!line1 && c.startsP) line1 = c.l;
    else if (!line2 && !c.startsP) line2 = c.l;
    if (line1 && line2) break;
  }
  if (!line1) line1 = scored[0].l;
  if (!line2) line2 = scored[1].l;

  return {
    line1: line1.slice(0, 44).padEnd(44, '<'),
    line2: line2.slice(0, 44).padEnd(44, '<')
  };
}
