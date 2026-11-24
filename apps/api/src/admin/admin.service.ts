import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalUsers, activeUsers, totalDomains, failedLogins, recentLogins] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.domain.count(),
      this.prisma.loginAttempt.count({ where: { success: false, timestamp: { gte: windowStart } } }),
      this.prisma.loginAttempt.findMany({
        where: { timestamp: { gte: windowStart } },
        orderBy: { timestamp: 'desc' },
        take: 10,
        select: { email: true, ipAddress: true, userAgent: true, success: true, timestamp: true, userId: true },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers: totalUsers - activeUsers,
      totalDomains,
      failedLoginAttempts: failedLogins,
      recentLogins,
    };
  }

  async getUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? { OR: [{ email: { contains: search, mode: 'insensitive' as const } }, { displayName: { contains: search, mode: 'insensitive' as const } }] }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where, skip, take: limit, orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, displayName: true, role: true, status: true, createdAt: true, lastLoginAt: true },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { users, total, page, limit };
  }

  async createUser(data: { email: string; displayName: string; password: string; role?: string }) {
    const passwordHash = await argon2.hash(data.password, { type: argon2.argon2id });
    return this.prisma.user.create({
      data: { email: data.email.toLowerCase(), displayName: data.displayName, passwordHash, role: (data.role as 'USER' | 'ADMIN') || 'USER' },
      select: { id: true, email: true, displayName: true, role: true, status: true, createdAt: true },
    });
  }

  async updateUserStatus(userId: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') {
    return this.prisma.user.update({ where: { id: userId }, data: { status }, select: { id: true, email: true, status: true } });
  }

  async resetUserPassword(userId: string, newPassword: string) {
    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.prisma.session.updateMany({ where: { userId }, data: { isRevoked: true } });
  }

  async deleteUser(userId: string) {
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      this.prisma.loginAttempt.findMany({ skip, take: limit, orderBy: { timestamp: 'desc' } }),
      this.prisma.loginAttempt.count(),
    ]);
    return { logs, total, page, limit };
  }
}
