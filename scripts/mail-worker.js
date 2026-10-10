import { processMail } from '../server/mail.js';
import { pool } from '../server/db.js';
try { console.log(JSON.stringify(await processMail())); } finally { await pool.end(); }
