import { getUserFromCookies } from '$lib/server/auth/session.js';

export async function handle({ event, resolve }) {
  // Attach the current user (if any) to every request; routes read it from
  // event.locals without re-querying the session.
  event.locals.user = await getUserFromCookies(event.cookies);
  return resolve(event);
}
