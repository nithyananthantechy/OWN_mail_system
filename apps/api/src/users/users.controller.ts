import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: { id: string }) {
    const data = await this.usersService.getProfile(user.id);
    return { success: true, data };
  }

  @Put('me')
  async updateProfile(
    @CurrentUser() user: { id: string },
    @Body() body: { displayName?: string; avatarUrl?: string },
  ) {
    const data = await this.usersService.updateProfile(user.id, body);
    return { success: true, data };
  }

  @Get('me/accounts')
  async getMailAccounts(@CurrentUser() user: { id: string }) {
    const data = await this.usersService.getMailAccounts(user.id);
    return { success: true, data };
  }

  @Get('me/quota')
  async getQuota(@CurrentUser() user: { id: string }) {
    const data = await this.usersService.getQuota(user.id);
    return { success: true, data };
  }
}
