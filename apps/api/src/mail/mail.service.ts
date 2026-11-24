import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailProvider } from '../mail-provider/mail-provider.interface';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { JSDOM } from 'jsdom';
import { SendMailDto } from './dto/send-mail.dto';
import { SyncService } from '../sync/sync.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailProvider: MailProvider,
    private readonly configService: ConfigService,
    private readonly syncService: SyncService,
    private readonly auditService: AuditService,
  ) {}

  // ---- Inbox ----

  async getInbox(userId: string, mailAccountId: string, page = 1, limit = 50) {
    const mailAccount = await this.getMailAccount(userId, mailAccountId);
    const folder = await this.getOrCreateSystemFolder(mailAccountId, 'INBOX');

    const skip = (page - 1) * limit;
    const [emails, total] = await Promise.all([
      this.prisma.emailMetadata.findMany({
        where: { mailAccountId, folderId: folder.id },
        skip,
        take: limit,
        orderBy: { emailDate: 'desc' },
        include: { attachments: { select: { id: true, filename: true, size: true, mimeType: true } } },
      }),
      this.prisma.emailMetadata.count({ where: { mailAccountId, folderId: folder.id } }),
    ]);

    void mailAccount; // suppress unused warning

    return {
      emails: emails.map((e) => this.formatEmailListItem(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    };
  }

  async getFolderEmails(userId: string, mailAccountId: string, folderNameOrType: string, page = 1, limit = 50) {
    await this.getMailAccount(userId, mailAccountId);
    const upper = folderNameOrType.toUpperCase();
    const systemTypes = ['INBOX', 'SENT', 'DRAFTS', 'SPAM', 'TRASH', 'ARCHIVE'];

    let folder = null;
    if (systemTypes.includes(upper)) {
      folder = await this.getOrCreateSystemFolder(mailAccountId, upper);
    } else {
      folder = await this.prisma.mailFolder.findFirst({
        where: {
          mailAccountId,
          OR: [
            { id: folderNameOrType },
            { name: { equals: folderNameOrType, mode: 'insensitive' } },
            { displayName: { equals: folderNameOrType, mode: 'insensitive' } },
          ],
        },
      });
    }

    if (!folder) {
      return { emails: [], total: 0, page, limit, totalPages: 1, hasMore: false };
    }

    const skip = (page - 1) * limit;
    const [emails, total] = await Promise.all([
      this.prisma.emailMetadata.findMany({
        where: { mailAccountId, folderId: folder.id },
        skip,
        take: limit,
        orderBy: { emailDate: 'desc' },
        include: { attachments: { select: { id: true, filename: true, size: true, mimeType: true } } },
      }),
      this.prisma.emailMetadata.count({ where: { mailAccountId, folderId: folder.id } }),
    ]);

    return {
      emails: emails.map((e) => this.formatEmailListItem(e)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    };
  }

  async getEmail(userId: string, emailId: string, includeBody = true) {
    const email = await this.prisma.emailMetadata.findUnique({
      where: { id: emailId },
      include: {
        mailAccount: { include: { domain: true } },
        attachments: true,
        folder: true,
      },
    });

    if (!email) throw new NotFoundException('Email not found.');
    if (email.mailAccount.userId !== userId)
      throw new ForbiddenException('Access denied.');

    // Fetch body from IMAP if needed
    let bodyHtml: string | null = null;
    let bodyText: string | null = null;

    if (includeBody) {
      try {
        const credentials = await this.getImapCredentials(email.mailAccount);
        if (credentials) {
          const imapMessage = await this.mailProvider.getMessage(
            credentials,
            email.folder.imapPath,
            email.uid,
            true,
          );
          if (imapMessage) {
            bodyText = imapMessage.bodyText || null;
            bodyHtml = imapMessage.bodyHtml
              ? this.sanitizeHtml(imapMessage.bodyHtml)
              : null;
          }
        }
      } catch (err: unknown) {
        const error = err as Error;
        this.logger.warn(`Could not fetch body for email ${emailId}: ${error.message}`);
      }

      // Mark as read
      if (!email.isRead) {
        await this.markAsRead(userId, [emailId]);
      }
    }

    return {
      ...this.formatEmailListItem(email),
      bodyText,
      bodyHtml,
      attachments: email.attachments,
    };
  }

  async sendEmail(userId: string, dto: SendMailDto) {
    const mailAccount = await this.getMailAccount(userId, dto.mailAccountId);
    const smtpProvider = this.mailProvider as MailProvider & { isSmtpConfigured?: boolean };

    if (!('isSmtpConfigured' in smtpProvider) || !smtpProvider.isSmtpConfigured) {
      throw new BadRequestException(
        'SMTP is not configured. Email sending is unavailable. Please configure SMTP settings.',
      );
    }

    // Validate recipients
    if (!dto.to || dto.to.length === 0) {
      throw new BadRequestException('At least one recipient is required.');
    }

    const result = await this.mailProvider.sendEmail({
      from: {
        name: mailAccount.displayName || mailAccount.emailAddress,
        address: mailAccount.emailAddress,
      },
      to: dto.to.map((addr) => ({ address: addr })),
      cc: dto.cc?.map((addr) => ({ address: addr })),
      bcc: dto.bcc?.map((addr) => ({ address: addr })),
      subject: dto.subject || '(No Subject)',
      text: dto.bodyText,
      html: dto.bodyHtml,
      inReplyTo: dto.inReplyTo,
      references: dto.references,
    });

    if (!result.success) {
      if (result.temporaryFailure) {
        throw new BadRequestException(
          'Failed to send email due to a temporary server issue. Please try again in a moment.',
        );
      }
      throw new BadRequestException(
        result.error || 'Failed to send email. Please check your settings and try again.',
      );
    }

    await this.auditService.log({
      userId,
      action: 'MAIL_SENT',
      metadata: {
        messageId: result.messageId,
        recipientCount: dto.to.length,
        mailAccountId: mailAccount.id,
      },
      success: true,
    });

    return { messageId: result.messageId };
  }

  async markAsRead(userId: string, emailIds: string[]) {
    await this.updateEmailFlags(userId, emailIds, { isRead: true });
  }

  async markAsUnread(userId: string, emailIds: string[]) {
    await this.updateEmailFlags(userId, emailIds, { isRead: false });
  }

  async starEmail(userId: string, emailIds: string[]) {
    await this.updateEmailFlags(userId, emailIds, { isStarred: true });
  }

  async unstarEmail(userId: string, emailIds: string[]) {
    await this.updateEmailFlags(userId, emailIds, { isStarred: false });
  }

  async archiveEmail(userId: string, emailIds: string[]) {
    await this.updateEmailFlags(userId, emailIds, { isArchived: true });
  }

  async deleteEmail(userId: string, emailIds: string[], permanent = false) {
    const emails = await this.validateEmailAccess(userId, emailIds);

    for (const email of emails) {
      try {
        const credentials = await this.getImapCredentials(email.mailAccount);
        if (credentials) {
          await this.mailProvider.deleteMessage(
            credentials,
            email.folder.imapPath,
            [email.uid],
            permanent,
          );
        }
      } catch (err: unknown) {
        const error = err as Error;
        this.logger.warn(`IMAP delete failed for ${email.id}: ${error.message}`);
      }
    }

    if (permanent) {
      await this.prisma.emailMetadata.deleteMany({
        where: { id: { in: emailIds } },
      });
    }
  }

  async moveEmail(userId: string, emailIds: string[], targetFolderId: string) {
    const emails = await this.validateEmailAccess(userId, emailIds);
    const targetFolder = await this.prisma.mailFolder.findUnique({
      where: { id: targetFolderId },
    });
    if (!targetFolder) throw new NotFoundException('Target folder not found.');

    for (const email of emails) {
      try {
        const credentials = await this.getImapCredentials(email.mailAccount);
        if (credentials) {
          await this.mailProvider.moveMessage(
            credentials,
            email.folder.imapPath,
            targetFolder.imapPath,
            [email.uid],
          );
        }
      } catch (err: unknown) {
        const error = err as Error;
        this.logger.warn(`IMAP move failed for ${email.id}: ${error.message}`);
      }
    }

    await this.prisma.emailMetadata.updateMany({
      where: { id: { in: emailIds } },
      data: { folderId: targetFolderId },
    });
  }

  async saveDraft(userId: string, dto: SendMailDto, draftId?: string) {
    const mailAccount = await this.getMailAccount(userId, dto.mailAccountId);
    const draftsFolder = await this.getOrCreateSystemFolder(mailAccount.id, 'DRAFTS');

    if (draftId) {
      // Update existing draft
      await this.prisma.emailMetadata.update({
        where: { id: draftId },
        data: {
          subject: dto.subject || '(No Subject)',
          toAddresses: dto.to?.map((a) => ({ address: a })) || [],
          ccAddresses: dto.cc?.map((a) => ({ address: a })) || [],
          bccAddresses: dto.bcc?.map((a) => ({ address: a })) || [],
          isDraft: true,
          syncedAt: new Date(),
        },
      });
      return { id: draftId };
    }

    const draft = await this.prisma.emailMetadata.create({
      data: {
        mailAccountId: mailAccount.id,
        folderId: draftsFolder.id,
        uid: 0,
        fromAddress: mailAccount.emailAddress,
        fromName: mailAccount.displayName || mailAccount.emailAddress,
        toAddresses: dto.to?.map((a) => ({ address: a })) || [],
        ccAddresses: dto.cc?.map((a) => ({ address: a })) || [],
        bccAddresses: dto.bcc?.map((a) => ({ address: a })) || [],
        subject: dto.subject || '(No Subject)',
        isDraft: true,
        isRead: true,
      },
    });

    return { id: draft.id };
  }

  async getStarred(userId: string, mailAccountId: string, page = 1, limit = 50) {
    await this.getMailAccount(userId, mailAccountId);
    const skip = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      this.prisma.emailMetadata.findMany({
        where: { mailAccountId, isStarred: true },
        skip,
        take: limit,
        orderBy: { emailDate: 'desc' },
      }),
      this.prisma.emailMetadata.count({ where: { mailAccountId, isStarred: true } }),
    ]);

    return { emails: emails.map(this.formatEmailListItem), total, page, limit };
  }

  // ---- Private Helpers ----

  private async getMailAccount(userId: string, mailAccountId: string) {
    const account = await this.prisma.mailAccount.findFirst({
      where: { id: mailAccountId, userId, status: 'ACTIVE' },
      include: { domain: true },
    });
    if (!account) throw new NotFoundException('Mail account not found.');
    return account;
  }

  private async getOrCreateSystemFolder(mailAccountId: string, type: string) {
    let folder = await this.prisma.mailFolder.findFirst({
      where: { mailAccountId, type: type as never },
    });

    if (!folder) {
      const names: Record<string, { name: string; displayName: string; imapPath: string }> = {
        INBOX: { name: 'INBOX', displayName: 'Inbox', imapPath: 'INBOX' },
        SENT: { name: 'Sent', displayName: 'Sent', imapPath: 'Sent' },
        DRAFTS: { name: 'Drafts', displayName: 'Drafts', imapPath: 'Drafts' },
        SPAM: { name: 'Junk', displayName: 'Spam', imapPath: 'Junk' },
        TRASH: { name: 'Trash', displayName: 'Trash', imapPath: 'Trash' },
        ARCHIVE: { name: 'Archive', displayName: 'Archive', imapPath: 'Archive' },
      };

      const config = names[type] || { name: type, displayName: type, imapPath: type };
      folder = await this.prisma.mailFolder.create({
        data: {
          mailAccountId,
          name: config.name,
          displayName: config.displayName,
          type: type as never,
          imapPath: config.imapPath,
        },
      });
    }

    return folder;
  }

  private async validateEmailAccess(userId: string, emailIds: string[]) {
    const emails = await this.prisma.emailMetadata.findMany({
      where: { id: { in: emailIds } },
      include: { mailAccount: { include: { domain: true } }, folder: true },
    });

    for (const email of emails) {
      if (email.mailAccount.userId !== userId) throw new ForbiddenException('Access denied.');
    }

    return emails;
  }

  private async updateEmailFlags(
    userId: string,
    emailIds: string[],
    data: Partial<{ isRead: boolean; isStarred: boolean; isArchived: boolean }>,
  ) {
    await this.validateEmailAccess(userId, emailIds);
    await this.prisma.emailMetadata.updateMany({
      where: { id: { in: emailIds } },
      data,
    });
  }

  private async getImapCredentials(mailAccount: {
    imapPasswordEnc: string | null;
    imapUsername: string | null;
    domain: { imapHost: string | null; imapPort: number | null } | null;
  }) {
    const imapHost =
      mailAccount.domain?.imapHost || this.configService.get<string>('imap.host');
    const imapPort =
      mailAccount.domain?.imapPort || this.configService.get<number>('imap.port', 993);

    if (!imapHost || !mailAccount.imapUsername || !mailAccount.imapPasswordEnc) {
      return null;
    }

    const password = this.decryptPassword(mailAccount.imapPasswordEnc);
    return {
      host: imapHost,
      port: imapPort,
      secure: this.configService.get<boolean>('imap.secure', true),
      username: mailAccount.imapUsername,
      password,
    };
  }

  private encryptPassword(plaintext: string): string {
    const key = Buffer.from(this.configService.getOrThrow<string>('encryption.key'));
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  private decryptPassword(encrypted: string): string {
    const key = Buffer.from(this.configService.getOrThrow<string>('encryption.key'));
    const [ivHex, authTagHex, dataHex] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = createDecipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(data).toString('utf8') + decipher.final('utf8');
  }

  /**
   * Sanitize HTML email content to prevent XSS
   * Never execute scripts from email content
   */
  private sanitizeHtml(html: string): string {
    try {
      const dom = new JSDOM(html, { runScripts: 'outside-only' });
      const doc = dom.window.document;

      // Remove dangerous elements
      const dangerous = ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'link'];
      dangerous.forEach((tag) => {
        doc.querySelectorAll(tag).forEach((el) => el.remove());
      });

      // Remove event handlers on all elements
      doc.querySelectorAll('*').forEach((el) => {
        const attrs = el.getAttributeNames();
        attrs.forEach((attr) => {
          if (attr.startsWith('on') || attr === 'srcdoc' || attr === 'data-bind') {
            el.removeAttribute(attr);
          }
        });

        // Block remote image loading if setting is off
        if (el.tagName === 'IMG') {
          const src = el.getAttribute('src') || '';
          if (src.startsWith('http') || src.startsWith('//')) {
            el.setAttribute('data-original-src', src);
            el.removeAttribute('src');
          }
        }

        // Sanitize href
        if (el.tagName === 'A') {
          const href = el.getAttribute('href') || '';
          if (href.startsWith('javascript:') || href.startsWith('vbscript:')) {
            el.removeAttribute('href');
          }
          el.setAttribute('target', '_blank');
          el.setAttribute('rel', 'noopener noreferrer');
        }
      });

      return doc.body.innerHTML;
    } catch {
      return '<p>Unable to display email content safely.</p>';
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatEmailListItem(email: any) {
    return {
      id: email.id,
      uid: email.uid,
      fromAddress: { name: email.fromName, address: email.fromAddress },
      toAddresses: email.toAddresses,
      ccAddresses: email.ccAddresses,
      bccAddresses: email.bccAddresses,
      subject: email.subject,
      preview: email.preview,
      size: email.size,
      hasAttachments: email.hasAttachments,
      isRead: email.isRead,
      isStarred: email.isStarred,
      isArchived: email.isArchived,
      isDraft: email.isDraft,
      flags: email.flags,
      date: email.emailDate || email.receivedAt,
      folderId: email.folderId,
    };
  }
}
