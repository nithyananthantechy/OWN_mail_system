import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { DomainsService } from './domains.service';
import { CreateDomainDto } from './dto/create-domain.dto';

@ApiTags('domains')
@Controller('domains')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DomainsController {
  constructor(private readonly domainsService: DomainsService) {}

  @Get()
  @ApiOperation({ summary: 'List all registered domains' })
  async getDomains() {
    return { success: true, data: await this.domainsService.getDomains() };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get domain details and DNS records' })
  async getDomainById(@Param('id') id: string) {
    return { success: true, data: await this.domainsService.getDomainById(id) };
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Onboard a new domain (auto-generates DKIM/SPF/DMARC)' })
  async createDomain(@Body() dto: CreateDomainDto) {
    const domain = await this.domainsService.createDomain(dto);
    return { success: true, data: domain, message: 'Domain registered and DKIM keys generated.' };
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger real-time DNS verification (MX, SPF, DKIM, DMARC)' })
  async verifyDns(@Param('id') id: string) {
    const report = await this.domainsService.verifyDomainDns(id);
    return { success: true, data: report };
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Delete a domain' })
  async deleteDomain(@Param('id') id: string) {
    await this.domainsService.deleteDomain(id);
    return { success: true, message: 'Domain deleted successfully.' };
  }
}
