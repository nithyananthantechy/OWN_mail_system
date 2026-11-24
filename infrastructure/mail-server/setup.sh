#!/bin/bash
# ============================================================
# NITECHSPARK Mail Server Setup Script
# Installs and configures: Postfix + Dovecot + OpenDKIM + Rspamd
# Target: Ubuntu 22.04 LTS
# ============================================================

set -euo pipefail

DOMAIN="${1:-nitechspark.site}"
MAIL_HOSTNAME="mail.${DOMAIN}"
ADMIN_EMAIL="admin@${DOMAIN}"

echo "============================================"
echo "NITECHSPARK Mail Server Setup"
echo "Domain: ${DOMAIN}"
echo "Hostname: ${MAIL_HOSTNAME}"
echo "============================================"

# ---- Update system ----
echo "[1/10] Updating system..."
apt-get update -qq
apt-get upgrade -y -qq

# ---- Set hostname ----
echo "[2/10] Setting hostname..."
hostnamectl set-hostname "${MAIL_HOSTNAME}"
echo "127.0.0.1 ${MAIL_HOSTNAME} ${MAIL_HOSTNAME%%.*}" >> /etc/hosts

# ---- Install packages ----
echo "[3/10] Installing mail server packages..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  postfix postfix-mysql \
  dovecot-core dovecot-imapd dovecot-lmtpd dovecot-mysql \
  opendkim opendkim-tools \
  opendmarc \
  certbot \
  fail2ban \
  ufw \
  curl \
  mailutils

# ---- Configure UFW firewall ----
echo "[4/10] Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 25/tcp    # SMTP
ufw allow 587/tcp   # SMTP Submission
ufw allow 465/tcp   # SMTP SSL
ufw allow 993/tcp   # IMAPS
ufw allow 143/tcp   # IMAP
ufw allow 80/tcp    # HTTP (for certbot)
ufw allow 443/tcp   # HTTPS
ufw --force enable

# ---- Get TLS certificate ----
echo "[5/10] Obtaining TLS certificate..."
certbot certonly --standalone \
  --non-interactive \
  --agree-tos \
  --email "${ADMIN_EMAIL}" \
  -d "${MAIL_HOSTNAME}" || {
    echo "WARNING: certbot failed. Manual certificate installation required."
  }

# ---- Configure Postfix ----
echo "[6/10] Configuring Postfix..."
postconf -e "myhostname = ${MAIL_HOSTNAME}"
postconf -e "mydomain = ${DOMAIN}"
postconf -e "myorigin = \$mydomain"
postconf -e "inet_interfaces = all"
postconf -e "mydestination = \$myhostname, localhost.\$mydomain, localhost"
postconf -e "mynetworks = 127.0.0.0/8"
postconf -e "mailbox_size_limit = 0"
postconf -e "recipient_delimiter = +"
postconf -e "inet_protocols = all"

# TLS settings
postconf -e "smtpd_tls_cert_file = /etc/letsencrypt/live/${MAIL_HOSTNAME}/fullchain.pem"
postconf -e "smtpd_tls_key_file = /etc/letsencrypt/live/${MAIL_HOSTNAME}/privkey.pem"
postconf -e "smtpd_use_tls = yes"
postconf -e "smtpd_tls_auth_only = yes"
postconf -e "smtp_tls_security_level = may"
postconf -e "smtpd_tls_security_level = may"
postconf -e "smtpd_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1"
postconf -e "smtp_tls_protocols = !SSLv2, !SSLv3, !TLSv1, !TLSv1.1"

# DKIM
postconf -e "milter_default_action = accept"
postconf -e "milter_protocol = 6"
postconf -e "smtpd_milters = inet:localhost:8891"
postconf -e "non_smtpd_milters = inet:localhost:8891"

# ---- Configure Dovecot ----
echo "[7/10] Configuring Dovecot..."
cat > /etc/dovecot/conf.d/10-mail.conf << 'EOF'
mail_location = maildir:~/Maildir
namespace inbox {
  inbox = yes
}
EOF

cat > /etc/dovecot/conf.d/10-ssl.conf << EOF
ssl = required
ssl_cert = </etc/letsencrypt/live/${MAIL_HOSTNAME}/fullchain.pem
ssl_key = </etc/letsencrypt/live/${MAIL_HOSTNAME}/privkey.pem
ssl_min_protocol = TLSv1.2
ssl_prefer_server_ciphers = yes
EOF

cat > /etc/dovecot/conf.d/10-auth.conf << 'EOF'
auth_mechanisms = plain login
!include auth-system.conf.ext
EOF

# ---- Configure OpenDKIM ----
echo "[8/10] Configuring OpenDKIM..."
mkdir -p "/etc/opendkim/keys/${DOMAIN}"

cat > /etc/opendkim.conf << EOF
AutoRestart             Yes
AutoRestartRate         10/1h
UMask                   002
Syslog                  yes
LogWhy                  Yes
Canonicalization        relaxed/simple
ExternalIgnoreList      refile:/etc/opendkim/TrustedHosts
InternalHosts           refile:/etc/opendkim/TrustedHosts
KeyTable                refile:/etc/opendkim/KeyTable
SigningTable            refile:/etc/opendkim/SigningTable
Mode                    sv
PidFile                 /var/run/opendkim/opendkim.pid
SignatureAlgorithm      rsa-sha256
UserID                  opendkim:opendkim
Socket                  inet:8891@localhost
EOF

cat > /etc/opendkim/TrustedHosts << EOF
127.0.0.1
localhost
${DOMAIN}
*.${DOMAIN}
EOF

cat > /etc/opendkim/KeyTable << EOF
mail._domainkey.${DOMAIN} ${DOMAIN}:mail:/etc/opendkim/keys/${DOMAIN}/mail.private
EOF

cat > /etc/opendkim/SigningTable << EOF
*@${DOMAIN} mail._domainkey.${DOMAIN}
EOF

# Generate DKIM keys
opendkim-genkey -t -s mail -d "${DOMAIN}" -D "/etc/opendkim/keys/${DOMAIN}/"
chown -R opendkim:opendkim /etc/opendkim/keys/
chmod 600 "/etc/opendkim/keys/${DOMAIN}/mail.private"

echo ""
echo "============================================"
echo "DKIM Public Key (add to DNS):"
echo "============================================"
cat "/etc/opendkim/keys/${DOMAIN}/mail.txt"
echo ""

# ---- Configure fail2ban ----
echo "[9/10] Configuring fail2ban..."
cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[postfix]
enabled = true

[dovecot]
enabled = true
EOF

# ---- Start and enable services ----
echo "[10/10] Starting services..."
systemctl restart postfix dovecot opendkim fail2ban
systemctl enable postfix dovecot opendkim fail2ban

echo ""
echo "============================================"
echo "Mail Server Setup COMPLETE!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Add the DKIM public key shown above to your DNS"
echo "2. Configure your domain's MX, SPF, DMARC records (see docs/dns.md)"
echo "3. Test with: mail-tester.com and mxtoolbox.com"
echo "4. Set up mail accounts using the NITECHSPARK Mail admin panel"
echo ""
echo "Services running:"
systemctl status postfix --no-pager | grep "active"
systemctl status dovecot --no-pager | grep "active"
echo ""
echo "Logs:"
echo "  Postfix: /var/log/mail.log"
echo "  Dovecot: /var/log/dovecot.log"
