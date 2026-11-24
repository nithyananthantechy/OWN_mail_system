import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MailProviderModule } from '../mail-provider/mail-provider.module';

@Module({
  imports: [MailProviderModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
