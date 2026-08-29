import { redirect } from '@sveltejs/kit';
import { listStudents } from '$lib/server/business/registry.js';
import { ROLES } from '$lib/server/auth/index.js';

const STAFF_ROLES = [ROLES.faculty, ROLES.iad, ROLES.director];

export async function load({ locals, url }) {
  const user = locals.user;
  if (!user) throw redirect(303, '/');
  if (!STAFF_ROLES.includes(user.role)) throw redirect(303, '/dashboard');
  const query = url.searchParams.get('q') || '';
  const students = await listStudents(user, { query });
  return { user, students, query, canRegister: user.role !== ROLES.director };
}
