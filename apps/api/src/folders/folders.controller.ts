import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FoldersService } from './folders.service';

@ApiTags('folders')
@Controller('folders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Get()
  async getFolders(@CurrentUser() user: { id: string }, @Query('accountId') accountId: string) {
    const data = await this.foldersService.getFolders(user.id, accountId);
    return { success: true, data };
  }

  @Post()
  async createFolder(
    @CurrentUser() user: { id: string },
    @Body() body: { accountId: string; name: string; parentId?: string },
  ) {
    const data = await this.foldersService.createFolder(user.id, body.accountId, body.name, body.parentId);
    return { success: true, data };
  }

  @Put(':id')
  async renameFolder(
    @CurrentUser() user: { id: string },
    @Param('id') folderId: string,
    @Body('name') name: string,
  ) {
    const data = await this.foldersService.renameFolder(user.id, folderId, name);
    return { success: true, data };
  }

  @Delete(':id')
  async deleteFolder(@CurrentUser() user: { id: string }, @Param('id') folderId: string) {
    await this.foldersService.deleteFolder(user.id, folderId);
    return { success: true };
  }
}
