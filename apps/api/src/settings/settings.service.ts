import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(userId: string) {
    return this.prisma.emailSettings.findUnique({ where: { userId } });
  }

  async updateSettings(userId: string, data: Partial<{
    timezone: string; language: string; theme: string;
    emailsPerPage: number; defaultSignatureId: string; replyBehavior: string;
    autoSaveDraftInterval: number; showHtmlEmails: boolean;
    loadRemoteImages: boolean; notificationsEnabled: boolean;
  }>) {
    return this.prisma.emailSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  async getSignatures(userId: string) {
    return this.prisma.emailSignature.findMany({ where: { userId }, orderBy: { isDefault: 'desc' } });
  }

  async createSignature(userId: string, data: { name: string; content: string; isHtml: boolean; isDefault?: boolean }) {
    if (data.isDefault) {
      await this.prisma.emailSignature.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.emailSignature.create({ data: { userId, ...data } });
  }

  async updateSignature(userId: string, signatureId: string, data: Partial<{ name: string; content: string; isHtml: boolean; isDefault: boolean }>) {
    if (data.isDefault) {
      await this.prisma.emailSignature.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.emailSignature.update({ where: { id: signatureId }, data });
  }

  async deleteSignature(userId: string, signatureId: string) {
    await this.prisma.emailSignature.delete({ where: { id: signatureId, userId } });
  }
}
