import { redirect, error, fail } from '@sveltejs/kit';
import { getStudent, canAccessStudent } from '$lib/server/business/registry.js';
import { listVersions, createVersion, getVersion, deleteVersion } from '$lib/server/business/version.js';
import { ROLES } from '$lib/server/auth/index.js';

export async function load({ locals, params }) {
  const user = locals.user;
  if (!user) throw redirect(303, '/');
  const student = await getStudent(params.id);
  if (!canAccessStudent(user, student)) throw error(403, 'You cannot access this student.');
  const versions = await listVersions(student.id);
  const canEdit =
    user.role === ROLES.student
      ? student.user_id === user.id
      : [ROLES.faculty, ROLES.iad].includes(user.role);
  return { user, student, versions, canEdit };
}

export const actions = {
  createVersion: async ({ locals, params }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    const student = await getStudent(params.id);
    if (!canAccessStudent(user, student)) throw error(403, 'Not allowed.');
    const id = await createVersion(student.id, user.id);
    throw redirect(303, `/versions/${id}`);
  },

  deleteVersion: async ({ request, locals, params }) => {
    const user = locals.user;
    if (!user) throw redirect(303, '/');
    const student = await getStudent(params.id);
    if (!canAccessStudent(user, student)) throw error(403, 'Not allowed.');

    const canDelete =
      user.role === ROLES.student
        ? student.user_id === user.id
        : [ROLES.faculty, ROLES.iad].includes(user.role);
    if (!canDelete) throw error(403, 'Not allowed.');

    const form = await request.formData();
    const versionId = Number(form.get('versionId'));
    const version = await getVersion(versionId);
    if (!version || version.student_id !== student.id) {
      return fail(400, { error: 'Data version not found.' });
    }

    try {
      await deleteVersion(versionId);
    } catch (err) {
      return fail(400, { error: err.message });
    }
    throw redirect(303, user.role === ROLES.student ? '/profile' : `/students/${student.id}`);
  }
};
