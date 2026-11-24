import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async getContacts(userId: string, search?: string) {
    return this.prisma.contact.findMany({
      where: {
        userId,
        ...(search ? {
          OR: [
            { displayName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: { displayName: 'asc' },
    });
  }

  async createContact(userId: string, data: {
    email: string; firstName?: string; lastName?: string;
    displayName: string; phone?: string; company?: string; notes?: string; groupId?: string;
  }) {
    return this.prisma.contact.create({ data: { userId, ...data } });
  }

  async updateContact(userId: string, contactId: string, data: Partial<{
    email: string; firstName: string; lastName: string;
    displayName: string; phone: string; company: string; notes: string;
  }>) {
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found.');
    if (contact.userId !== userId) throw new ForbiddenException('Access denied.');
    return this.prisma.contact.update({ where: { id: contactId }, data });
  }

  async deleteContact(userId: string, contactId: string) {
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact) throw new NotFoundException('Contact not found.');
    if (contact.userId !== userId) throw new ForbiddenException('Access denied.');
    await this.prisma.contact.delete({ where: { id: contactId } });
  }

  async autocomplete(userId: string, query: string) {
    const contacts = await this.prisma.contact.findMany({
      where: {
        userId,
        OR: [
          { email: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: { email: true, displayName: true, avatarUrl: true },
    });
    return contacts;
  }
}
