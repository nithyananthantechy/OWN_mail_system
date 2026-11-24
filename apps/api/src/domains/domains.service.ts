import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { CreateDomainDto } from './dto/create-domain.dto';
import * as crypto from 'crypto';
import * as dns from 'dns';
import { DomainVerificationStatus } from '@prisma/client';

export interface DnsCheckItem {
  type: 'MX' | 'SPF' | 'DKIM' | 'DMARC';
  recordName: string;
  expectedValue: string;
  currentValue: string | null;
  isValid: boolean;
  instruction: string;
}

export interface DomainVerificationResult {
  domainId: string;
  domainName: string;
  status: DomainVerificationStatus;
  allValid: boolean;
  checks: DnsCheckItem[];
}

@Injectable()
export class DomainsService {
  private readonly logger = new Logger(DomainsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async getDomains() {
    return this.prisma.domain.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count: {
          select: { mailAccounts: true },
        },
      },
    });
  }

  async getDomainById(id: string) {
    const domain = await this.prisma.domain.findUnique({
      where: { id },
      include: {
        mailAccounts: {
          select: {
            id: true,
            emailAddress: true,
            displayName: true,
            status: true,
            usedQuota: true,
            mailboxQuota: true,
          },
        },
      },
    });
    if (!domain) {
      throw new NotFoundException(`Domain with ID ${id} not found.`);
    }
    return domain;
  }

  async createDomain(dto: CreateDomainDto) {
    const domainName = dto.domainName.trim().toLowerCase();

    const existing = await this.prisma.domain.findUnique({
      where: { domainName },
    });
    if (existing) {
      throw new ConflictException(`Domain ${domainName} is already registered.`);
    }

    // 1. Generate 2048-bit RSA DKIM Keypair
    const { publicKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    // Strip PEM headers and newlines to get clean base64 public key
    const rawPublicKey = publicKey
      .replace(/-----BEGIN PUBLIC KEY-----/g, '')
      .replace(/-----END PUBLIC KEY-----/g, '')
      .replace(/[\r\n\s]/g, '');

    const dkimRecord = `v=DKIM1; k=rsa; p=${rawPublicKey}`;
    const spfRecord = 'v=spf1 mx ~all';
    const dmarcRecord = `v=DMARC1; p=reject; rua=mailto:dmarc@${domainName}; pct=100`;
    const defaultMailHost = this.configService.get<string>('smtp.host') || `mail.${domainName}`;

    return this.prisma.domain.create({
      data: {
        domainName,
        mxRecord: defaultMailHost,
        spfRecord,
        dkimRecord,
        dmarcRecord,
        imapHost: dto.imapHost || this.configService.get<string>('imap.host') || defaultMailHost,
        imapPort: dto.imapPort || this.configService.get<number>('imap.port', 993),
        smtpHost: dto.smtpHost || this.configService.get<string>('smtp.host') || defaultMailHost,
        smtpPort: dto.smtpPort || this.configService.get<number>('smtp.port', 587),
        verificationStatus: DomainVerificationStatus.PENDING,
      },
    });
  }

  async verifyDomainDns(id: string): Promise<DomainVerificationResult> {
    const domain = await this.getDomainById(id);
    const domainName = domain.domainName;
    const checks: DnsCheckItem[] = [];

    const resolver = new dns.promises.Resolver();
    resolver.setServers(['8.8.8.8', '1.1.1.1']); // Use Google & Cloudflare DoH upstream for fresh DNS

    // 1. Check MX Record
    let currentMx: string | null = null;
    let mxValid = false;
    try {
      const mxRecords = await resolver.resolveMx(domainName);
      if (mxRecords && mxRecords.length > 0) {
        currentMx = mxRecords.map((m) => `${m.exchange} (pri:${m.priority})`).join(', ');
        const expectedExchange = (domain.mxRecord || `mail.${domainName}`).toLowerCase();
        mxValid = mxRecords.some((m) => m.exchange.toLowerCase().includes(expectedExchange));
      }
    } catch {
      currentMx = null;
    }
    checks.push({
      type: 'MX',
      recordName: domainName,
      expectedValue: domain.mxRecord || `mail.${domainName}`,
      currentValue: currentMx,
      isValid: mxValid,
      instruction: `Set MX record pointing to ${domain.mxRecord || `mail.${domainName}`} with priority 10`,
    });

    // 2. Check SPF Record (TXT)
    let currentSpf: string | null = null;
    let spfValid = false;
    try {
      const txtRecords = await resolver.resolveTxt(domainName);
      const flattened = txtRecords.map((t) => t.join(''));
      const spf = flattened.find((t) => t.startsWith('v=spf1'));
      if (spf) {
        currentSpf = spf;
        spfValid = spf.includes('mx') || spf.includes('include:');
      }
    } catch {
      currentSpf = null;
    }
    checks.push({
      type: 'SPF',
      recordName: domainName,
      expectedValue: domain.spfRecord || 'v=spf1 mx ~all',
      currentValue: currentSpf,
      isValid: spfValid,
      instruction: `Add TXT record on @ with value: ${domain.spfRecord || 'v=spf1 mx ~all'}`,
    });

    // 3. Check DKIM Record (TXT)
    let currentDkim: string | null = null;
    let dkimValid = false;
    const dkimSelector = `default._domainkey.${domainName}`;
    try {
      const dkimTxt = await resolver.resolveTxt(dkimSelector);
      const flattened = dkimTxt.map((t) => t.join(''));
      const dkim = flattened.find((t) => t.startsWith('v=DKIM1'));
      if (dkim) {
        currentDkim = dkim.substring(0, 40) + '...';
        dkimValid = dkim.includes('p=');
      }
    } catch {
      currentDkim = null;
    }
    checks.push({
      type: 'DKIM',
      recordName: dkimSelector,
      expectedValue: domain.dkimRecord || 'v=DKIM1; ...',
      currentValue: currentDkim,
      isValid: dkimValid,
      instruction: `Add TXT record on default._domainkey with your generated DKIM key`,
    });

    // 4. Check DMARC Record (TXT)
    let currentDmarc: string | null = null;
    let dmarcValid = false;
    const dmarcHost = `_dmarc.${domainName}`;
    try {
      const dmarcTxt = await resolver.resolveTxt(dmarcHost);
      const flattened = dmarcTxt.map((t) => t.join(''));
      const dmarc = flattened.find((t) => t.startsWith('v=DMARC1'));
      if (dmarc) {
        currentDmarc = dmarc;
        dmarcValid = true;
      }
    } catch {
      currentDmarc = null;
    }
    checks.push({
      type: 'DMARC',
      recordName: dmarcHost,
      expectedValue: domain.dmarcRecord || `v=DMARC1; p=reject; rua=mailto:dmarc@${domainName}; pct=100`,
      currentValue: currentDmarc,
      isValid: dmarcValid,
      instruction: `Add TXT record on _dmarc with value: ${domain.dmarcRecord}`,
    });

    const allValid = mxValid && spfValid && dkimValid;
    const status = allValid ? DomainVerificationStatus.VERIFIED : DomainVerificationStatus.FAILED;

    await this.prisma.domain.update({
      where: { id },
      data: { verificationStatus: status },
    });

    return {
      domainId: id,
      domainName,
      status,
      allValid,
      checks,
    };
  }

  async deleteDomain(id: string) {
    await this.getDomainById(id);
    return this.prisma.domain.delete({
      where: { id },
    });
  }
}
