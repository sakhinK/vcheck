export function load({ locals }) {
  return { user: locals.user, devMode: process.env.DEV_MODE === 'true' };
}
