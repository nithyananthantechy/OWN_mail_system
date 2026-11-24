// =========================================
// NITECHSPARK MAIL - Shared Types Package
// =========================================

// ---- Enums ----
export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum DomainStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum DomainVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  FAILED = 'FAILED',
}

export enum MailAccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum EmailFlag {
  SEEN = 'SEEN',
  UNSEEN = 'UNSEEN',
  STARRED = 'STARRED',
  ANSWERED = 'ANSWERED',
  FLAGGED = 'FLAGGED',
  DELETED = 'DELETED',
  DRAFT = 'DRAFT',
}

export enum FolderType {
  INBOX = 'INBOX',
  SENT = 'SENT',
  DRAFTS = 'DRAFTS',
  SPAM = 'SPAM',
  TRASH = 'TRASH',
  ARCHIVE = 'ARCHIVE',
  CUSTOM = 'CUSTOM',
}

export enum AttachmentStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
}

// ---- User Types ----
export interface User {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
  avatarUrl?: string;
}

export interface UserProfile extends User {
  mailAccounts: MailAccount[];
  settings: EmailSettings | null;
  signatures: EmailSignature[];
}

// ---- Domain Types ----
export interface Domain {
  id: string;
  domainName: string;
  status: DomainStatus;
  verificationStatus: DomainVerificationStatus;
  mxRecord?: string;
  spfRecord?: string;
  dkimRecord?: string;
  dmarcRecord?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ---- Mail Account Types ----
export interface MailAccount {
  id: string;
  userId: string;
  domainId: string;
  emailAddress: string;
  displayName?: string;
  mailboxQuota: number; // bytes
  usedQuota: number; // bytes
  status: MailAccountStatus;
  createdAt: Date;
  updatedAt: Date;
  domain?: Domain;
}

// ---- Email Types ----
export interface EmailAddress {
  name?: string;
  address: string;
}

export interface EmailHeader {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
}

export interface EmailMessage {
  id: string;
  uid: number;
  mailAccountId: string;
  folderId: string;
  messageId: string;
  fromAddress: EmailAddress;
  toAddresses: EmailAddress[];
  ccAddresses: EmailAddress[];
  bccAddresses: EmailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  sanitizedHtml?: string;
  size: number;
  hasAttachments: boolean;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  flags: EmailFlag[];
  date: Date;
  receivedAt: Date;
  inReplyTo?: string;
  references?: string[];
  spamScore?: number;
  attachments?: Attachment[];
}

export interface EmailListItem {
  id: string;
  uid: number;
  fromAddress: EmailAddress;
  toAddresses: EmailAddress[];
  subject: string;
  preview: string;
  size: number;
  hasAttachments: boolean;
  isRead: boolean;
  isStarred: boolean;
  isArchived: boolean;
  date: Date;
  folderId: string;
  folderName: string;
}

// ---- Attachment Types ----
export interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  status: AttachmentStatus;
  storageKey?: string;
  createdAt: Date;
}

// ---- Folder Types ----
export interface MailFolder {
  id: string;
  mailAccountId: string;
  name: string;
  displayName: string;
  type: FolderType;
  imapPath: string;
  parentId?: string;
  unreadCount: number;
  totalCount: number;
  children?: MailFolder[];
  createdAt: Date;
  updatedAt: Date;
}

// ---- Contact Types ----
export interface Contact {
  id: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName: string;
  phone?: string;
  company?: string;
  notes?: string;
  groupId?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContactGroup {
  id: string;
  userId: string;
  name: string;
  description?: string;
  contacts?: Contact[];
  createdAt: Date;
  updatedAt: Date;
}

// ---- Email Settings Types ----
export interface EmailSettings {
  id: string;
  userId: string;
  timezone: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
  emailsPerPage: number;
  defaultSignatureId?: string;
  replyBehavior: 'reply' | 'replyAll';
  autoSaveDraftInterval: number; // seconds
  showHtmlEmails: boolean;
  loadRemoteImages: boolean;
  notificationsEnabled: boolean;
  desktopNotifications: boolean;
  updatedAt: Date;
}

// ---- Email Signature Types ----
export interface EmailSignature {
  id: string;
  userId: string;
  name: string;
  content: string;
  isHtml: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ---- Auth Types ----
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface Session {
  id: string;
  userId: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: Date;
  expiresAt: Date;
  lastActiveAt: Date;
}

// ---- Compose Types ----
export interface ComposeEmail {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  attachmentIds?: string[];
  inReplyTo?: string;
  references?: string[];
  signatureId?: string;
}

export interface DraftEmail extends ComposeEmail {
  id?: string;
  savedAt?: Date;
}

// ---- Search Types ----
export interface SearchQuery {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  dateFrom?: Date;
  dateTo?: Date;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  folderId?: string;
  mailAccountId?: string;
  page?: number;
  limit?: number;
}

export interface SearchResult {
  emails: EmailListItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// ---- Pagination Types ----
export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

// ---- Admin Types ----
export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalDomains: number;
  totalMailAccounts: number;
  totalStorageUsed: number;
  recentLogins: RecentLogin[];
  failedLoginAttempts: number;
  systemStatus: SystemStatus;
}

export interface RecentLogin {
  userId: string;
  userEmail: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  timestamp: Date;
}

export interface SystemStatus {
  database: HealthStatus;
  smtp: HealthStatus;
  imap: HealthStatus;
  redis?: HealthStatus;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unconfigured';
  message?: string;
  latencyMs?: number;
}

// ---- Audit Log Types ----
export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
  success: boolean;
  errorCode?: string;
}

// ---- API Response Types ----
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  message?: string;
  requestId?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ---- Mail Health Check ----
export interface MailHealthCheck {
  domain: string;
  mx: DnsCheckResult;
  spf: DnsCheckResult;
  dkim: DnsCheckResult;
  dmarc: DnsCheckResult;
  ptr: DnsCheckResult;
  tls: TlsCheckResult;
  checkedAt: Date;
}

export interface DnsCheckResult {
  status: 'pass' | 'fail' | 'warning' | 'unchecked';
  value?: string;
  recommendation?: string;
  message?: string;
}

export interface TlsCheckResult {
  status: 'pass' | 'fail' | 'warning';
  version?: string;
  certificate?: string;
  expiresAt?: Date;
  message?: string;
}

// ---- Quota Types ----
export interface QuotaInfo {
  used: number;
  total: number;
  percentage: number;
  formattedUsed: string;
  formattedTotal: string;
}
