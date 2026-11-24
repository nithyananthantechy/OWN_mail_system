import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  @ApiOperation({ summary: 'Overall system health check' })
  async health() {
    return this.healthService.check();
  }

  @Get('health/database')
  @ApiOperation({ summary: 'Database health check' })
  async database() {
    return this.healthService.checkDatabase();
  }

  @Get('health/smtp')
  @ApiOperation({ summary: 'SMTP health check' })
  async smtp() {
    return this.healthService.checkSmtp();
  }

  @Get('health/imap')
  @ApiOperation({ summary: 'IMAP health check' })
  async imap() {
    return this.healthService.checkImap();
  }

  @Get('health/mail')
  @ApiOperation({ summary: 'Combined mail server health check' })
  async mail() {
    return this.healthService.checkMail();
  }
}
