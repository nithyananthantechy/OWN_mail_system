import { Module } from '@nestjs/common';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';

@Module({ providers: [DomainsService], controllers: [DomainsController] })
export class DomainsModule {}
