import { redirect } from '@sveltejs/kit';
import { listDevUsers, getDevUser, linkStudentByEmail, ROLES } from '$lib/server/auth/index.js';
import { createSession, setSessionCookie } from '$lib/server/auth/session.js';

export async function load() {
  return { devUsers: await listDevUsers() };
}

export const actions = {
  default: async ({ request, cookies }) => {
    if (process.env.DEV_MODE !== 'true') throw redirect(303, '/');
    const form = await request.formData();
    const id = Number(form.get('userId'));
    const user = await getDevUser(id);
    if (!user) return { error: 'Unknown dev user.' };
    // Mirror ssoLogin: bind a matching student registry record to this account
    // so the student role can reach its application flow on first dev login.
    if (user.role === ROLES.student) {
      await linkStudentByEmail(user.id, user.email);
    }
    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(cookies, token, expiresAt);
    throw redirect(303, '/dashboard');
  }
};
