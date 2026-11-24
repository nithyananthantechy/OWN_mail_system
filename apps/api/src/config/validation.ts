import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(4000),

  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  COOKIE_SECRET: Joi.string().min(32).required(),
  ENCRYPTION_KEY: Joi.string().length(32).required(),

  // Optional - show warning if not configured
  SMTP_HOST: Joi.string().optional().allow(''),
  SMTP_PORT: Joi.number().default(587),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USERNAME: Joi.string().optional().allow(''),
  SMTP_PASSWORD: Joi.string().optional().allow(''),
  SMTP_FROM_NAME: Joi.string().default('NITECHSPARK Mail'),

  SMTP_RELAY_ENABLED: Joi.boolean().default(false),
  SMTP_RELAY_HOST: Joi.string().optional().allow(''),
  SMTP_RELAY_PORT: Joi.number().default(587),
  SMTP_RELAY_SECURE: Joi.boolean().default(false),
  SMTP_RELAY_USERNAME: Joi.string().optional().allow(''),
  SMTP_RELAY_PASSWORD: Joi.string().optional().allow(''),
  SMTP_RELAY_MODE: Joi.string().valid('fallback', 'always').default('fallback'),

  IMAP_HOST: Joi.string().optional(),
  IMAP_PORT: Joi.number().default(993),
  IMAP_SECURE: Joi.boolean().default(true),

  REDIS_URL: Joi.string().default('redis://localhost:6379'),

  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),

  THROTTLE_TTL: Joi.number().default(60000),
  THROTTLE_LIMIT: Joi.number().default(100),

  MAX_ATTACHMENT_SIZE_MB: Joi.number().default(25),
  UPLOAD_DIR: Joi.string().default('/tmp/nitechspark-mail/attachments'),

  MAIL_SYNC_INTERVAL_MS: Joi.number().default(60000),
  MAIL_SYNC_BATCH_SIZE: Joi.number().default(50),
});
