import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
        createdAt: true,
        lastLoginAt: true,
        avatarUrl: true,
        mailAccounts: {
          include: { domain: true },
          where: { status: 'ACTIVE' },
        },
        emailSettings: true,
        emailSignatures: true,
      },
    });
  }

  async updateProfile(userId: string, data: { displayName?: string; avatarUrl?: string }) {
    return this.prisma.user.update({
      where: { id: userId },
      data,
      select: { id: true, email: true, displayName: true, avatarUrl: true },
    });
  }

  async getMailAccounts(userId: string) {
    return this.prisma.mailAccount.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { domain: true },
    });
  }

  async getQuota(userId: string) {
    const accounts = await this.prisma.mailAccount.findMany({
      where: { userId },
      select: { mailboxQuota: true, usedQuota: true, emailAddress: true },
    });
    return accounts.map((a) => ({
      email: a.emailAddress,
      used: Number(a.usedQuota),
      total: Number(a.mailboxQuota),
      percentage: Math.round((Number(a.usedQuota) / Number(a.mailboxQuota)) * 100),
      formattedUsed: this.formatBytes(Number(a.usedQuota)),
      formattedTotal: this.formatBytes(Number(a.mailboxQuota)),
    }));
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }
}
