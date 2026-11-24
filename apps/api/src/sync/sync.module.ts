import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { MailProviderModule } from '../mail-provider/mail-provider.module';

@Module({
  imports: [MailProviderModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
