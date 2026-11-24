// =========================================
// NITECHSPARK MAIL - Mail Provider Interface
// Abstraction layer for SMTP/IMAP operations
// =========================================

export interface EmailAddress {
  name?: string;
  address: string;
}

export interface SendEmailOptions {
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  content?: Buffer | string;
  path?: string;
  contentType?: string;
  encoding?: string;
  cid?: string;
  size?: number;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  temporaryFailure?: boolean;
  providerUsed?: 'primary' | 'relay';
}

export interface FetchMessagesOptions {
  folder?: string;
  page?: number;
  limit?: number;
  uid?: number | number[];
  sinceUid?: number;
  since?: Date;
  search?: ImapSearchQuery;
}

export interface ImapSearchQuery {
  from?: string;
  to?: string;
  subject?: string;
  since?: Date;
  before?: Date;
  seen?: boolean;
  flagged?: boolean;
  text?: string;
  uid?: number[];
}

export interface ImapMessage {
  uid: number;
  messageId?: string;
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  date?: Date;
  flags: string[];
  size: number;
  hasAttachments: boolean;
  bodyText?: string;
  bodyHtml?: string;
  preview?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: ImapAttachment[];
}

export interface ImapAttachment {
  filename: string;
  contentType: string;
  size: number;
  partId: string;
  content?: Buffer;
}

export interface ImapFolder {
  name: string;
  path: string;
  delimiter: string;
  flags: string[];
  specialUse?: string;
  exists?: number;
  unseen?: number;
}

export interface MailboxStatus {
  messages: number;
  unseen: number;
  recent: number;
  uidNext: number;
  uidValidity: number;
}

/**
 * Abstract Mail Provider Interface
 * Implement this for different mail server backends (IMAP/SMTP, Exchange, etc.)
 */
export abstract class MailProvider {
  abstract readonly name: string;
  abstract readonly isConfigured: boolean;

  // ---- SMTP Operations ----
  abstract sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;
  abstract verifySmtpConnection(): Promise<boolean>;

  // ---- IMAP Operations ----
  abstract getMessages(
    credentials: ImapCredentials,
    options: FetchMessagesOptions,
  ): Promise<ImapMessage[]>;

  abstract getMessage(
    credentials: ImapCredentials,
    folder: string,
    uid: number,
    includeBody?: boolean,
  ): Promise<ImapMessage | null>;

  abstract markAsRead(
    credentials: ImapCredentials,
    folder: string,
    uids: number[],
  ): Promise<void>;

  abstract markAsUnread(
    credentials: ImapCredentials,
    folder: string,
    uids: number[],
  ): Promise<void>;

  abstract deleteMessage(
    credentials: ImapCredentials,
    folder: string,
    uids: number[],
    permanent?: boolean,
  ): Promise<void>;

  abstract moveMessage(
    credentials: ImapCredentials,
    sourceFolder: string,
    destFolder: string,
    uids: number[],
  ): Promise<void>;

  abstract copyMessage(
    credentials: ImapCredentials,
    sourceFolder: string,
    destFolder: string,
    uids: number[],
  ): Promise<void>;

  abstract searchMessages(
    credentials: ImapCredentials,
    folder: string,
    query: ImapSearchQuery,
  ): Promise<number[]>;

  abstract getFolders(credentials: ImapCredentials): Promise<ImapFolder[]>;

  abstract createFolder(credentials: ImapCredentials, name: string): Promise<void>;

  abstract deleteFolder(credentials: ImapCredentials, name: string): Promise<void>;

  abstract renameFolder(
    credentials: ImapCredentials,
    oldName: string,
    newName: string,
  ): Promise<void>;

  abstract getMailboxStatus(
    credentials: ImapCredentials,
    folder: string,
  ): Promise<MailboxStatus>;

  abstract getAttachment(
    credentials: ImapCredentials,
    folder: string,
    uid: number,
    partId: string,
  ): Promise<Buffer>;

  abstract addFlag(
    credentials: ImapCredentials,
    folder: string,
    uids: number[],
    flag: string,
  ): Promise<void>;

  abstract removeFlag(
    credentials: ImapCredentials,
    folder: string,
    uids: number[],
    flag: string,
  ): Promise<void>;

  abstract appendMessage(
    credentials: ImapCredentials,
    folder: string,
    message: Buffer,
    flags?: string[],
    date?: Date,
  ): Promise<void>;

  abstract verifyImapConnection(credentials: ImapCredentials): Promise<boolean>;
}

export interface ImapCredentials {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
}
