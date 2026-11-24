import { Controller, Get, Put, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get() async get(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.settingsService.getSettings(user.id) };
  }
  @Put() async update(@CurrentUser() user: { id: string }, @Body() body: Parameters<SettingsService['updateSettings']>[1]) {
    return { success: true, data: await this.settingsService.updateSettings(user.id, body) };
  }
  @Get('signatures') async getSignatures(@CurrentUser() user: { id: string }) {
    return { success: true, data: await this.settingsService.getSignatures(user.id) };
  }
  @Post('signatures') async createSignature(@CurrentUser() user: { id: string }, @Body() body: Parameters<SettingsService['createSignature']>[1]) {
    return { success: true, data: await this.settingsService.createSignature(user.id, body) };
  }
  @Put('signatures/:id') async updateSignature(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: Parameters<SettingsService['updateSignature']>[2]) {
    return { success: true, data: await this.settingsService.updateSignature(user.id, id, body) };
  }
  @Delete('signatures/:id') async deleteSignature(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.settingsService.deleteSignature(user.id, id);
    return { success: true };
  }
}
