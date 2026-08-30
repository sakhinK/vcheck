import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  checkDigit,
  parseTD3,
  parseNameField,
  resolveTwoDigitYear,
  repairByPosition,
  pickMrzLines,
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

test('repairByPosition preserves alphanumeric passport and personal numbers', () => {
  const l1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const l2 = 'AC55769936THA8510024M33082801409900176213<98';
  const { line2 } = repairByPosition(l1, l2);
  // Passport number and personal number are alphanumeric in TD3 — a letter there
  // is real data, not an OCR misread, so it must not be letter→digit repaired.
  assert.equal(line2.slice(0, 9), 'AC5576993');
  assert.equal(line2.slice(28, 42), '1409900176213<');
});

test('pickMrzLines extracts the MRZ pair from a full passport OCR dump', () => {
  const raw = `KINGDOM OF THAILAND ราชอาณาจักรไทย

**Passport No. / หนังสือเดินทางเลขที่**
AC5576993

**Type / รหัส:** P
**Country Code / ประเทศ:** THA

**Surname / นามสกุล:** KHAOCHAIMaha
**Title / Name / คำนำหน้าชื่อ / ชื่อ:** MR. SAKHIN
**Name in Thai / ชื่อภาษาไทย:** นาย สาขิน ขาวไชยมหา

**Nationality / สัญชาติ:** THAI
**Date of Birth / วันเกิด:** 02 OCT 1985
**Sex / เพศ:** M
**Place of Birth / สถานที่เกิด:** KHON KAEN

**Height / ส่วนสูง:** 1.78M

**Date of Issue / วันที่ออก:** 29 AUG 2023
**Date of Expiry / วันที่หมดอายุ:** 28 AUG 2033

**Identification No. / เลขประจำตัวประชาชน:** 1409900176213

**Issuing Authority / ออกให้โดย:** MINISTRY OF FOREIGN AFFAIRS
**Holder's Signature / ลายมือชื่อผู้ถือหนังสือเดินทาง:**

P<THAKHOACHAIMAH<<SAKHIN<<<<<<<<<<<<<
AC55769936THA8510024M33082801409900176213<98`;

  const { line1, line2 } = pickMrzLines(raw);
  assert.equal(line1.length, 44);
  assert.equal(line1.slice(0, 5), 'P<THA');
  assert.equal(line2, 'AC55769936THA8510024M33082801409900176213<98');

  // The two bugs this guards against: (1) MRZ line 1 losing its trailing
  // fillers and dropping out of contention, and (2) alphanumeric passport /
  // personal numbers being corrupted. The full parse must succeed.
  const repaired = repairByPosition(line1, line2);
  const mrz = parseTD3(repaired.line1, repaired.line2, new Date(2026, 0, 1));
  assert.equal(mrz.passportNumber, 'AC5576993');
  assert.equal(mrz.nationality, 'THA');
  assert.equal(mrz.dob.iso, '1985-10-02');
  assert.equal(mrz.expiry.iso, '2033-08-28');
  assert.equal(mrz.sex, 'M');
  assert.deepEqual(mrz.name.primary, ['KHOACHAIMAH']);
  assert.deepEqual(mrz.name.secondary, ['SAKHIN']);
  assert.equal(mrz.personalNumber, '1409900176213');
});
