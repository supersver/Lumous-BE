import { AppError } from '@middlewares/error.middleware';
import { z, type ZodError } from 'zod';

const allowedRanges = [7, 30, 90] as const;
const defaultRangeDays = 30;
const maxDateRangeDays = 90;
const dateOnlyRegex = /^\d{4}-\d{2}-\d{2}$/;
const millisecondsPerDay = 24 * 60 * 60 * 1000;

type AllowedRangeDays = (typeof allowedRanges)[number];

type DateRange = {
  start: Date;
  endExclusive: Date;
  days: number;
};

export type AnalyticsDateRangeQueryDto = {
  range: AllowedRangeDays;
  startDate?: string | undefined;
  endDate?: string | undefined;
};

export type AnalyticsPaginatedQueryDto = AnalyticsDateRangeQueryDto & {
  limit: number;
  offset: number;
};

export type AnalyticsOverviewDto = {
  totalChats: number;
  totalMessages: number;
  totalTokens: number;
  totalCost: number;
  averageLatency: number;
};

export type AnalyticsUsageByDayDto = {
  date: string;
  tokens: number;
  cost: number;
};

export type AnalyticsModelUsageDto = {
  model: string;
  requests: number;
  tokens: number;
  cost: number;
};

export type AnalyticsChatUsageDto = {
  chatId: string;
  title: string;
  messages: number;
  tokens: number;
  cost: number;
};

const validationDetails = (error: ZodError) => ({
  issues: error.issues.map((issue) => ({
    field: issue.path.join('.') || 'query',
    message: issue.message,
  })),
});

const parseSchema = <T>(schema: z.ZodType<T>, value: unknown): T => {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new AppError(
      'Validation failed.',
      400,
      'VALIDATION_ERROR',
      validationDetails(result.error),
    );
  }

  return result.data;
};

const dateRangeQuerySchema = z
  .object({
    range: z.coerce
      .number()
      .int()
      .refine(
        (value): value is AllowedRangeDays =>
          allowedRanges.includes(value as AllowedRangeDays),
        'Range must be one of 7, 30, or 90.',
      )
      .default(defaultRangeDays),
    startDate: z.string().regex(dateOnlyRegex, 'Use YYYY-MM-DD.').optional(),
    endDate: z.string().regex(dateOnlyRegex, 'Use YYYY-MM-DD.').optional(),
  })
  .strip()
  .refine(
    (query) => (query.startDate && query.endDate) || (!query.startDate && !query.endDate),
    'Provide both startDate and endDate, or neither.',
  );

const paginatedQuerySchema = dateRangeQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

const parseDateOnly = (date: string): Date => {
  const [year, month, day] = date.split('-').map(Number);

  return new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
};

const toDateOnlyString = (date: Date): string => date.toISOString().slice(0, 10);

export const getAnalyticsDateRange = (query: AnalyticsDateRangeQueryDto): DateRange => {
  if (query.startDate && query.endDate) {
    const start = parseDateOnly(query.startDate);
    const endInclusive = parseDateOnly(query.endDate);
    const endExclusive = new Date(endInclusive.getTime() + millisecondsPerDay);
    const days = Math.ceil((endExclusive.getTime() - start.getTime()) / millisecondsPerDay);

    if (days <= 0) {
      throw new AppError('endDate must be on or after startDate.', 400, 'VALIDATION_ERROR', {
        field: 'endDate',
      });
    }

    if (days > maxDateRangeDays) {
      throw new AppError('Date range cannot exceed 90 days.', 400, 'VALIDATION_ERROR', {
        field: 'dateRange',
        maxDays: maxDateRangeDays,
      });
    }

    return {
      start,
      endExclusive,
      days,
    };
  }

  const endExclusive = new Date(startOfUtcDay(new Date()).getTime() + millisecondsPerDay);
  const start = new Date(endExclusive.getTime() - query.range * millisecondsPerDay);

  return {
    start,
    endExclusive,
    days: query.range,
  };
};

export const getDateRangeKeys = (dateRange: DateRange): string[] =>
  Array.from({ length: dateRange.days }, (_, index) =>
    toDateOnlyString(new Date(dateRange.start.getTime() + index * millisecondsPerDay)),
  );

export const parseAnalyticsDateRangeQueryDto = (query: unknown): AnalyticsDateRangeQueryDto =>
  parseSchema(dateRangeQuerySchema, query);

export const parseAnalyticsPaginatedQueryDto = (query: unknown): AnalyticsPaginatedQueryDto =>
  parseSchema(paginatedQuerySchema, query);
