import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';

export function smtpOptions(password) {
  if (typeof password !== 'string' || !/^re_[A-Za-z0-9_-]{20,}$/.test(password)) throw new Error('SMTP credential required');
  return { host: 'smtp.resend.com', port: 465, secure: true,
    auth: { user: 'resend', pass: password }, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
    connectionTimeout: 5000, greetingTimeout: 5000, socketTimeout: 10000,
    disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false };
}

export function createRelay({ token, sendMail, now = Date.now }) {
  if (typeof token !== 'string' || token.length < 32) throw new Error('Relay token required');
  const expected = Buffer.from(`Bearer ${token}`);
  let windowStart = now(), requests = 0;
  return createServer({ requestTimeout: 15000, headersTimeout: 10000, maxHeaderSize: 8192 }, async (req, res) => {
    const reply = (status, code) => { if (!res.destroyed) { res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify({ code })); } };
    if (req.url === '/health' && req.method === 'GET') return reply(200, 'READY');
    if (req.url !== '/send' || req.method !== 'POST') return reply(404, 'NOT_FOUND');
    const supplied = Buffer.from(req.headers.authorization || '');
    if (supplied.length !== expected.length || !timingSafeEqual(expected, supplied)) return reply(401, 'UNAUTHORIZED');
    if (now() - windowStart >= 60000) { windowStart = now(); requests = 0; }
    if (++requests > 20) return reply(429, 'RATE_LIMITED');
    if (req.headers['content-type'] !== 'application/json') return reply(415, 'JSON_REQUIRED');
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 16384) { reply(413, 'TOO_LARGE'); return; } chunks.push(chunk); }
      let message;
      try { message = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(400, 'INVALID_MESSAGE'); }
      if (!message || typeof message !== 'object' || Object.keys(message).sort().join(',') !== 'subject,text,to' ||
        typeof message.to !== 'string' || message.to.length > 254 || !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(message.to) ||
        typeof message.subject !== 'string' || !message.subject.trim() || message.subject.length > 200 || /[\r\n]/.test(message.subject) ||
        typeof message.text !== 'string' || !message.text.trim() || message.text.length > 12000) return reply(400, 'INVALID_MESSAGE');
      const result = await sendMail({ from: { name: 'Platforma Market', address: 'no-reply@notify.platformamarket.kz' },
        to: [{ address: message.to }], subject: message.subject, text: message.text,
        disableFileAccess: true, disableUrlAccess: true });
      if (!result?.accepted?.length || result.rejected?.length) return reply(502, 'DELIVERY_UNCONFIRMED');
      reply(200, 'SMTP_ACCEPTED');
    } catch { reply(502, 'DELIVERY_UNCONFIRMED'); }
  });
}
