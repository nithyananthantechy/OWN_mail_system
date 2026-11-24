import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, SetMetadata } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';

@ApiTags('admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@SetMetadata('roles', ['ADMIN'])
@ApiBearerAuth()
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard') async getDashboard() {
    return { success: true, data: await this.adminService.getDashboardStats() };
  }
  @Get('users') async getUsers(@Query('page') page = 1, @Query('limit') limit = 20, @Query('q') search?: string) {
    return { success: true, data: await this.adminService.getUsers(+page, +limit, search) };
  }
  @Post('users') async createUser(@Body() body: Parameters<AdminService['createUser']>[0]) {
    return { success: true, data: await this.adminService.createUser(body) };
  }
  @Put('users/:id/status') async updateStatus(@Param('id') id: string, @Body('status') status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    return { success: true, data: await this.adminService.updateUserStatus(id, status) };
  }
  @Post('users/:id/reset-password') async resetPassword(@Param('id') id: string, @Body('password') password: string) {
    await this.adminService.resetUserPassword(id, password);
    return { success: true };
  }
  @Delete('users/:id') async deleteUser(@Param('id') id: string) {
    await this.adminService.deleteUser(id);
    return { success: true };
  }
  @Get('audit-logs') async getAuditLogs(@Query('page') page = 1, @Query('limit') limit = 50) {
    return { success: true, data: await this.adminService.getAuditLogs(+page, +limit) };
  }
}
