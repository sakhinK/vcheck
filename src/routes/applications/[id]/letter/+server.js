import { redirect, error } from '@sveltejs/kit';
import { getApplication } from '$lib/server/business/applications.js';
import { generateLetterPdf } from '$lib/server/business/pdf.js';
import { ROLES } from '$lib/server/auth/index.js';

export async function GET({ locals, params }) {
  const user = locals.user;
  if (!user) throw redirect(303, '/');
  if (![ROLES.iad, ROLES.director].includes(user.role)) {
    throw error(403, 'Only IAD may download the letter.');
  }
  const app = await getApplication(params.id);
  if (!app) throw error(404, 'Application not found.');
  const bytes = await generateLetterPdf(app);
  return new Response(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="letter-${app.application_no}.pdf"`
    }
  });
}
