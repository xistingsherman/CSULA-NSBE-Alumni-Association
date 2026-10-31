require('dotenv').config();

const env = process.env;

module.exports = {
  port: env.PORT || 3000,
  production: env.NODE_ENV === 'production',
  siteUrl: (env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  dbClient: env.DB_CLIENT || 'mysql',
  mysql: {
    host: env.MYSQL_HOST || 'localhost',
    port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
  },
  boardEmail: env.BOARD_EMAIL,
  smtp: {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 465),
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
  mailFrom: env.MAIL_FROM || env.SMTP_USER,
  sessionDays: 30,
  // Resumes go to this GCP bucket. Leave empty to keep them in ./uploads (local testing only).
  // Credentials: GOOGLE_APPLICATION_CREDENTIALS = path to the service account's JSON key file.
  gcsBucket: env.GCS_BUCKET || '',
  resumeMaxBytes: 5 * 1024 * 1024,
  tempAdmin: { email: (env.TEMP_ADMIN_EMAIL || '').trim().toLowerCase(), password: env.TEMP_ADMIN_PASSWORD || '' },
};
