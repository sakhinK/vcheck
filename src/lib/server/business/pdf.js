import { PDFDocument, StandardFonts } from 'pdf-lib';

/**
 * Official documents are generated server-side as PDFs. The English default
 * language is used here; a production deployment may swap in a Thai-capable
 * embedded font (pdf-lib's standard fonts do not cover Thai glyphs).
 */

const A4 = [595.28, 841.89];

async function buildPdf(draw) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(A4);
  const ctx = { doc, page, font, bold };
  draw(ctx);
  return await doc.save();
}

function line(ctx, text, y, { size = 11, bold = false, indent = 56 } = {}) {
  ctx.page.drawText(text, { x: indent, y, size, font: bold ? ctx.bold : ctx.font });
}

/** Internal memo (บันทึกข้อความ) that a faculty officer prints, signs, scans. */
export async function generateMemoPdf(app) {
  return buildPdf(({ page, bold, font }) => {
    const w = A4[0];
    line({ page, bold, font }, 'MEMORANDUM', 780, { size: 16, bold: true, indent: 56 });
    line({ page, bold, font }, 'Faculty of International Affairs, Khon Kaen University', 760, { size: 11, indent: 56 });
    page.drawLine({ start: { x: 56, y: 744 }, end: { x: w - 56, y: 744 }, thickness: 1 });

    line({ page, bold, font }, `Ref: ${app.application_no}`, 712, { size: 11 });
    line({ page, bold, font }, `Date: ${new Date().toISOString().slice(0, 10)}`, 692, { size: 11 });
    line({ page, bold, font }, 'Subject: Request for visa extension support', 672, { size: 11 });

    const rows = [
      ['Student', `${app.first_name} ${app.last_name} (${app.student_code})`],
      ['Passport name', `${app.name_primary || ''} ${app.name_secondary || ''}`.trim()],
      ['Passport number', app.passport_number || '—'],
      ['Nationality', app.nationality || '—'],
      ['Date of birth', app.date_of_birth || '—'],
      ['Passport expiry', app.passport_expiry_date || '—'],
      ['Faculty / program', `${app.faculty || '—'} / ${app.program || '—'}`]
    ];
    let y = 636;
    for (const [k, v] of rows) {
      line({ page, bold, font }, `${k}:`, y, { size: 11, indent: 56 });
      line({ page, bold, font }, String(v), y, { size: 11, indent: 200 });
      y -= 22;
    }

    line({ page, bold, font }, 'The Faculty recommends this international student for visa extension and', 560, { size: 11 });
    line({ page, bold, font }, 'requests the Faculty of International Affairs to issue the official letter', 544, { size: 11 });
    line({ page, bold, font }, 'to the Immigration Bureau.', 528, { size: 11 });

    line({ page, bold, font }, 'Signature: ________________________', 460, { size: 11 });
    line({ page, bold, font }, 'Dean, ' + (app.faculty || 'Faculty'), 440, { size: 11 });
  });
}

/** Official letter to the Immigration Bureau (หนังสือถึง ตม.). */
export async function generateLetterPdf(app) {
  return buildPdf(({ page, bold, font }) => {
    const w = A4[0];
    line({ page, bold, font }, 'Faculty of International Affairs', 780, { size: 13, bold: true, indent: 56 });
    line({ page, bold, font }, 'Khon Kaen University', 764, { size: 13, bold: true, indent: 56 });

    line({ page, bold, font }, `Ref: ${app.application_no}`, 720, { size: 11 });
    line({ page, bold, font }, 'To: Immigration Bureau', 700, { size: 11 });
    line({ page, bold, font }, 'Subject: Certification of student status for visa extension', 680, { size: 11, bold: true });

    line({ page, bold, font }, 'To whom it may concern,', 648, { size: 11 });
    line({ page, bold, font }, `This is to certify that ${app.first_name} ${app.last_name}, passport number`, 624, { size: 11 });
    line({ page, bold, font }, `${app.passport_number || '—'}, nationality ${app.nationality || '—'}, is a registered`, 608, { size: 11 });
    line({ page, bold, font }, `student of ${app.faculty || '—'}, ${app.program || '—'}.`, 592, { size: 11 });
    line({ page, bold, font }, 'The university supports the student\'s application for a visa extension.', 568, { size: 11 });

    line({ page, bold, font }, 'Signature: ________________________', 480, { size: 11 });
    line({ page, bold, font }, 'Director, Faculty of International Affairs', 460, { size: 11 });
    line({ page, bold, font }, 'Khon Kaen University', 444, { size: 11 });
    line({ page, bold, font }, `Date: ${new Date().toISOString().slice(0, 10)}`, 424, { size: 11 });
    void w;
  });
}
