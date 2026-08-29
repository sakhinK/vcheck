import { redirect } from '@sveltejs/kit';
import { listApplications } from '$lib/server/business/applications.js';
import { STATUS_LABELS } from '$lib/server/business/workflow.js';

// "What is waiting for me?" — the statuses each role must act on.
const ACTION_STATUSES = {
  international_student: [],
  faculty_officer: ['pending', 'advisor_ack'],
  advisor: ['advisor_pending'],
  iad_officer: ['iad_pending', 'processing'],
  iad_director: ['iad_dir_pending']
};

export async function load({ locals }) {
  const user = locals.user;
  if (!user) throw redirect(303, '/');

  const apps = await listApplications(user, {});
  const stats = [];

  if (user.role === 'international_student') {
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

  return { user, stats, applications: apps.slice(0, 25), statusLabels: STATUS_LABELS };
}
