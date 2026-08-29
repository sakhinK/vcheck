import { redirect } from '@sveltejs/kit';
import { getStudentForUser } from '$lib/server/business/registry.js';
import { listVersions } from '$lib/server/business/version.js';

export async function load({ locals }) {
  const user = locals.user;
  if (!user) throw redirect(303, '/');
  if (user.role !== 'international_student') throw redirect(303, '/dashboard');
  const student = await getStudentForUser(user.id);
  const versions = student ? await listVersions(student.id) : [];
  return { user, student, versions };
}
