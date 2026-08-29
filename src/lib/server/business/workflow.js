/**
 * Application workflow / state machine.
 *
 * Single source of truth for which status may follow which, and who may make
 * that move. Route handlers only orchestrate — they never hard-code a
 * transition. Keeping the machine pure and testable is milestone 3's point.
 */

export const STATUSES = [
  'pending', 'faculty_ack', 'advisor_pending', 'advisor_ack', 'faculty_review',
  'iad_pending', 'iad_ack', 'iad_dir_pending', 'processing', 'completed',
  'rejected', 'terminated'
];

export const STATUS_LABELS = {
  pending: 'Submitted',
  faculty_ack: 'Faculty acknowledged',
  advisor_pending: 'Awaiting advisor',
  advisor_ack: 'Advisor approved',
  faculty_review: 'Faculty review',
  iad_pending: 'Sent to IAD',
  iad_ack: 'IAD acknowledged',
  iad_dir_pending: 'Awaiting director',
  processing: 'Preparing documents',
  completed: 'Completed',
  rejected: 'Returned for correction',
  terminated: 'Cancelled'
};

export const TERMINAL_STATUSES = ['completed', 'terminated'];

const ROLES = {
  student: 'international_student',
  faculty: 'faculty_officer',
  advisor: 'advisor',
  iad: 'iad_officer',
  director: 'iad_director'
};

/**
 * Transition table: status -> list of allowed next states.
 * `roles` = who may perform the move. `onBehalf` marks moves an IAD officer
 * may also perform in place of a faculty officer (recorded as such).
 */
export const TRANSITIONS = {
  pending: [
    { to: 'faculty_ack', roles: [ROLES.faculty, ROLES.iad], onBehalf: true },
    { to: 'terminated', roles: [ROLES.faculty, ROLES.iad, ROLES.student] }
  ],
  faculty_ack: [
    { to: 'advisor_pending', roles: [ROLES.faculty, ROLES.iad], onBehalf: true },
    // Faculty may skip the advisor step and approve in-house.
    { to: 'faculty_review', roles: [ROLES.faculty, ROLES.iad], onBehalf: true },
    { to: 'rejected', roles: [ROLES.faculty, ROLES.iad], onBehalf: true },
    { to: 'terminated', roles: [ROLES.faculty, ROLES.iad, ROLES.student] }
  ],
  advisor_pending: [
    { to: 'advisor_ack', roles: [ROLES.advisor] },
    { to: 'rejected', roles: [ROLES.advisor] },
    { to: 'faculty_ack', roles: [ROLES.advisor, ROLES.iad], onBehalf: true },
    { to: 'terminated', roles: [ROLES.faculty, ROLES.iad, ROLES.advisor, ROLES.student] }
  ],
  advisor_ack: [
    { to: 'faculty_review', roles: [ROLES.faculty, ROLES.iad], onBehalf: true },
    { to: 'rejected', roles: [ROLES.faculty, ROLES.iad], onBehalf: true },
    { to: 'terminated', roles: [ROLES.faculty, ROLES.iad, ROLES.student] }
  ],
  faculty_review: [
    // Requires a signed memo (PDF) to have been uploaded.
    { to: 'iad_pending', roles: [ROLES.faculty, ROLES.iad], onBehalf: true, requires: 'signed_memo' },
    { to: 'rejected', roles: [ROLES.faculty, ROLES.iad], onBehalf: true },
    { to: 'terminated', roles: [ROLES.faculty, ROLES.iad, ROLES.student] }
  ],
  iad_pending: [
    { to: 'iad_ack', roles: [ROLES.iad] },
    { to: 'rejected', roles: [ROLES.iad] },
    { to: 'faculty_ack', roles: [ROLES.iad] },
    { to: 'advisor_pending', roles: [ROLES.iad] },
    { to: 'terminated', roles: [ROLES.iad, ROLES.faculty] }
  ],
  iad_ack: [
    { to: 'iad_dir_pending', roles: [ROLES.iad] },
    { to: 'rejected', roles: [ROLES.iad, ROLES.director] },
    { to: 'faculty_ack', roles: [ROLES.iad] },
    { to: 'advisor_pending', roles: [ROLES.iad] },
    { to: 'terminated', roles: [ROLES.iad, ROLES.faculty] }
  ],
  iad_dir_pending: [
    { to: 'processing', roles: [ROLES.director] },
    { to: 'rejected', roles: [ROLES.director] },
    { to: 'terminated', roles: [ROLES.director, ROLES.iad] }
  ],
  processing: [
    // Requires a signed letter (PDF) to have been uploaded.
    { to: 'completed', roles: [ROLES.iad], requires: 'signed_letter' },
    { to: 'terminated', roles: [ROLES.iad, ROLES.director] }
  ],
  rejected: [
    // Resubmission keeps the same application number; the round increments.
    { to: 'pending', roles: [ROLES.student] },
    { to: 'terminated', roles: [ROLES.student, ROLES.faculty, ROLES.iad] }
  ],
  completed: [],
  terminated: []
};

/** The extra upload a transition needs, if any. */
export function transitionRequirement(from, to) {
  const found = (TRANSITIONS[from] || []).find((c) => c.to === to);
  return found?.requires || null;
}

/** Whether `role` may move `from -> to` (ignoring extra upload requirements). */
export function canTransition(from, to, role) {
  return (TRANSITIONS[from] || []).some((c) => c.to === to && c.roles.includes(role));
}

/** Whether an IAD officer doing this move is acting on behalf of a faculty. */
export function isOnBehalf(from, to) {
  const found = (TRANSITIONS[from] || []).find((c) => c.to === to);
  return Boolean(found?.onBehalf);
}

/** Allowed next moves for a given role at a given status. */
export function availableActions(status, role) {
  return (TRANSITIONS[status] || [])
    .filter((c) => c.roles.includes(role))
    .map((c) => ({ to: c.to, requires: c.requires || null, onBehalf: Boolean(c.onBehalf) }));
}

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * What the *applicant* sees is a progress timeline, never internal comments.
 * Several internal statuses collapse to the same public milestone. `rejected`
 * and `terminated` have no milestone index (round progress resets).
 */
export const PUBLIC_MILESTONES = [
  { status: 'pending', label: 'Submitted' },
  { status: 'faculty_ack', label: 'Faculty acknowledged' },
  { status: 'advisor_ack', label: 'Advisor approved' },
  { status: 'faculty_review', label: 'Faculty review' },
  { status: 'iad_ack', label: 'IAD acknowledged' },
  { status: 'processing', label: 'Preparing documents' },
  { status: 'completed', label: 'Completed' }
];

const STATUS_TO_MILESTONE = {
  pending: 0,
  faculty_ack: 1,
  advisor_pending: 1,
  advisor_ack: 2,
  faculty_review: 3,
  iad_pending: 3,
  iad_ack: 4,
  iad_dir_pending: 4,
  processing: 5,
  completed: 6
};

export function milestoneIndex(status) {
  return STATUS_TO_MILESTONE[status] ?? -1;
}

