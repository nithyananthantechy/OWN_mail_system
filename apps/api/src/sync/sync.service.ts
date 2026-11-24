import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FolderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailProvider } from '../mail-provider/mail-provider.interface';
import { ConfigService } from '@nestjs/config';
import { createDecipheriv } from 'crypto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private isSyncing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailProvider: MailProvider,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async syncAllMailboxes() {
    if (this.isSyncing) {
      this.logger.debug('Sync already in progress, skipping.');
      return;
    }

    const imapHost = this.configService.get<string>('imap.host');
    if (!imapHost) {
      return; // IMAP not configured
    }

    this.isSyncing = true;
    try {
      const mailAccounts = await this.prisma.mailAccount.findMany({
        where: { status: 'ACTIVE', imapUsername: { not: null }, imapPasswordEnc: { not: null } },
        include: { domain: true },
      });

      for (const account of mailAccounts) {
        await this.syncMailbox(account).catch((err: Error) => {
          this.logger.warn(`Sync failed for ${account.emailAddress}: ${err.message}`);
        });
      }
    } finally {
      this.isSyncing = false;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async syncMailbox(account: any) {
    const credentials = {
      host: account.domain?.imapHost || this.configService.get<string>('imap.host', ''),
      port: account.domain?.imapPort || this.configService.get<number>('imap.port', 993),
      secure: this.configService.get<boolean>('imap.secure', true),
      username: account.imapUsername,
      password: this.decryptPassword(account.imapPasswordEnc),
    };

    // Sync INBOX
    await this.syncFolder(account, credentials, 'INBOX');

    // Update last sync timestamp
    await this.prisma.mailAccount.update({
      where: { id: account.id },
      data: { lastSyncAt: new Date() },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async syncFolder(account: any, credentials: any, folderName: string) {
    const folder = await this.prisma.mailFolder.findFirst({
      where: { mailAccountId: account.id, type: folderName as FolderType },
    });
    if (!folder) return;

    try {
      // Get last synced UID
      const lastEmail = await this.prisma.emailMetadata.findFirst({
        where: { mailAccountId: account.id, folderId: folder.id },
        orderBy: { uid: 'desc' },
      });

      const sinceUid = lastEmail ? lastEmail.uid + 1 : 1;

      const messages = await this.mailProvider.getMessages(credentials, {
        folder: folderName,
        sinceUid,
        limit: this.configService.get<number>('mailSync.batchSize', 50),
      });

      for (const msg of messages) {
        await this.prisma.emailMetadata.upsert({
          where: { mailAccountId_folderId_uid: { mailAccountId: account.id, folderId: folder.id, uid: msg.uid } },
          create: {
            mailAccountId: account.id,
            folderId: folder.id,
            uid: msg.uid,
            messageId: msg.messageId,
            fromAddress: msg.from.address,
            fromName: msg.from.name || null,
            toAddresses: JSON.parse(JSON.stringify(msg.to || [])),
            ccAddresses: JSON.parse(JSON.stringify(msg.cc || [])),
            bccAddresses: JSON.parse(JSON.stringify(msg.bcc || [])),
            subject: msg.subject || '(No Subject)',
            preview: msg.preview || '',
            size: msg.size,
            hasAttachments: msg.hasAttachments,
            isRead: msg.flags.includes('\\Seen'),
            isStarred: msg.flags.includes('\\Flagged'),
            flags: msg.flags,
            emailDate: msg.date || new Date(),
            inReplyTo: msg.inReplyTo || null,
            references: msg.references || [],
          },
          update: {
            isRead: msg.flags.includes('\\Seen'),
            isStarred: msg.flags.includes('\\Flagged'),
            flags: msg.flags,
            syncedAt: new Date(),
          },
        });

        // Sync attachments metadata
        if (msg.attachments && msg.attachments.length > 0) {
          const emailRecord = await this.prisma.emailMetadata.findFirst({
            where: { mailAccountId: account.id, folderId: folder.id, uid: msg.uid },
          });
          if (emailRecord) {
            for (const att of msg.attachments) {
              await this.prisma.attachment.upsert({
                where: { id: `${emailRecord.id}-${att.partId}` },
                create: {
                  id: `${emailRecord.id}-${att.partId}`,
                  emailId: emailRecord.id,
                  filename: att.filename,
                  originalFilename: att.filename,
                  mimeType: att.contentType,
                  size: att.size,
                  status: 'PROCESSED',
                },
                update: {},
              });
            }
          }
        }
      }

      // Update folder counts
      const [totalCount, unreadCount] = await Promise.all([
        this.prisma.emailMetadata.count({ where: { mailAccountId: account.id, folderId: folder.id } }),
        this.prisma.emailMetadata.count({ where: { mailAccountId: account.id, folderId: folder.id, isRead: false } }),
      ]);

      await this.prisma.mailFolder.update({
        where: { id: folder.id },
        data: { totalCount, unreadCount },
      });

    } catch (err: unknown) {
      const error = err as Error;
      this.logger.warn(`Folder sync error [${account.emailAddress}/${folderName}]: ${error.message}`);
    }
  }

  async triggerSync(mailAccountId: string) {
    const account = await this.prisma.mailAccount.findUnique({
      where: { id: mailAccountId },
      include: { domain: true },
    });
    if (account) {
      await this.syncMailbox(account);
    }
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
}
