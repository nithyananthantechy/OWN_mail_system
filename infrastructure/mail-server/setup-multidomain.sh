#!/bin/bash
# ============================================================
# NITECHSPARK Multi-Domain Mail Server Setup
# Production-ready Postfix (SMTP) + Dovecot (IMAP/LMTP) + PostgreSQL Lookups
# Target OS: Ubuntu 22.04 / 24.04 LTS
# ============================================================

set -euo pipefail

PRIMARY_HOSTNAME="${1:-mail.nitechspark.site}"
DB_NAME="${2:-nitechspark_mail}"
DB_USER="${3:-nitechspark}"
DB_PASS="${4:-changeme_development}"

echo "=========================================================="
echo "Configuring Multi-Domain NITECHSPARK Mail Server..."
echo "Hostname: ${PRIMARY_HOSTNAME}"
echo "Database: ${DB_NAME} (User: ${DB_USER})"
echo "=========================================================="

# 1. Install prerequisites
DEBIAN_FRONTEND=noninteractive apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  postfix postfix-pgsql \
  dovecot-core dovecot-imapd dovecot-lmtpd dovecot-pgsql \
  opendkim opendkim-tools opendmarc \
  certbot fail2ban ufw

# 2. Create virtual mail user and directory
VMAIL_UID=5000
VMAIL_GID=5000
groupadd -g ${VMAIL_GID} vmail || true
useradd -r -u ${VMAIL_UID} -g vmail -d /var/mail/vhosts -m -s /sbin/nologin vmail || true
mkdir -p /var/mail/vhosts
chown -R vmail:vmail /var/mail/vhosts
chmod -R 770 /var/mail/vhosts

# 3. Deploy PostgreSQL lookup maps to Postfix
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cp "${SCRIPT_DIR}/pgsql-virtual-mailbox-domains.cf" /etc/postfix/
cp "${SCRIPT_DIR}/pgsql-virtual-mailbox-maps.cf" /etc/postfix/
cp "${SCRIPT_DIR}/pgsql-virtual-alias-maps.cf" /etc/postfix/
chmod 640 /etc/postfix/pgsql-*.cf
chown root:postfix /etc/postfix/pgsql-*.cf

# Replace database credentials in maps
sed -i "s/dbname = .*/dbname = ${DB_NAME}/" /etc/postfix/pgsql-*.cf
sed -i "s/user = .*/user = ${DB_USER}/" /etc/postfix/pgsql-*.cf
sed -i "s/password = .*/password = ${DB_PASS}/" /etc/postfix/pgsql-*.cf

# 4. Configure Postfix for Multi-Tenant Virtual Mailboxes
postconf -e "myhostname = ${PRIMARY_HOSTNAME}"
postconf -e "mydestination = localhost"
postconf -e "virtual_mailbox_domains = pgsql:/etc/postfix/pgsql-virtual-mailbox-domains.cf"
postconf -e "virtual_mailbox_maps = pgsql:/etc/postfix/pgsql-virtual-mailbox-maps.cf"
postconf -e "virtual_alias_maps = pgsql:/etc/postfix/pgsql-virtual-alias-maps.cf"
postconf -e "virtual_mailbox_base = /var/mail/vhosts"
postconf -e "virtual_minimum_uid = 100"
postconf -e "virtual_uid_maps = static:${VMAIL_UID}"
postconf -e "virtual_gid_maps = static:${VMAIL_GID}"
postconf -e "virtual_transport = lmtp:unix:private/dovecot-lmtp"

# SASL Authentication via Dovecot
postconf -e "smtpd_sasl_type = dovecot"
postconf -e "smtpd_sasl_path = private/auth"
postconf -e "smtpd_sasl_auth_enable = yes"
postconf -e "smtpd_recipient_restrictions = permit_sasl_authenticated, permit_mynetworks, reject_unauth_destination"

# 5. Configure Dovecot SQL
cp "${SCRIPT_DIR}/dovecot-sql.conf.ext" /etc/dovecot/
sed -i "s/dbname=.* user=.* password=.*/dbname=${DB_NAME} user=${DB_USER} password=${DB_PASS}/" /etc/dovecot/dovecot-sql.conf.ext
chmod 600 /etc/dovecot/dovecot-sql.conf.ext
chown root:root /etc/dovecot/dovecot-sql.conf.ext

# Enable SQL in Dovecot 10-auth.conf
sed -i 's/#!include auth-sql.conf.ext/!include auth-sql.conf.ext/' /etc/dovecot/conf.d/10-auth.conf

# 6. Restart Services
systemctl restart postfix dovecot
systemctl enable postfix dovecot

echo "=========================================================="
echo "Multi-Domain Postfix + Dovecot configuration complete!"
echo "Any new domain added to the database is now dynamically served."
echo "=========================================================="
