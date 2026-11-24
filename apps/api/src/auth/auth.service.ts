import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';

export interface LoginResult {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string;
    role: string;
    status: string;
  };
}

@Injectable()
export class AuthService {
  private readonly ARGON2_OPTIONS = {
    type: 2 as const,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async login(
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    // Check brute force
    await this.checkBruteForce(email, ipAddress);

    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      await this.recordLoginAttempt(null, email, ipAddress, userAgent, false, 'USER_NOT_FOUND');
      throw new UnauthorizedException('Invalid email or password.');
    }

    if (user.status !== 'ACTIVE') {
      await this.recordLoginAttempt(user.id, email, ipAddress, userAgent, false, 'ACCOUNT_INACTIVE');
      throw new ForbiddenException('Your account has been suspended. Please contact support.');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid) {
      await this.recordLoginAttempt(user.id, email, ipAddress, userAgent, false, 'WRONG_PASSWORD');
      throw new UnauthorizedException('Invalid email or password.');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.recordLoginAttempt(user.id, email, ipAddress, userAgent, true, null);

    await this.auditService.log({
      userId: user.id,
      action: 'AUTH_LOGIN',
      ipAddress,
      userAgent,
      success: true,
    });

    const accessToken = await this.generateAccessToken(user.id, user.email, user.role);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
      },
    };
  }

  async createRefreshToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string> {
    const token = randomBytes(64).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.session.create({
      data: {
        userId,
        tokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    return token;
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.isRevoked || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    if (session.user.status !== 'ACTIVE') {
      throw new ForbiddenException('Account suspended.');
    }

    // Update last active
    await this.prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    return this.generateAccessToken(session.userId, session.user.email, session.user.role);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    await this.prisma.session.updateMany({
      where: { tokenHash },
      data: { isRevoked: true },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
    await this.auditService.log({
      userId,
      action: 'AUTH_LOGOUT_ALL',
      success: true,
    });
  }

  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        lastActiveAt: true,
        expiresAt: true,
      },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new BadRequestException('Session not found.');

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isRevoked: true },
    });
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    const isValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    this.validatePasswordStrength(newPassword);

    const newHash: string = await argon2.hash(newPassword, { ...this.ARGON2_OPTIONS, raw: false });
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all sessions
    await this.logoutAll(userId);

    await this.auditService.log({
      userId,
      action: 'AUTH_PASSWORD_CHANGED',
      success: true,
    });
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        status: true,
      },
    });
  }

  private async generateAccessToken(
    userId: string,
    email: string,
    role: string,
  ): Promise<string> {
    return this.jwtService.signAsync(
      { sub: userId, email, role },
      {
        secret: this.configService.getOrThrow<string>('jwt.secret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m'),
      },
    );
  }

  private async checkBruteForce(email: string, ipAddress?: string): Promise<void> {
    const windowStart = new Date(Date.now() - 15 * 60 * 1000); // 15 min window

    const recentAttempts = await this.prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        timestamp: { gte: windowStart },
      },
    });

    if (recentAttempts >= 10) {
      throw new ForbiddenException(
        'Too many failed login attempts. Please try again in 15 minutes.',
      );
    }

    if (ipAddress) {
      const ipAttempts = await this.prisma.loginAttempt.count({
        where: {
          ipAddress,
          success: false,
          timestamp: { gte: windowStart },
        },
      });

      if (ipAttempts >= 20) {
        throw new ForbiddenException('Too many requests from your IP. Please try again later.');
      }
    }
  }

  private async recordLoginAttempt(
    userId: string | null,
    email: string,
    ipAddress?: string,
    userAgent?: string,
    success?: boolean,
    failureReason?: string | null,
  ) {
    await this.prisma.loginAttempt.create({
      data: {
        userId,
        email,
        ipAddress,
        userAgent,
        success: success ?? false,
        failureReason,
      },
    });
  }

  private validatePasswordStrength(password: string): void {
    if (password.length < 12) {
      throw new BadRequestException('Password must be at least 12 characters long.');
    }
    if (!/[A-Z]/.test(password)) {
      throw new BadRequestException('Password must contain at least one uppercase letter.');
    }
    if (!/[a-z]/.test(password)) {
      throw new BadRequestException('Password must contain at least one lowercase letter.');
    }
    if (!/[0-9]/.test(password)) {
      throw new BadRequestException('Password must contain at least one number.');
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new BadRequestException('Password must contain at least one special character.');
    }
  }
}
