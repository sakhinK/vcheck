import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  canTransition,
  availableActions,
  transitionRequirement,
  milestoneIndex,
  isTerminal,
  TRANSITIONS
} from '../src/lib/server/business/workflow.js';

const S = 'international_student';
const F = 'faculty_officer';
const A = 'advisor';
const I = 'iad_officer';
const D = 'iad_director';

test('normal path is fully walkable', () => {
  const path = [
    [null, 'pending', S],
    ['pending', 'faculty_ack', F],
    ['faculty_ack', 'advisor_pending', F],
    ['advisor_pending', 'advisor_ack', A],
    ['advisor_ack', 'faculty_review', F],
    ['faculty_review', 'iad_pending', F],
    ['iad_pending', 'iad_ack', I],
    ['iad_ack', 'iad_dir_pending', I],
    ['iad_dir_pending', 'processing', D],
    ['processing', 'completed', I]
  ];
  for (const [from, to, role] of path) {
    if (from) assert.equal(canTransition(from, to, role), true, `${from} -> ${to} by ${role}`);
  }
});

test('faculty can skip the advisor step', () => {
  assert.equal(canTransition('faculty_ack', 'faculty_review', F), true);
});

test('faculty_review -> iad_pending requires a signed memo', () => {
  assert.equal(transitionRequirement('faculty_review', 'iad_pending'), 'signed_memo');
});

test('processing -> completed requires a signed letter', () => {
  assert.equal(transitionRequirement('processing', 'completed'), 'signed_letter');
});

test('a student cannot advance past their own submit/resubmit', () => {
  assert.equal(canTransition('pending', 'faculty_ack', S), false);
  assert.equal(canTransition('faculty_ack', 'advisor_pending', S), false);
  assert.equal(canTransition('rejected', 'pending', S), true);
});

test('any non-terminal status can be terminated', () => {
  for (const status of ['pending', 'faculty_ack', 'advisor_pending', 'advisor_ack', 'faculty_review', 'iad_pending', 'iad_ack', 'iad_dir_pending', 'processing']) {
    const actions = availableActions(status, I);
    assert.ok(actions.some((a) => a.to === 'terminated'), `${status} should allow termination`);
  }
});

test('IAD can act on behalf of faculty', () => {
  assert.equal(canTransition('pending', 'faculty_ack', I), true);
  assert.equal(canTransition('faculty_review', 'iad_pending', I), true);
});

test('terminal statuses have no outgoing transitions', () => {
  assert.equal(isTerminal('completed'), true);
  assert.equal(isTerminal('terminated'), true);
  assert.deepEqual(TRANSITIONS.completed, []);
  assert.deepEqual(TRANSITIONS.terminated, []);
});

test('milestones collapse internal statuses for the applicant', () => {
  assert.equal(milestoneIndex('pending'), 0);
  assert.equal(milestoneIndex('advisor_pending'), 1); // same as faculty_ack
  assert.equal(milestoneIndex('advisor_ack'), 2);
  assert.equal(milestoneIndex('iad_pending'), 3); // same as faculty_review
  assert.equal(milestoneIndex('iad_dir_pending'), 4); // same as iad_ack
  assert.equal(milestoneIndex('completed'), 6);
  assert.equal(milestoneIndex('rejected'), -1);
});
