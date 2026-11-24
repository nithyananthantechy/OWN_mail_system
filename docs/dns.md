# NITECHSPARK Mail — DNS Configuration Guide

## Required DNS Records

Configure these DNS records for each domain you want to use with NITECHSPARK Mail.

---

## 1. MX Record (Mail Exchange)

Tells the internet where to deliver email for your domain.

| Type | Name | Value | Priority | TTL |
|------|------|-------|----------|-----|
| MX | nitechspark.site | mail.nitechspark.site | 10 | 3600 |

---

## 2. A Record (Mail Server IP)

Points your mail subdomain to your server.

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | mail.nitechspark.site | YOUR_MAIL_SERVER_IP | 3600 |

> Replace `YOUR_MAIL_SERVER_IP` with the actual IP address of your VPS/dedicated server.

---

## 3. SPF Record (Sender Policy Framework)

Prevents spammers from sending email on behalf of your domain.

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | nitechspark.site | v=spf1 mx a:mail.nitechspark.site ~all | 3600 |

**Explanation:**
- `v=spf1` — SPF version
- `mx` — Allow the MX server to send mail
- `a:mail.nitechspark.site` — Allow the mail subdomain IP
- `~all` — Soft fail (recommend; use `-all` for strict rejection)

---

## 4. DKIM Record (DomainKeys Identified Mail)

Cryptographically signs outgoing email to prove authenticity.

**Step 1: Generate DKIM keys on your mail server:**
```bash
# On your Postfix/OpenDKIM server
sudo openssl genrsa -out /etc/opendkim/keys/nitechspark.site/mail.private 2048
sudo openssl rsa -in /etc/opendkim/keys/nitechspark.site/mail.private -pubout -out /etc/opendkim/keys/nitechspark.site/mail.public
```

**Step 2: Get the public key value:**
```bash
sudo cat /etc/opendkim/keys/nitechspark.site/mail.txt
```

**Step 3: Add the DNS record:**

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | mail._domainkey.nitechspark.site | v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE | 3600 |

> The `p=` value comes from your generated public key (remove headers, whitespace, newlines).

---

## 5. DMARC Record (Domain-based Message Authentication)

Tells receiving mail servers what to do with emails that fail SPF/DKIM.

| Type | Name | Value | TTL |
|------|------|-------|-----|
| TXT | _dmarc.nitechspark.site | v=DMARC1; p=quarantine; rua=mailto:dmarc@nitechspark.site; ruf=mailto:dmarc@nitechspark.site; fo=1; adkim=r; aspf=r | 3600 |

**Policy options:**
- `p=none` — Monitor only (start here)
- `p=quarantine` — Send failing emails to spam
- `p=reject` — Reject failing emails (use when confident)

**Recommended rollout:**
1. Start with `p=none` for 2-4 weeks
2. Monitor DMARC reports at `dmarc@nitechspark.site`
3. Move to `p=quarantine`
4. Finally move to `p=reject`

---

## 6. PTR Record (Reverse DNS)

Critical for deliverability — must be set at your hosting provider/ISP.

| Type | Value |
|------|-------|
| PTR | mail.nitechspark.site |

> Contact your VPS provider to set the reverse DNS for YOUR_MAIL_SERVER_IP.

---

## 7. AAAA Record (IPv6 — if applicable)

| Type | Name | Value | TTL |
|------|------|-------|-----|
| AAAA | mail.nitechspark.site | YOUR_IPv6_ADDRESS | 3600 |

---

## Complete DNS Checklist

```
□ MX record pointing to mail.nitechspark.site
□ A record for mail.nitechspark.site → server IP
□ SPF TXT record on root domain
□ DKIM TXT record on mail._domainkey subdomain
□ DMARC TXT record on _dmarc subdomain
□ PTR/Reverse DNS set at hosting provider
□ TLS certificate installed (Let's Encrypt recommended)
```

---

## Verification Commands

Run these on your server or use MXToolbox:

```bash
# Check MX
dig MX nitechspark.site

# Check SPF
dig TXT nitechspark.site

# Check DKIM
dig TXT mail._domainkey.nitechspark.site

# Check DMARC
dig TXT _dmarc.nitechspark.site

# Check PTR
dig -x YOUR_MAIL_SERVER_IP

# Check MX is reachable
telnet mail.nitechspark.site 25
```

---

## nskgroups.website Configuration

Repeat ALL the above steps for `nskgroups.website`:

| Record | Name | Value |
|--------|------|-------|
| MX | nskgroups.website | mail.nskgroups.website |
| A | mail.nskgroups.website | YOUR_MAIL_SERVER_IP |
| TXT (SPF) | nskgroups.website | v=spf1 mx ~all |
| TXT (DKIM) | mail._domainkey.nskgroups.website | v=DKIM1; k=rsa; p=... |
| TXT (DMARC) | _dmarc.nskgroups.website | v=DMARC1; p=quarantine; ... |

> Note: Both domains can share the same mail server.

---

## Important Notes

1. **DNS propagation** takes 24–48 hours globally
2. **Don't use port 25 for sending** if on a residential IP (ISPs block it)
3. **IP reputation takes time** — new IPs may be flagged as spam initially
4. **Use reputable hosting** — some IP ranges have permanent blacklistings
5. **Always test with mail-tester.com** before going live
