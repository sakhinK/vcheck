import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkDigit,
  parseTD3,
  parseNameField,
  resolveTwoDigitYear,
  repairByPosition,
  MrzError
} from '../src/lib/server/business/mrz.js';

test('checkDigit matches the two vectors published in ICAO 9303', () => {
  assert.equal(checkDigit('520727'), '3');
  assert.equal(checkDigit('AB2134<<<'), '5');
});

test('checkDigit treats "<" as zero', () => {
  assert.equal(checkDigit('<<<<<<'), '0');
});

test('resolveTwoDigitYear: birth is always past, expiry is near-future', () => {
  assert.equal(resolveTwoDigitYear(74, 'birth', new Date(2026, 0, 1)), 1974);
  assert.equal(resolveTwoDigitYear(8, 'birth', new Date(2026, 0, 1)), 2008);
  assert.equal(resolveTwoDigitYear(30, 'expiry', new Date(2026, 0, 1)), 2030);
  assert.equal(resolveTwoDigitYear(12, 'expiry', new Date(2018, 0, 1)), 2012);
});

test('parses the full specimen TD3 from the standard', () => {
  const l1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const l2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';
  const r = parseTD3(l1, l2, new Date(2016, 0, 1));

  assert.equal(r.documentCode, 'P<');
  assert.equal(r.issuingState, 'UTO');
  assert.equal(r.passportNumber, 'L898902C3');
  assert.equal(r.nationality, 'UTO');
  assert.equal(r.dob.iso, '1974-08-12');
  assert.equal(r.sex, 'F');
  assert.equal(r.expiry.iso, '2012-04-15');
  assert.deepEqual(r.name.primary, ['ERIKSSON']);
  assert.deepEqual(r.name.secondary, ['ANNA', 'MARIA']);
  // "UTO" is the specimen code and must be flagged.
  assert.ok(r.warnings.some((w) => w.includes('UTO')));
});

test('rejects a passport with a single flipped check digit and names the field', () => {
  // Tamper the DOB check digit (position 20) from "2" to "3".
  const l1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const l2 = 'L898902C36UTO7408123F1204159ZE184226B<<<<<10';
  assert.throws(
    () => parseTD3(l1, l2, new Date(2016, 0, 1)),
    (err) => {
      assert.ok(err instanceof MrzError);
      assert.ok(err.errors.some((e) => e.includes('Date of birth check digit')));
      return true;
    }
  );
});

test('rejects an illegal character', () => {
  const l1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const l2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<1#';
  assert.throws(() => parseTD3(l1, l2), MrzError);
});

test('specimen personal number is preserved, not stripped', () => {
  const l1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const l2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';
  const r = parseTD3(l1, l2, new Date(2016, 0, 1));
  assert.equal(r.personalNumber, 'ZE184226B');
});

test('accepts "<" at position 43 when personal number field is unused', () => {
  const l1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const passportNumber = 'L898902C3';
  const passportCheck = checkDigit(passportNumber);
  const nationality = 'USA';
  const dobField = '740812';
  const dobCheck = checkDigit(dobField);
  const sex = 'F';
  const expiryField = '120415';
  const expiryCheck = checkDigit(expiryField);
  const pn = '<<<<<<<<<<<<<<';
  const pnCheck = '<';
  const composite = checkDigit(passportNumber + passportCheck + dobField + dobCheck + expiryField + expiryCheck + pn + pnCheck);
  const l2 = passportNumber + passportCheck + nationality + dobField + dobCheck + sex + expiryField + expiryCheck + pn + pnCheck + composite;
  const r = parseTD3(l1, l2, new Date(2016, 0, 1));
  assert.equal(r.personalNumber, null);
});

test('flags truncated name (final char is a letter, not filler)', () => {
  const long = 'P<UTOSMITH<<JOHN<WILLIAM<ROBERT<ALEXANDER<CH';
  assert.equal(long.length, 44);
  const { truncated } = parseNameField(long.slice(5));
  assert.equal(truncated, true);
});

test('flags incomplete dates but still parses known parts', () => {
  const l1 = 'P<UTODOE<<JANE<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<';
  // DOB with an unknown day "<<" but a valid check digit for "<<":
  // checkDigit('74121<') must equal the supplied digit.
  const dobField = '74121<';
  const dobCheck = checkDigit(dobField);
  const expiryField = '300101';
  const expiryCheck = checkDigit(expiryField);
  const pn = '<<<<<<<<<<<<<<';
  const pnCheck = checkDigit(pn);
  const compositeData = 'X000000000' + dobField + dobCheck + 'F' + expiryField + expiryCheck + pn + pnCheck;
  // Build a syntactically valid line 2.
  const passportNumber = 'X00000000';
  const passportCheck = checkDigit(passportNumber);
  const nationality = 'UTO';
  const sex = 'F';
  const composite = checkDigit(passportNumber + passportCheck + dobField + dobCheck + expiryField + expiryCheck + pn + pnCheck);
  const l2 = passportNumber + passportCheck + nationality + dobField + dobCheck + sex + expiryField + expiryCheck + pn + pnCheck + composite;
  const r = parseTD3(l1, l2, new Date(2026, 0, 1));
  assert.equal(r.dob.complete, false);
  assert.equal(r.dob.year, 1974);
  assert.equal(r.dob.month, 12);
  assert.equal(r.dob.day, null);
  assert.ok(r.warnings.some((w) => w.includes('incomplete date of birth')));
});

test('repairByPosition fixes common OCR letter/digit confusions in digit slots', () => {
  const l1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const l2 = 'L898902C36UTO7408122F1204159ZE184226B<<<<<1O'; // "O" should be "0"
  const { line2 } = repairByPosition(l1, l2);
  assert.equal(line2[43], '0');
});
