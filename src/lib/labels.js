// Pure, client-safe display labels (no server imports) so components can use
// them on both the server render and the client bundle.

export const ROLE_LABELS = {
  international_student: 'International Student',
  faculty_officer: 'Faculty Officer',
  advisor: 'Advisor',
  iad_officer: 'IAD Officer',
  iad_director: 'IAD Director'
};

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

export const NAME_SOURCE_LABELS = {
  mrz: 'Read from MRZ',
  applicant_edited: 'Edited by applicant',
  officer_edited: 'Corrected by officer'
};
