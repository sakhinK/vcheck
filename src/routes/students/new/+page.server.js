import { redirect } from '@sveltejs/kit';
import { registerStudent } from '$lib/server/business/registry.js';
import { ROLES } from '$lib/server/auth/index.js';

export async function load({ locals }) {
  if (!locals.user || ![ROLES.faculty, ROLES.iad].includes(locals.user.role)) throw redirect(303, '/students');
  return { user: locals.user };
}

export const actions = {
  default: async ({ request, locals }) => {
    if (!locals.user || ![ROLES.faculty, ROLES.iad].includes(locals.user.role)) {
      return { error: 'You are not allowed to register students.' };
    }
    const f = await request.formData();
    const firstName = f.get('firstName')?.toString().trim();
    const lastName = f.get('lastName')?.toString().trim();
    const email = f.get('email')?.toString().trim();
    if (!firstName || !lastName || !email) return { error: 'First name, last name and email are required.' };
    const id = await registerStudent(
      {
        studentCode: f.get('studentCode')?.toString().trim(),
        firstName,
        lastName,
        country: f.get('country')?.toString().trim(),
        email,
        faculty: f.get('faculty')?.toString().trim(),
        program: f.get('program')?.toString().trim(),
        degreeLevel: f.get('degreeLevel')?.toString().trim()
      },
      locals.user.id
    );
    throw redirect(303, `/students/${id}`);
  }
};
