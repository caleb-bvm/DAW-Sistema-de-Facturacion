import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const list = (name) => (process.env[name] || '').split(',').map((value) => value.trim()).filter(Boolean);
export const config = {
  environment: process.env.APP_ENV || 'production',
  origin: process.env.APP_ORIGIN || 'https://localhost',
  basePath: (process.env.APP_BASE_PATH || '').replace(/\/$/, ''),
  host: process.env.HOST || '127.0.0.1', port: Number(process.env.PORT || 3000),
  country: process.env.COUNTRY || 'SV', timezone: process.env.TIMEZONE || 'America/El_Salvador',
  officeNetworks: list('OFFICE_NETWORKS'), trustedProxies: list('TRUSTED_PROXIES'),
  geoipDatabase: process.env.GEOIP_DATABASE || '', sessionMinutes: Number(process.env.SESSION_MINUTES || 30),
  smtp: { host: process.env.SMTP_HOST || '127.0.0.1', port: Number(process.env.SMTP_PORT || 25), secure: process.env.SMTP_SECURE === 'true', requireTLS: process.env.SMTP_REQUIRE_TLS === 'true', user: process.env.SMTP_USER || '', password: process.env.SMTP_PASSWORD || '' },
  mailFrom: process.env.MAIL_FROM || '', adminEmail: process.env.ADMIN_EMAIL || '',
  // Datos ficticios para la empresa de demostración.
  company: {
    nombre: process.env.COMPANY_NAME || 'Zona Digital',
    nit: process.env.COMPANY_NIT || '0614-150326-101-3',
    nrc: process.env.COMPANY_NRC || '345678-9',
    actividad: process.env.COMPANY_ACTIVITY || 'Venta de equipos informáticos, accesorios y servicios de soporte técnico',
    direccion: process.env.COMPANY_ADDRESS || 'Avenida Innovación, edificio Pixel, local 12, San Salvador, El Salvador',
    telefono: process.env.COMPANY_PHONE || '+503 2000-0123',
    correo: process.env.COMPANY_EMAIL || 'contacto@zonadigital.example',
  },
};
