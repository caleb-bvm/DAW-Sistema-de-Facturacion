import nodemailer from 'nodemailer';
import { config } from './config.js';
import { query, transaction } from './db.js';
import { validEmail } from './validation.js';
import { invoiceData } from './invoices.js';
import { invoicePdf } from './documents.js';

export function createTransport() {
  return nodemailer.createTransport({ host: config.smtp.host, port: config.smtp.port, secure: config.smtp.secure, requireTLS: config.smtp.requireTLS, auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.password } : undefined, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000 });
}
let busy = false;
export async function processMail(limit = 20) {
  if (busy) return { aceptados: 0, fallidos: 0 }; busy = true;
  const result = { aceptados: 0, fallidos: 0 }; const transport = createTransport();
  try {
    for (let i = 0; i < limit; i++) {
      const job = await transaction(async (connection) => {
        await query("UPDATE correos SET estado=CASE WHEN intentos>=5 THEN 'fallido' ELSE 'pendiente' END WHERE estado='procesando' AND updated_at<DATEADD(MINUTE,-10,SYSUTCDATETIME())", [], connection);
        const [row] = await query("SELECT TOP (1) * FROM correos WITH (UPDLOCK,ROWLOCK) WHERE estado='pendiente' AND proximo_intento<=SYSUTCDATETIME() AND intentos<5 ORDER BY id", [], connection);
        if (!row) return null; await query("UPDATE correos SET estado='procesando',intentos=intentos+1,updated_at=SYSUTCDATETIME() WHERE id=?", [row.id], connection); return row;
      });
      if (!job) break;
      try {
        if (!validEmail(config.mailFrom)) throw new Error('Configura MAIL_FROM.');
        const attachments = [];
        if (job.tipo === 'factura') {
          const data = await invoiceData(job.factura_id); if (data.factura.estado !== 'emitida') throw new Error('Documento anulado.');
          attachments.push({ filename: `${data.factura.numero}.pdf`, content: await invoicePdf(data), contentType: 'application/pdf' });
        }
        const info = await transport.sendMail({ from: { name: config.company.nombre, address: config.mailFrom }, to: job.destinatario, subject: job.asunto, text: job.cuerpo, attachments, messageId: `<facturacion-${job.id}@${config.mailFrom.split('@')[1]}>` });
        if (!info.accepted?.length || info.rejected?.length) throw new Error('El servidor SMTP no aceptó el destinatario.');
        await query("UPDATE correos SET estado='aceptado',error=NULL,updated_at=SYSUTCDATETIME() WHERE id=?", [job.id]); result.aceptados++;
      } catch (error) {
        const attempts = Number(job.intentos) + 1; const delay = Math.min(3600, 60 * (2 ** (attempts - 1)));
        console.error(`Fallo de correo ${job.id}: ${error.code || error.name}.`);
        const message = validEmail(config.mailFrom) ? 'Revisa el documento, SMTP y el registro privado del servidor.' : 'Configura MAIL_FROM en el servidor.';
        await query('UPDATE correos SET estado=?,error=?,proximo_intento=DATEADD(SECOND,CONVERT(int,?),SYSUTCDATETIME()),updated_at=SYSUTCDATETIME() WHERE id=?', [attempts >= 5 ? 'fallido' : 'pendiente', message, delay, job.id]); result.fallidos++;
      }
    }
    return result;
  } finally { busy = false; transport.close(); }
}
