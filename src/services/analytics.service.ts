import type { Prisma } from '@prisma/client';
import { prisma } from '@lib/prisma';
import {
  getAnalyticsDateRange,
  getDateRangeKeys,
  type AnalyticsChatUsageDto,
  type AnalyticsDateRangeQueryDto,
  type AnalyticsModelUsageDto,
  type AnalyticsOverviewDto,
  type AnalyticsPaginatedQueryDto,
  type AnalyticsUsageByDayDto,
} from '@/types/analytics.dto';

type DailyUsageRow = {
  date: Date | string;
  tokens: bigint | number | null;
  cost: Prisma.Decimal | string | number | null;
};

const toNumber = (value: Prisma.Decimal | bigint | string | number | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
};

const toDateKey = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value.slice(0, 10);
};

export const analyticsService = {
  async getOverview(
    userId: string,
    query: AnalyticsDateRangeQueryDto,
  ): Promise<AnalyticsOverviewDto> {
    const dateRange = getAnalyticsDateRange(query);
    const createdAtFilter = {
      gte: dateRange.start,
      lt: dateRange.endExclusive,
    };

    const [totalChats, totalMessages, usageSummary] = await Promise.all([
      prisma.chat.count({
        where: {
          userId,
          createdAt: createdAtFilter,
        },
      }),
      prisma.message.count({
        where: {
          createdAt: createdAtFilter,
          chat: {
            userId,
          },
        },
      }),
      prisma.usageLog.aggregate({
        where: {
          userId,
          createdAt: createdAtFilter,
        },
        _sum: {
          totalTokens: true,
          estimatedCost: true,
        },
        _avg: {
          latencyMs: true,
        },
      }),
    ]);

    return {
      totalChats,
      totalMessages,
      totalTokens: usageSummary._sum.totalTokens ?? 0,
      totalCost: toNumber(usageSummary._sum.estimatedCost),
      averageLatency: usageSummary._avg.latencyMs ?? 0,
    };
  },

  async getUsageByDay(
    userId: string,
    query: AnalyticsDateRangeQueryDto,
  ): Promise<AnalyticsUsageByDayDto[]> {
    const dateRange = getAnalyticsDateRange(query);
    const rows = await prisma.$queryRaw<DailyUsageRow[]>`
      SELECT
        DATE("created_at") AS "date",
        COALESCE(SUM("total_tokens"), 0)::bigint AS "tokens",
        COALESCE(SUM("estimated_cost"), 0)::numeric AS "cost"
      FROM "usage_logs"
      WHERE "user_id" = CAST(${userId} AS uuid)
        AND "created_at" >= ${dateRange.start}
        AND "created_at" < ${dateRange.endExclusive}
      GROUP BY DATE("created_at")
      ORDER BY DATE("created_at") ASC
    `;
    const rowByDate = new Map(
      rows.map((row) => [
        toDateKey(row.date),
        {
          tokens: toNumber(row.tokens),
          cost: toNumber(row.cost),
        },
      ]),
    );

    return getDateRangeKeys(dateRange).map((date) => {
      const aggregate = rowByDate.get(date);

      return {
        date,
        tokens: aggregate?.tokens ?? 0,
        cost: aggregate?.cost ?? 0,
      };
    });
  },

  async getModels(
    userId: string,
    query: AnalyticsPaginatedQueryDto,
  ): Promise<AnalyticsModelUsageDto[]> {
    const dateRange = getAnalyticsDateRange(query);
    const rows = await prisma.usageLog.groupBy({
      by: ['model'],
      where: {
        userId,
        createdAt: {
          gte: dateRange.start,
          lt: dateRange.endExclusive,
        },
      },
      _count: {
        _all: true,
      },
      _sum: {
        totalTokens: true,
        estimatedCost: true,
      },
      orderBy: [
        {
          _sum: {
            totalTokens: 'desc',
          },
        },
        {
          model: 'asc',
        },
      ],
      skip: query.offset,
      take: query.limit,
    });

    return rows.map((row) => ({
      model: row.model,
      requests: row._count._all,
      tokens: row._sum.totalTokens ?? 0,
      cost: toNumber(row._sum.estimatedCost),
    }));
  },

  async getChats(
    userId: string,
    query: AnalyticsPaginatedQueryDto,
  ): Promise<AnalyticsChatUsageDto[]> {
    const dateRange = getAnalyticsDateRange(query);
    const createdAtFilter = {
      gte: dateRange.start,
      lt: dateRange.endExclusive,
    };
    const usageRows = await prisma.usageLog.groupBy({
      by: ['chatId'],
      where: {
        userId,
        createdAt: createdAtFilter,
      },
      _sum: {
        totalTokens: true,
        estimatedCost: true,
      },
      orderBy: [
        {
          _sum: {
            totalTokens: 'desc',
          },
        },
        {
          chatId: 'asc',
        },
      ],
      skip: query.offset,
      take: query.limit,
    });
    const chatIds = usageRows.map((row) => row.chatId);

    if (chatIds.length === 0) {
      return [];
    }

    const [chats, messageCounts] = await Promise.all([
      prisma.chat.findMany({
        where: {
          id: {
            in: chatIds,
          },
          userId,
        },
        select: {
          id: true,
          title: true,
        },
      }),
      prisma.message.groupBy({
        by: ['chatId'],
        where: {
          chatId: {
            in: chatIds,
          },
          createdAt: createdAtFilter,
        },
        _count: {
          _all: true,
        },
      }),
    ]);
    const chatById = new Map(chats.map((chat) => [chat.id, chat]));
    const messageCountByChatId = new Map(
      messageCounts.map((count) => [count.chatId, count._count._all]),
    );

    return usageRows.flatMap((row): AnalyticsChatUsageDto[] => {
      const chat = chatById.get(row.chatId);

      if (!chat) {
        return [];
      }

      return [
        {
          chatId: row.chatId,
          title: chat.title,
          messages: messageCountByChatId.get(row.chatId) ?? 0,
          tokens: row._sum.totalTokens ?? 0,
          cost: toNumber(row._sum.estimatedCost),
        },
      ];
    });
  },
};
