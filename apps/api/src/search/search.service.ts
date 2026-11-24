import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SearchParams {
  query?: string;
  from?: string;
  to?: string;
  subject?: string;
  dateFrom?: string;
  dateTo?: string;
  hasAttachment?: boolean;
  isUnread?: boolean;
  isStarred?: boolean;
  folderId?: string;
  mailAccountId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, params: SearchParams) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Record<string, unknown> = {
      mailAccount: { userId },
    };

    if (params.mailAccountId) where['mailAccountId'] = params.mailAccountId;
    if (params.folderId) where['folderId'] = params.folderId;
    if (params.isUnread === true) where['isRead'] = false;
    if (params.isStarred === true) where['isStarred'] = true;
    if (params.hasAttachment === true) where['hasAttachments'] = true;

    const conditions: Record<string, unknown>[] = [];

    if (params.from) {
      conditions.push({ fromAddress: { contains: params.from, mode: 'insensitive' } });
    }
    if (params.subject) {
      conditions.push({ subject: { contains: params.subject, mode: 'insensitive' } });
    }
    if (params.query) {
      conditions.push({
        OR: [
          { subject: { contains: params.query, mode: 'insensitive' } },
          { fromAddress: { contains: params.query, mode: 'insensitive' } },
          { preview: { contains: params.query, mode: 'insensitive' } },
        ],
      });
    }
    if (params.dateFrom || params.dateTo) {
      const dateFilter: Record<string, Date> = {};
      if (params.dateFrom) dateFilter['gte'] = new Date(params.dateFrom);
      if (params.dateTo) dateFilter['lte'] = new Date(params.dateTo);
      conditions.push({ emailDate: dateFilter });
    }

    if (conditions.length > 0) {
      where['AND'] = conditions;
    }

    const [emails, total] = await Promise.all([
      this.prisma.emailMetadata.findMany({
        where,
        skip,
        take: limit,
        orderBy: { emailDate: 'desc' },
      }),
      this.prisma.emailMetadata.count({ where }),
    ]);

    return {
      emails,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
    };
  }
}
