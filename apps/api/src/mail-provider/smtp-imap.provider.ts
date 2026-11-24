import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import {
  MailProvider,
  SendEmailOptions,
  SendEmailResult,
  FetchMessagesOptions,
  ImapMessage,
  ImapAttachment,
  ImapFolder,
  MailboxStatus,
  ImapSearchQuery,
  ImapCredentials,
} from './mail-provider.interface';

@Injectable()
export class SmtpImapProvider extends MailProvider {
  readonly name = 'smtp-imap';
  private readonly logger = new Logger(SmtpImapProvider.name);
  private smtpTransporter: nodemailer.Transporter | null = null;
  private relayTransporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    super();
    this.initSmtp();
    this.initRelay();
  }

  get isConfigured(): boolean {
    const smtpHost = this.configService.get<string>('smtp.host');
    const imapHost = this.configService.get<string>('imap.host');
    return !!(smtpHost && imapHost);
  }

  get isSmtpConfigured(): boolean {
    return !!this.configService.get<string>('smtp.host');
  }

  get isImapConfigured(): boolean {
    return !!this.configService.get<string>('imap.host');
  }

  private initSmtp() {
    const host = this.configService.get<string>('smtp.host');
    const port = this.configService.get<number>('smtp.port', 587);
    const secure = this.configService.get<boolean>('smtp.secure', false);
    const user = this.configService.get<string>('smtp.username');
    const pass = this.configService.get<string>('smtp.password');

    if (!host || !user || !pass) {
      this.logger.warn('SMTP is not configured. Email sending will be unavailable.');
      return;
    }

    this.smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: process.env.NODE_ENV === 'production' },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  private initRelay() {
    const enabled = this.configService.get<boolean>('smtpRelay.enabled', false);
    const host = this.configService.get<string>('smtpRelay.host');
    const port = this.configService.get<number>('smtpRelay.port', 587);
    const secure = this.configService.get<boolean>('smtpRelay.secure', false);
    const user = this.configService.get<string>('smtpRelay.username');
    const pass = this.configService.get<string>('smtpRelay.password');

    if (!enabled || !host || !user || !pass) {
      return;
    }

    this.logger.log(`Initializing SMTP Fallback Relay via ${host}:${port}`);
    this.relayTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      pool: true,
      maxConnections: 5,
    });
  }

  // ---- SMTP ----

  private buildMailPayload(options: SendEmailOptions): nodemailer.SendMailOptions {
    return {
      from: options.from.name
        ? `"${options.from.name}" <${options.from.address}>`
        : options.from.address,
      to: options.to.map((a) => (a.name ? `"${a.name}" <${a.address}>` : a.address)),
      cc: options.cc?.map((a) => (a.name ? `"${a.name}" <${a.address}>` : a.address)),
      bcc: options.bcc?.map((a) => (a.name ? `"${a.name}" <${a.address}>` : a.address)),
      subject: options.subject,
      text: options.text,
      html: options.html,
      inReplyTo: options.inReplyTo,
      references: options.references?.join(' '),
      headers: options.headers,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        path: att.path,
        contentType: att.contentType,
        encoding: att.encoding,
        cid: att.cid,
      })),
    };
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const relayMode = this.configService.get<string>('smtpRelay.mode', 'fallback');
    const mailPayload = this.buildMailPayload(options);

    // If relay is configured and mode is 'always', send via relay directly
    if (relayMode === 'always' && this.relayTransporter) {
      try {
        const info = await this.relayTransporter.sendMail(mailPayload);
        this.logger.log(`[RELAY-ONLY] Email sent via relay: ${info.messageId}`);
        return { success: true, messageId: info.messageId, providerUsed: 'relay' };
      } catch (err: unknown) {
        const error = err as Error;
        this.logger.error(`Failed to send email via relay: ${error.message}`);
        return { success: false, error: `Relay error: ${error.message}` };
      }
    }

    // Try primary Postfix SMTP
    if (this.smtpTransporter) {
      try {
        const info = await this.smtpTransporter.sendMail(mailPayload);
        this.logger.log(`[PRIMARY-SMTP] Email sent: ${info.messageId}`);
        return { success: true, messageId: info.messageId, providerUsed: 'primary' };
      } catch (primaryErr: unknown) {
        const err = primaryErr as Error;
        this.logger.warn(`Primary SMTP send failed (${err.message}). Checking relay fallback...`);

        // Failover to relay if available
        if (this.relayTransporter) {
          try {
            const relayInfo = await this.relayTransporter.sendMail(mailPayload);
            this.logger.log(`[RELAY-FAILOVER] Successfully sent email via relay fallback: ${relayInfo.messageId}`);
            return { success: true, messageId: relayInfo.messageId, providerUsed: 'relay' };
          } catch (relayErr: unknown) {
            const rErr = relayErr as Error;
            this.logger.error(`Relay failover also failed: ${rErr.message}`);
          }
        }

        const isTemporary =
          err.message?.includes('ECONNREFUSED') ||
          err.message?.includes('ETIMEDOUT') ||
          err.message?.includes('421') ||
          err.message?.includes('450') ||
          err.message?.includes('451');

        return {
          success: false,
          error: 'Failed to send email. Primary server unreachable.',
          temporaryFailure: isTemporary,
        };
      }
    }

    // If primary not configured, but relay is available
    if (this.relayTransporter) {
      try {
        const info = await this.relayTransporter.sendMail(mailPayload);
        this.logger.log(`[RELAY-FALLBACK] Email sent via relay: ${info.messageId}`);
        return { success: true, messageId: info.messageId, providerUsed: 'relay' };
      } catch (err: unknown) {
        const error = err as Error;
        return { success: false, error: `Relay send failed: ${error.message}` };
      }
    }

    return {
      success: false,
      error: 'SMTP is not configured. Please configure SMTP or Relay settings.',
    };
  }

  async verifySmtpConnection(): Promise<boolean> {
    if (!this.smtpTransporter) return false;
    try {
      await this.smtpTransporter.verify();
      return true;
    } catch {
      return false;
    }
  }

  // ---- IMAP ----

  private createImapClient(credentials: ImapCredentials): ImapFlow {
    return new ImapFlow({
      host: credentials.host,
      port: credentials.port,
      secure: credentials.secure,
      auth: {
        user: credentials.username,
        pass: credentials.password,
      },
      logger: false,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
  }

  async getMessages(
    credentials: ImapCredentials,
    options: FetchMessagesOptions,
  ): Promise<ImapMessage[]> {
    const client = this.createImapClient(credentials);
    const messages: ImapMessage[] = [];

    try {
      await client.connect();
      const folder = options.folder || 'INBOX';
      const lock = await client.getMailboxLock(folder);

      try {
        const limit = options.limit ?? 50;
        const page = options.page ?? 1;

        // Build search criteria
        const searchCriteria: Record<string, unknown> = {};
        if (options.search?.from) searchCriteria.from = options.search.from;
        if (options.search?.to) searchCriteria.to = options.search.to;
        if (options.search?.subject) searchCriteria.subject = options.search.subject;
        if (options.search?.since) searchCriteria.since = options.search.since;
        if (options.search?.before) searchCriteria.before = options.search.before;
        if (options.search?.seen === true) searchCriteria.seen = true;
        if (options.search?.seen === false) searchCriteria.unseen = true;
        if (options.search?.flagged === true) searchCriteria.flagged = true;
        if (options.search?.text) searchCriteria.body = options.search.text;

        const rawUids = await client.search(
          Object.keys(searchCriteria).length > 0 ? (searchCriteria as any) : { all: true },
          { uid: true },
        );
        const allUids = Array.isArray(rawUids) ? rawUids : [];

        // Paginate
        const start = (page - 1) * limit;
        const paginatedUids = allUids.slice(-((start + limit))).slice(-limit).reverse();

        if (paginatedUids.length === 0) return [];

        for await (const msg of client.fetch(paginatedUids, {
          uid: true,
          flags: true,
          size: true,
          envelope: true,
          bodyStructure: true,
          bodyParts: ['TEXT'],
        }, { uid: true })) {
          messages.push(this.parseMessage(msg));
        }
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP getMessages error: ${error.message}`);
      throw new Error('Unable to connect to the mail server. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }

    return messages;
  }

  async getMessage(
    credentials: ImapCredentials,
    folder: string,
    uid: number,
    includeBody = true,
  ): Promise<ImapMessage | null> {
    const client = this.createImapClient(credentials);

    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);

      try {
        const fetchOptions: Parameters<typeof client.fetchOne>[1] = {
          uid: true,
          flags: true,
          size: true,
          envelope: true,
          bodyStructure: true,
        };

        if (includeBody) {
          (fetchOptions as Record<string, unknown>).source = true;
        }

        const msg = await client.fetchOne(`${uid}`, fetchOptions, { uid: true });
        if (!msg) return null;

        return this.parseMessage(msg, includeBody);
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP getMessage error: ${error.message}`);
      throw new Error('Unable to retrieve email. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseMessage(msg: any, _includeBody?: boolean): ImapMessage {
    const envelope = msg.envelope || {};
    const attachments: ImapAttachment[] = [];

    // Parse body structure for attachments
    if (msg.bodyStructure?.childNodes) {
      this.extractAttachments(msg.bodyStructure.childNodes, attachments);
    }

    return {
      uid: msg.uid,
      messageId: envelope.messageId,
      from: this.parseAddress(envelope.from?.[0]),
      to: (envelope.to || []).map(this.parseAddress),
      cc: (envelope.cc || []).map(this.parseAddress),
      bcc: (envelope.bcc || []).map(this.parseAddress),
      subject: envelope.subject || '(No Subject)',
      date: envelope.date ? new Date(envelope.date) : undefined,
      flags: msg.flags ? [...msg.flags] : [],
      size: msg.size || 0,
      hasAttachments: attachments.length > 0,
      inReplyTo: envelope.inReplyTo,
      attachments,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseAddress(addr: any): { name?: string; address: string } {
    if (!addr) return { address: 'unknown@unknown.com' };
    const address = addr.address || `${addr.mailbox}@${addr.host}`;
    return { name: addr.name || undefined, address };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractAttachments(nodes: any[], attachments: ImapAttachment[]) {
    for (const node of nodes) {
      if (node.disposition === 'attachment' || node.disposition === 'inline') {
        attachments.push({
          filename: node.dispositionParameters?.filename || node.parameters?.name || 'attachment',
          contentType: `${node.type}/${node.subtype}`,
          size: node.size || 0,
          partId: node.part || '1',
        });
      }
      if (node.childNodes) {
        this.extractAttachments(node.childNodes, attachments);
      }
    }
  }

  async markAsRead(credentials: ImapCredentials, folder: string, uids: number[]): Promise<void> {
    await this.addFlag(credentials, folder, uids, '\\Seen');
  }

  async markAsUnread(credentials: ImapCredentials, folder: string, uids: number[]): Promise<void> {
    await this.removeFlag(credentials, folder, uids, '\\Seen');
  }

  async deleteMessage(
    credentials: ImapCredentials,
    folder: string,
    uids: number[],
    permanent = false,
  ): Promise<void> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);
      try {
        if (permanent) {
          await client.messageDelete(uids.join(','), { uid: true });
        } else {
          // Move to Trash
          await client.messageMove(uids.join(','), 'Trash', { uid: true });
        }
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP deleteMessage error: ${error.message}`);
      throw new Error('Unable to delete email. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async moveMessage(
    credentials: ImapCredentials,
    sourceFolder: string,
    destFolder: string,
    uids: number[],
  ): Promise<void> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      const lock = await client.getMailboxLock(sourceFolder);
      try {
        await client.messageMove(uids.join(','), destFolder, { uid: true });
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP moveMessage error: ${error.message}`);
      throw new Error('Unable to move email. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async copyMessage(
    credentials: ImapCredentials,
    sourceFolder: string,
    destFolder: string,
    uids: number[],
  ): Promise<void> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      const lock = await client.getMailboxLock(sourceFolder);
      try {
        await client.messageCopy(uids.join(','), destFolder, { uid: true });
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP copyMessage error: ${error.message}`);
      throw new Error('Unable to copy email. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async searchMessages(
    credentials: ImapCredentials,
    folder: string,
    query: ImapSearchQuery,
  ): Promise<number[]> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);
      try {
        const criteria: Record<string, unknown> = {};
        if (query.from) criteria.from = query.from;
        if (query.to) criteria.to = query.to;
        if (query.subject) criteria.subject = query.subject;
        if (query.since) criteria.since = query.since;
        if (query.before) criteria.before = query.before;
        if (query.seen === true) criteria.seen = true;
        if (query.seen === false) criteria.unseen = true;
        if (query.flagged === true) criteria.flagged = true;
        if (query.text) criteria.body = query.text;

        const res = await client.search(
          Object.keys(criteria).length > 0 ? (criteria as any) : { all: true },
          { uid: true },
        );
        return Array.isArray(res) ? res : [];
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP searchMessages error: ${error.message}`);
      throw new Error('Search failed. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async getFolders(credentials: ImapCredentials): Promise<ImapFolder[]> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      const list = await client.list();
      return list.map((f) => ({
        name: f.name,
        path: f.path,
        delimiter: f.delimiter || '/',
        flags: [...(f.flags || [])],
        specialUse: f.specialUse,
      }));
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP getFolders error: ${error.message}`);
      throw new Error('Unable to retrieve folders. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async createFolder(credentials: ImapCredentials, name: string): Promise<void> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      await client.mailboxCreate(name);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP createFolder error: ${error.message}`);
      throw new Error('Unable to create folder. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async deleteFolder(credentials: ImapCredentials, name: string): Promise<void> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      await client.mailboxDelete(name);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP deleteFolder error: ${error.message}`);
      throw new Error('Unable to delete folder. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async renameFolder(
    credentials: ImapCredentials,
    oldName: string,
    newName: string,
  ): Promise<void> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      await client.mailboxRename(oldName, newName);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP renameFolder error: ${error.message}`);
      throw new Error('Unable to rename folder. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async getMailboxStatus(credentials: ImapCredentials, folder: string): Promise<MailboxStatus> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      const status = await client.status(folder, {
        messages: true,
        unseen: true,
        recent: true,
        uidNext: true,
        uidValidity: true,
      });
      return {
        messages: status.messages || 0,
        unseen: status.unseen || 0,
        recent: status.recent || 0,
        uidNext: status.uidNext || 0,
        uidValidity: Number(status.uidValidity || 0),
      };
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP getMailboxStatus error: ${error.message}`);
      throw new Error('Unable to get mailbox status.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async getAttachment(
    credentials: ImapCredentials,
    folder: string,
    uid: number,
    partId: string,
  ): Promise<Buffer> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);
      try {
        const chunks: Buffer[] = [];
        for await (const msg of client.fetch(`${uid}`, {
          bodyParts: [partId],
        }, { uid: true })) {
          const part = msg.bodyParts?.get(partId);
          if (part) {
            chunks.push(Buffer.isBuffer(part) ? part : Buffer.from(part as any));
          }
        }
        return Buffer.concat(chunks);
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP getAttachment error: ${error.message}`);
      throw new Error('Unable to download attachment. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async addFlag(
    credentials: ImapCredentials,
    folder: string,
    uids: number[],
    flag: string,
  ): Promise<void> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsAdd(uids.join(','), [flag], { uid: true });
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP addFlag error: ${error.message}`);
      throw new Error('Unable to update email. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async removeFlag(
    credentials: ImapCredentials,
    folder: string,
    uids: number[],
    flag: string,
  ): Promise<void> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      const lock = await client.getMailboxLock(folder);
      try {
        await client.messageFlagsRemove(uids.join(','), [flag], { uid: true });
      } finally {
        lock.release();
      }
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP removeFlag error: ${error.message}`);
      throw new Error('Unable to update email flag. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async appendMessage(
    credentials: ImapCredentials,
    folder: string,
    message: Buffer,
    flags?: string[],
    date?: Date,
  ): Promise<void> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      await client.append(folder, message, flags, date);
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`IMAP appendMessage error: ${error.message}`);
      throw new Error('Unable to save message. Please try again.');
    } finally {
      await client.logout().catch(() => {});
    }
  }

  async verifyImapConnection(credentials: ImapCredentials): Promise<boolean> {
    const client = this.createImapClient(credentials);
    try {
      await client.connect();
      await client.logout();
      return true;
    } catch {
      return false;
    }
  }
}
