# NITECHSPARK Mail — Deployment Guide

## Architecture Overview

```
Internet
   │
   ▼ (Port 25/587/993)
Mail Server (VPS)
├── Postfix (SMTP Sending/Receiving)
├── Dovecot (IMAP)
├── OpenDKIM (DKIM Signing)
└── Fail2Ban (Brute Force Protection)
   │
   ▼ (SMTP/IMAP)
Backend API (Render.com)
├── NestJS + Fastify
├── PostgreSQL (Supabase or Render)
└── Redis (for queues)
   │
   ▼ (REST API)
Frontend (Vercel)
└── Next.js (NITECHSPARK Mail UI)
```

---

## Phase 1: Mail Server Deployment

### Requirements
- Ubuntu 22.04 LTS VPS
- Minimum 1 vCPU, 1GB RAM, 20GB disk
- Dedicated IP address (not shared)
- Domain: nitechspark.site, nskgroups.website

### Setup Steps

```bash
# 1. SSH into your VPS
ssh root@YOUR_MAIL_SERVER_IP

# 2. Clone or upload the infrastructure scripts
git clone https://github.com/nitechspark/mail-server.git
cd mail-server

# 3. Run the setup script
chmod +x infrastructure/mail-server/setup.sh
sudo ./infrastructure/mail-server/setup.sh nitechspark.site

# 4. Note the DKIM key output — add to DNS
# 5. Repeat for nskgroups.website if needed
```

---

## Phase 2: Backend API Deployment (Render)

### Render Setup

1. Create account at https://render.com
2. Create new **Web Service**
3. Connect to your GitHub repository
4. Set root directory: `apps/api`
5. Build command: `npm install && npm run build && npx prisma migrate deploy`
6. Start command: `npm start`
7. Environment: **Node**

### Required Environment Variables on Render

```
DATABASE_URL=postgresql://...          (from Render PostgreSQL or Supabase)
JWT_SECRET=<64-char-random>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
COOKIE_SECRET=<64-char-random>
ENCRYPTION_KEY=<exactly-32-chars>
SMTP_HOST=mail.nitechspark.site
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USERNAME=admin@nitechspark.site
SMTP_PASSWORD=<mail-server-password>
IMAP_HOST=mail.nitechspark.site
IMAP_PORT=993
IMAP_SECURE=true
ALLOWED_ORIGINS=https://mail.nitechspark.site
NODE_ENV=production
```

### Generate secrets
```bash
# JWT_SECRET and COOKIE_SECRET
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_KEY (exactly 32 chars)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### PostgreSQL on Render
1. Create PostgreSQL database on Render
2. Copy the connection string
3. Set as `DATABASE_URL`

---

## Phase 3: Frontend Deployment (Vercel)

### Vercel Setup

1. Create account at https://vercel.com
2. Import Git repository
3. Set root directory: `apps/web`
4. Framework Preset: **Next.js**

### Required Environment Variables on Vercel

```
NEXT_PUBLIC_API_URL=https://your-api.onrender.com/api
```

> ⚠️ NEVER put secrets (JWT_SECRET, ENCRYPTION_KEY, etc.) in NEXT_PUBLIC_ variables.

### Vercel Domain
- Set custom domain: `mail.nitechspark.site`
- Or use: `nitechspark-mail.vercel.app`

---

## Phase 4: DNS Configuration

See `docs/dns.md` for complete DNS record configuration.

Required records:
- MX → mail.nitechspark.site
- A → mail server IP
- SPF TXT
- DKIM TXT
- DMARC TXT
- PTR (at hosting provider)

---

## Phase 5: Local Development

### Prerequisites
- Docker Desktop
- Node.js 20+

### Start local environment
```bash
# Clone repository
git clone <repo>
cd nitechspark-mail

# Copy environment files
cp .env.example .env
cp apps/api/.env.example apps/api/.env

# Edit .env files with your values

# Start all services
docker compose --profile dev up -d

# Install dependencies
npm install

# Generate Prisma client
cd apps/api && npx prisma generate && cd ../..

# Run database migrations
cd apps/api && npx prisma migrate dev && cd ../..

# Seed database
cd apps/api && npm run seed && cd ../..

# Start development servers
npm run dev
```

### Access
- Frontend: http://localhost:3000
- API: http://localhost:4000
- Swagger Docs: http://localhost:4000/api/docs
- Mailpit (test SMTP): http://localhost:8025
- Health: http://localhost:4000/health

### Default credentials (change immediately)
- Admin: admin@nitechspark.site / Admin@NITECHSPARK2024!
- User: nithyananthan@nskgroups.website / User@NITECHSPARK2024!

---

## Production Checklist

```
Security:
□ Change all default passwords
□ Generate new JWT_SECRET (64+ chars)
□ Generate new COOKIE_SECRET (64+ chars)
□ Set ENCRYPTION_KEY (exactly 32 chars)
□ Set NODE_ENV=production
□ Configure CORS (ALLOWED_ORIGINS)

Mail Server:
□ Postfix running and accepting mail
□ Dovecot IMAP working
□ TLS certificate valid
□ DKIM keys generated and DNS configured
□ SPF record configured
□ DMARC record configured (start with p=none)
□ PTR/Reverse DNS configured at hosting provider
□ Test with mail-tester.com (target: 10/10)
□ Fail2ban installed and running

Database:
□ PostgreSQL running
□ Migrations applied
□ Seed data loaded
□ Regular backups configured

API:
□ Health endpoint returning 200
□ SMTP health check passing
□ Rate limiting active
□ Audit logging working

Frontend:
□ NEXT_PUBLIC_API_URL correct
□ Login working
□ Email sending working
□ Email receiving working (IMAP sync)

Monitoring:
□ Set up log aggregation
□ Configure alerts for health endpoint failures
□ Monitor disk usage on mail server
```

---

## Troubleshooting

### Emails not sending
1. Check SMTP credentials: `GET /health/smtp`
2. Check Postfix logs: `tail -f /var/log/mail.log`
3. Verify port 587 is open on firewall
4. Test SMTP: `telnet mail.nitechspark.site 587`

### Emails not receiving
1. Check MX record: `dig MX nitechspark.site`
2. Verify port 25 is open
3. Check Postfix logs: `tail -f /var/log/mail.log`

### IMAP sync not working
1. Check IMAP health: `GET /health/imap`
2. Verify IMAP credentials in mail account settings
3. Check Dovecot logs: `journalctl -u dovecot`

### Emails going to spam
1. Check SPF: `dig TXT nitechspark.site`
2. Check DKIM: `dig TXT mail._domainkey.nitechspark.site`
3. Check DMARC: `dig TXT _dmarc.nitechspark.site`
4. Check PTR: `dig -x YOUR_IP`
5. Test at mail-tester.com
6. Check IP blacklists at mxtoolbox.com/blacklists
