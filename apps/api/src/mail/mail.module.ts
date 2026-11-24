import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MailController } from './mail.controller';
import { MailProviderModule } from '../mail-provider/mail-provider.module';
import { AuthModule } from '../auth/auth.module';
import { SyncModule } from '../sync/sync.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [MailProviderModule, AuthModule, SyncModule, AuditModule],
  providers: [MailService],
  controllers: [MailController],
  exports: [MailService],
})
export class MailModule {}
