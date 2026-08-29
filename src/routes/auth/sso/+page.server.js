import { redirect } from '@sveltejs/kit';
import { ssoLogin } from '$lib/server/auth/index.js';
import { createSession, setSessionCookie } from '$lib/server/auth/session.js';

export const actions = {
  default: async ({ request, cookies }) => {
    const form = await request.formData();
    const email = (form.get('email')?.toString() || '').trim();
    const name = form.get('name')?.toString() || '';
    if (!email) return { error: 'An institutional email is required.' };
    const { user } = await ssoLogin(email, name);
    const { token, expiresAt } = await createSession(user.id);
    setSessionCookie(cookies, token, expiresAt);
    throw redirect(303, '/dashboard');
  }
};
