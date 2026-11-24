import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailProvider } from '../mail-provider/mail-provider.interface';
import { ConfigService } from '@nestjs/config';

export interface HealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unconfigured';
  message?: string;
  latencyMs?: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailProvider: MailProvider,
    private readonly configService: ConfigService,
  ) {}

  async check() {
    const [database, smtp, imap] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkSmtp(),
      this.checkImap(),
    ]);

    const db = database.status === 'fulfilled' ? database.value : { status: 'unhealthy' };
    const smtpResult = smtp.status === 'fulfilled' ? smtp.value : { status: 'unhealthy' };
    const imapResult = imap.status === 'fulfilled' ? imap.value : { status: 'unhealthy' };

    const overallHealthy =
      db.status === 'healthy' &&
      (smtpResult.status === 'healthy' || smtpResult.status === 'unconfigured') &&
      (imapResult.status === 'healthy' || imapResult.status === 'unconfigured');

    return {
      status: overallHealthy ? 'healthy' : 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: db,
        smtp: smtpResult,
        imap: imapResult,
      },
    };
  }

  async checkDatabase(): Promise<HealthResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'healthy',
        latencyMs: Date.now() - start,
      };
    } catch (err: unknown) {
      const error = err as Error;
      this.logger.error(`Database health check failed: ${error.message}`);
      return {
        status: 'unhealthy',
        message: 'Database connection failed.',
        latencyMs: Date.now() - start,
      };
    }
  }

  async checkSmtp(): Promise<HealthResult> {
    const smtpHost = this.configService.get<string>('smtp.host');
    if (!smtpHost) {
      return { status: 'unconfigured', message: 'SMTP is not configured.' };
    }

    const start = Date.now();
    try {
      const ok = await this.mailProvider.verifySmtpConnection();
      return ok
        ? { status: 'healthy', latencyMs: Date.now() - start }
        : { status: 'unhealthy', message: 'SMTP connection failed.', latencyMs: Date.now() - start };
    } catch {
      return { status: 'unhealthy', message: 'SMTP connection failed.', latencyMs: Date.now() - start };
    }
  }

  async checkImap(): Promise<HealthResult> {
    const imapHost = this.configService.get<string>('imap.host');
    if (!imapHost) {
      return { status: 'unconfigured', message: 'IMAP is not configured.' };
    }

    // Just check if the host is reachable (no credentials needed for health check)
    return { status: 'unconfigured', message: 'IMAP requires credentials to test.' };
  }

  async checkMail(): Promise<{ smtp: HealthResult; imap: HealthResult }> {
    const [smtp, imap] = await Promise.all([this.checkSmtp(), this.checkImap()]);
    return { smtp, imap };
  }
}
