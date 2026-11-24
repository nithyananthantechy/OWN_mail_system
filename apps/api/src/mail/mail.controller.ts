import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { MailService } from './mail.service';
import { SendMailDto } from './dto/send-mail.dto';

@ApiTags('mail')
@Controller('mail')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('inbox')
  @ApiOperation({ summary: 'Get inbox emails' })
  async getInbox(
    @CurrentUser() user: { id: string },
    @Query('accountId') accountId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const data = await this.mailService.getInbox(user.id, accountId, +page, +limit);
    return { success: true, data };
  }

  @Get('starred')
  @ApiOperation({ summary: 'Get starred emails' })
  async getStarred(
    @CurrentUser() user: { id: string },
    @Query('accountId') accountId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const data = await this.mailService.getStarred(user.id, accountId, +page, +limit);
    return { success: true, data };
  }

  @Get('folder/:folder')
  @ApiOperation({ summary: 'Get emails by folder type or ID' })
  async getFolder(
    @CurrentUser() user: { id: string },
    @Param('folder') folder: string,
    @Query('accountId') accountId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const data = await this.mailService.getFolderEmails(user.id, accountId, folder, +page, +limit);
    return { success: true, data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single email by ID' })
  async getEmail(
    @CurrentUser() user: { id: string },
    @Param('id') emailId: string,
  ) {
    const data = await this.mailService.getEmail(user.id, emailId);
    return { success: true, data };
  }

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an email' })
  async sendEmail(
    @CurrentUser() user: { id: string },
    @Body() dto: SendMailDto,
  ) {
    const data = await this.mailService.sendEmail(user.id, dto);
    return { success: true, data, message: 'Email sent successfully.' };
  }

  @Post('draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save a draft' })
  async saveDraft(
    @CurrentUser() user: { id: string },
    @Body() dto: SendMailDto,
  ) {
    const data = await this.mailService.saveDraft(user.id, dto);
    return { success: true, data };
  }

  @Put('draft/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a draft' })
  async updateDraft(
    @CurrentUser() user: { id: string },
    @Param('id') draftId: string,
    @Body() dto: SendMailDto,
  ) {
    const data = await this.mailService.saveDraft(user.id, dto, draftId);
    return { success: true, data };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark email as read' })
  async markRead(
    @CurrentUser() user: { id: string },
    @Param('id') emailId: string,
  ) {
    await this.mailService.markAsRead(user.id, [emailId]);
    return { success: true };
  }

  @Post(':id/unread')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark email as unread' })
  async markUnread(
    @CurrentUser() user: { id: string },
    @Param('id') emailId: string,
  ) {
    await this.mailService.markAsUnread(user.id, [emailId]);
    return { success: true };
  }

  @Post(':id/star')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Star an email' })
  async star(
    @CurrentUser() user: { id: string },
    @Param('id') emailId: string,
  ) {
    await this.mailService.starEmail(user.id, [emailId]);
    return { success: true };
  }

  @Post(':id/unstar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove star from email' })
  async unstar(
    @CurrentUser() user: { id: string },
    @Param('id') emailId: string,
  ) {
    await this.mailService.unstarEmail(user.id, [emailId]);
    return { success: true };
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archive email' })
  async archive(
    @CurrentUser() user: { id: string },
    @Param('id') emailId: string,
  ) {
    await this.mailService.archiveEmail(user.id, [emailId]);
    return { success: true };
  }

  @Post(':id/move')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Move email to folder' })
  async move(
    @CurrentUser() user: { id: string },
    @Param('id') emailId: string,
    @Body('folderId') folderId: string,
  ) {
    await this.mailService.moveEmail(user.id, [emailId], folderId);
    return { success: true };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete email (move to trash or permanent)' })
  async delete(
    @CurrentUser() user: { id: string },
    @Param('id') emailId: string,
    @Query('permanent') permanent?: string,
  ) {
    await this.mailService.deleteEmail(user.id, [emailId], permanent === 'true');
    return { success: true };
  }

  // ---- Bulk Operations ----

  @Post('bulk/read')
  @HttpCode(HttpStatus.OK)
  async bulkRead(@CurrentUser() user: { id: string }, @Body('ids') ids: string[]) {
    await this.mailService.markAsRead(user.id, ids);
    return { success: true };
  }

  @Post('bulk/unread')
  @HttpCode(HttpStatus.OK)
  async bulkUnread(@CurrentUser() user: { id: string }, @Body('ids') ids: string[]) {
    await this.mailService.markAsUnread(user.id, ids);
    return { success: true };
  }

  @Post('bulk/delete')
  @HttpCode(HttpStatus.OK)
  async bulkDelete(
    @CurrentUser() user: { id: string },
    @Body('ids') ids: string[],
    @Body('permanent') permanent?: boolean,
  ) {
    await this.mailService.deleteEmail(user.id, ids, permanent);
    return { success: true };
  }

  @Post('bulk/move')
  @HttpCode(HttpStatus.OK)
  async bulkMove(
    @CurrentUser() user: { id: string },
    @Body('ids') ids: string[],
    @Body('folderId') folderId: string,
  ) {
    await this.mailService.moveEmail(user.id, ids, folderId);
    return { success: true };
  }
}
