import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ContactsService } from './contacts.service';

@ApiTags('contacts')
@Controller('contacts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  async getContacts(@CurrentUser() user: { id: string }, @Query('q') search?: string) {
    const data = await this.contactsService.getContacts(user.id, search);
    return { success: true, data };
  }

  @Get('autocomplete')
  async autocomplete(@CurrentUser() user: { id: string }, @Query('q') q: string) {
    const data = await this.contactsService.autocomplete(user.id, q);
    return { success: true, data };
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() body: Parameters<ContactsService['createContact']>[1]) {
    const data = await this.contactsService.createContact(user.id, body);
    return { success: true, data };
  }

  @Put(':id')
  async update(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: Parameters<ContactsService['updateContact']>[2]) {
    const data = await this.contactsService.updateContact(user.id, id, body);
    return { success: true, data };
  }

  @Delete(':id')
  async delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.contactsService.deleteContact(user.id, id);
    return { success: true };
  }
}
