import { redirect } from '@sveltejs/kit';
import { destroySession } from '$lib/server/auth/session.js';

export async function POST({ cookies }) {
  await destroySession(cookies);
  throw redirect(303, '/');
}
