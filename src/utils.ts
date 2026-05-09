import { PERIOD_OPTIONS } from './constants';
import { PeriodKey, SummaryPayload } from './types';

const PERIOD_KEYS = PERIOD_OPTIONS.map((option) => option.value);

export function normalizePayload(input?: SummaryPayload | string | null): SummaryPayload {
  if (!input) return {};
  if (typeof input === 'string') {
    return { summary: input };
  }
  return input;
}

export function parseBoolean(value: string | null): boolean | undefined {
  if (value == null) return undefined;
  if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
  return undefined;
}

export function parsePeriod(value: string | null): PeriodKey | undefined {
  if (!value) return undefined;
  if (PERIOD_KEYS.includes(value as PeriodKey)) return value as PeriodKey;
  return value;
}

export function parseJsonParam<T>(value: string | null): T | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(value)))) as T;
    } catch {
      return undefined;
    }
  }
}

export function formatDateTime(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function resolveSummary(payload: SummaryPayload, period: PeriodKey): string {
  return payload.summaries?.[period] || payload.summary || '';
}

export function resolveUpdatedAt(payload: SummaryPayload, period: PeriodKey): string | undefined {
  return payload.updatedAtByPeriod?.[period] || payload.updatedAt;
}
