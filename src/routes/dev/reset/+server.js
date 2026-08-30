import { redirect } from '@sveltejs/kit';
import { resetDemoData } from '$lib/server/business/demo.js';

// Dev-only "start a new simulation" endpoint. Gated on DEV_MODE and a signed-in
// user so it can never wipe data in a non-dev deployment.
export async function POST({ locals }) {
  if (process.env.DEV_MODE !== 'true') throw redirect(303, '/');
  if (!locals.user) throw redirect(303, '/');
  await resetDemoData();
  throw redirect(303, '/dashboard');
}
