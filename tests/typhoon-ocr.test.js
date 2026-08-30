import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTextFromResponse } from '../src/lib/server/business/ocr-typhoon.js';

test('extractTextFromResponse joins successful page contents', () => {
  const body = {
    results: [
      { success: true, filename: 'p1.png', message: { choices: [{ message: { content: 'P<UTOERIKSSON' } }] } },
      { success: true, filename: 'p2.png', message: { choices: [{ message: { content: 'L898902C3' } }] } }
    ]
  };
  assert.equal(extractTextFromResponse(body), 'P<UTOERIKSSON\nL898902C3');
});

test('extractTextFromResponse unwraps natural_text from JSON content', () => {
  const body = {
    results: [
      { success: true, filename: 'p1.png', message: { choices: [{ message: { content: '{"natural_text":"P<UTO ERKSSON"}' } }] } }
    ]
  };
  assert.equal(extractTextFromResponse(body), 'P<UTO ERKSSON');
});

test('extractTextFromResponse throws on failed pages', () => {
  const body = {
    results: [
      { success: false, filename: 'p1.png', error: 'unreadable' }
    ]
  };
  assert.throws(() => extractTextFromResponse(body), /unreadable/);
});

test('extractTextFromResponse throws on empty result', () => {
  assert.throws(() => extractTextFromResponse({}), /no text/);
  assert.throws(() => extractTextFromResponse(null), /empty response/);
});

test('extractTextFromResponse decodes HTML-escaped MRZ fillers', () => {
  const body = {
    results: [
      { success: true, filename: 'p1.png', message: { choices: [{ message: { content: 'P&lt;UTOERIKSSON &lt;&lt; ANNA&lt;MARIA&gt;&gt;&gt;' } }] } }
    ]
  };
  assert.equal(extractTextFromResponse(body), 'P<UTOERIKSSON << ANNA<MARIA>>>');
});
