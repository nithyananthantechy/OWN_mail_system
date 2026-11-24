import { Injectable, Logger } from '@nestjs/common';

export interface AuditLogData {
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
  errorCode?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  // In a production system this would write to DB via PrismaService
  // Imported lazily to avoid circular dependency
  async log(data: AuditLogData): Promise<void> {
    // Log structured audit entry - never log passwords/tokens
    this.logger.log({
      type: 'AUDIT',
      action: data.action,
      userId: data.userId,
      resource: data.resource,
      resourceId: data.resourceId,
      ipAddress: data.ipAddress,
      success: data.success ?? true,
      errorCode: data.errorCode,
      timestamp: new Date().toISOString(),
    });
  }
}
