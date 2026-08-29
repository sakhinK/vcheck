import { redirect } from '@sveltejs/kit';
import { listApplications } from '$lib/server/business/applications.js';
import { getStudentForUser } from '$lib/server/business/registry.js';

export async function load({ locals, url }) {
  const user = locals.user;
  if (!user) throw redirect(303, '/');
  const query = url.searchParams.get('q') || '';
  const status = url.searchParams.get('status') || '';
  const applications = await listApplications(user, { query, status });
  const student = user.role === 'international_student' ? await getStudentForUser(user.id) : null;
  return { user, applications, query, status, student };
}
