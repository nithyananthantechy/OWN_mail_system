export const configuration = () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL,
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  cookie: {
    secret: process.env.COOKIE_SECRET,
  },

  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    username: process.env.SMTP_USERNAME,
    password: process.env.SMTP_PASSWORD,
    fromName: process.env.SMTP_FROM_NAME || 'NITECHSPARK Mail',
  },

  smtpRelay: {
    enabled: process.env.SMTP_RELAY_ENABLED === 'true',
    host: process.env.SMTP_RELAY_HOST,
    port: parseInt(process.env.SMTP_RELAY_PORT || '587', 10),
    secure: process.env.SMTP_RELAY_SECURE === 'true',
    username: process.env.SMTP_RELAY_USERNAME,
    password: process.env.SMTP_RELAY_PASSWORD,
    mode: process.env.SMTP_RELAY_MODE || 'fallback', // 'fallback' | 'always'
  },

  imap: {
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    secure: process.env.IMAP_SECURE !== 'false',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  allowedOrigins: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',

  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },

  attachments: {
    maxSizeMb: parseInt(process.env.MAX_ATTACHMENT_SIZE_MB || '25', 10),
    allowedMimes: (
      process.env.ALLOWED_MIME_TYPES ||
      'image/jpeg,image/png,image/gif,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,application/zip,application/x-zip-compressed'
    ).split(','),
    uploadDir: process.env.UPLOAD_DIR || '/tmp/nitechspark-mail/attachments',
  },

  mailSync: {
    intervalMs: parseInt(process.env.MAIL_SYNC_INTERVAL_MS || '60000', 10), // 1 minute
    batchSize: parseInt(process.env.MAIL_SYNC_BATCH_SIZE || '50', 10),
  },
});
