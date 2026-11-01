const config = require('./config');

// nodemailer is only loaded when email is configured (it needs Node 20+).
const transport = config.smtp.host
  ? require('nodemailer').createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  })
  : null;

// Sends in the background; a failed email never fails the request that triggered it.
// Replies go to MAIL_REPLY_TO (e.g. info@), since the From address (noreply@) isn't read.
function send({ to, subject, text }) {
  if (!to) return;
  if (!transport) {
    console.log(`[email not sent: SMTP_HOST is empty]\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
    return;
  }
  transport.sendMail({ from: config.mailFrom, replyTo: config.mailReplyTo || undefined, to, subject, text })
    .catch((err) => console.error('Email failed:', err.message));
}

module.exports = { send };
