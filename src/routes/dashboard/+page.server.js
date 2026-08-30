import { redirect } from '@sveltejs/kit';
import { listApplications } from '$lib/server/business/applications.js';
import { STATUS_LABELS } from '$lib/server/business/workflow.js';
import { getStudentForUser } from '$lib/server/business/registry.js';
import { getLatestVersion } from '$lib/server/business/version.js';
import { listNotifications, markNotificationsRead } from '$lib/server/business/notifications.js';
import { isPast, daysFromToday, formatDate } from '$lib/server/business/dates.js';

// "What is waiting for me?" — the statuses each role must act on.
const ACTION_STATUSES = {
  international_student: [],
  faculty_officer: ['pending', 'advisor_ack'],
  advisor: ['advisor_pending'],
  iad_officer: ['iad_pending', 'processing'],
  iad_director: ['iad_dir_pending']
};

const REVIEWER_ROLES = ['faculty_officer', 'iad_officer', 'iad_director'];

export async function load({ locals }) {
  const user = locals.user;
  if (!user) throw redirect(303, '/');

  const apps = await listApplications(user, {});
  const stats = [];

  let student = null;
  let hasData = false;
  let statusSummary = null;

  if (user.role === 'international_student') {
    student = await getStudentForUser(user.id);
    const latest = student ? await getLatestVersion(student.id) : null;
    hasData = Boolean(latest);

    if (latest) {
      const daysRemaining = daysFromToday(latest.visa_last_allowed_date);
      statusSummary = {
        daysRemaining,
        passportExpiry: formatDate(latest.passport_expiry_date),
        insuranceEnd: formatDate(latest.insurance_end_date),
        passportExpired: isPast(latest.passport_expiry_date),
        insuranceExpired: isPast(latest.insurance_end_date),
        stayExpired: daysRemaining !== null && daysRemaining < 0
      };
    }

    const open = apps.filter((a) => !['completed', 'terminated'].includes(a.status)).length;
    stats.push({ label: 'Open applications', value: open });
    stats.push({ label: 'Completed', value: apps.filter((a) => a.status === 'completed').length });
    stats.push({ label: 'Returned for correction', value: apps.filter((a) => a.status === 'rejected').length });
  } else {
    for (const status of ACTION_STATUSES[user.role] || []) {
      stats.push({ label: STATUS_LABELS[status], value: apps.filter((a) => a.status === status).length, status });
    }
    stats.push({ label: 'Total in view', value: apps.length });
  }

  const isReviewer = REVIEWER_ROLES.includes(user.role);
  const notifications = isReviewer ? await listNotifications(user.id) : [];

  return {
    user, stats, applications: apps.slice(0, 25), statusLabels: STATUS_LABELS,
    student, hasData, statusSummary, isReviewer, notifications
  };
}

export const actions = {
  markNotificationsRead: async ({ locals }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    await markNotificationsRead(user.id);
    throw redirect(303, '/dashboard');
  }
};
