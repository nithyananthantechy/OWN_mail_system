import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FoldersService {
  constructor(private readonly prisma: PrismaService) {}

  async getFolders(userId: string, mailAccountId: string) {
    const account = await this.verifyAccount(userId, mailAccountId);
    void account;

    const folders = await this.prisma.mailFolder.findMany({
      where: { mailAccountId },
      orderBy: [{ type: 'asc' }, { displayName: 'asc' }],
    });

    // System folders first
    const order = ['INBOX', 'SENT', 'DRAFTS', 'SPAM', 'TRASH', 'ARCHIVE', 'CUSTOM'];
    return folders.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }

  async createFolder(userId: string, mailAccountId: string, name: string, parentId?: string) {
    await this.verifyAccount(userId, mailAccountId);

    return this.prisma.mailFolder.create({
      data: {
        mailAccountId,
        name,
        displayName: name,
        type: 'CUSTOM',
        imapPath: name,
        parentId,
      },
    });
  }

  async deleteFolder(userId: string, folderId: string) {
    const folder = await this.prisma.mailFolder.findUnique({
      where: { id: folderId },
      include: { mailAccount: true },
    });

    if (!folder) throw new NotFoundException('Folder not found.');
    if (folder.mailAccount.userId !== userId) throw new ForbiddenException('Access denied.');
    if (folder.type !== 'CUSTOM') throw new ForbiddenException('Cannot delete system folders.');

    await this.prisma.mailFolder.delete({ where: { id: folderId } });
  }

  async renameFolder(userId: string, folderId: string, newName: string) {
    const folder = await this.prisma.mailFolder.findUnique({
      where: { id: folderId },
      include: { mailAccount: true },
    });

    if (!folder) throw new NotFoundException('Folder not found.');
    if (folder.mailAccount.userId !== userId) throw new ForbiddenException('Access denied.');
    if (folder.type !== 'CUSTOM') throw new ForbiddenException('Cannot rename system folders.');

    return this.prisma.mailFolder.update({
      where: { id: folderId },
      data: { displayName: newName, name: newName, imapPath: newName },
    });
  }

  private async verifyAccount(userId: string, mailAccountId: string) {
    const account = await this.prisma.mailAccount.findFirst({
      where: { id: mailAccountId, userId },
    });
    if (!account) throw new NotFoundException('Mail account not found.');
    return account;
  }
}
