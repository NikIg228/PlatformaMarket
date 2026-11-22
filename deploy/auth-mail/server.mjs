import nodemailer from 'nodemailer';
import { createRelay, smtpOptions } from './relay.mjs';
const options = smtpOptions(process.env.RESEND_SMTP_PASSWORD);
const server = createRelay({ token: process.env.AUTH_MAIL_RELAY_TOKEN, sendMail: async message => {
  const transport = nodemailer.createTransport(options);
  let timer;
  try {
    return await Promise.race([transport.sendMail(message), new Promise((_, reject) => {
      timer = setTimeout(() => { transport.close(); reject(new Error('SMTP deadline')); }, 9000);
    })]);
  } finally { clearTimeout(timer); transport.close(); }
} });
server.listen(8091, process.env.RELAY_HOST || '0.0.0.0', () => console.log('Auth mail relay ready'));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
