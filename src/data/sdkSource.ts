import { DEFAULT_CONFIG } from '../constants';
import { DashboardState, PluginConfig, SummaryPayload } from '../types';

type UnknownRecord = Record<string, unknown>;

interface RuntimeSdk {
  getConfig?: () => Promise<PluginConfig> | PluginConfig;
  getData?: () => Promise<unknown> | unknown;
  getPreviewData?: () => Promise<unknown> | unknown;
  onConfigChange?: (handler: (config: PluginConfig) => void) => void;
  onDataChange?: (handler: (data: unknown) => void) => void;
  dashboard?: RuntimeSdk;
  Dashboard?: RuntimeSdk;
}

declare global {
  interface Window {
    BIPluginSDK?: RuntimeSdk;
    __WEEKLY_SUMMARY_PLUGIN_DATA__?: SummaryPayload | string;
  }
}

async function loadRuntimeSdk(): Promise<RuntimeSdk | undefined> {
  if (window.BIPluginSDK) return window.BIPluginSDK;

  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<RuntimeSdk & { default?: RuntimeSdk }>;
    const sdkModule = await dynamicImport('@laravan/bi-sdk');
    return sdkModule.default || sdkModule;
  } catch {
    return undefined;
  }
}

function getDashboardSdk(sdk: RuntimeSdk): RuntimeSdk {
  return sdk.Dashboard || sdk.dashboard || sdk;
}

function pickString(record: UnknownRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function normalizeRows(data: unknown): UnknownRecord[] {
  if (Array.isArray(data)) return data.filter((item): item is UnknownRecord => Boolean(item && typeof item === 'object'));
  if (!data || typeof data !== 'object') return [];
  const record = data as UnknownRecord;
  const rows = record.records || record.rows || record.data;
  if (Array.isArray(rows)) return rows.filter((item): item is UnknownRecord => Boolean(item && typeof item === 'object'));
  return [record];
}

export async function readSdkData(
  state: DashboardState = DashboardState.View,
): Promise<{ config: PluginConfig; payload: SummaryPayload } | undefined> {
  const rawSdk = await loadRuntimeSdk();
  if (!rawSdk) return undefined;

  const sdk = getDashboardSdk(rawSdk);
  if (!sdk.getConfig && !sdk.getData && !sdk.getPreviewData) return undefined;

  const canReadSavedConfig = state !== DashboardState.Create;
  const config = canReadSavedConfig && sdk.getConfig ? await sdk.getConfig() : {};
  const shouldPreview = state === DashboardState.Create || state === DashboardState.Config;
  const rawData =
    shouldPreview && sdk.getPreviewData
      ? await sdk.getPreviewData()
      : sdk.getData
        ? await sdk.getData()
        : sdk.getPreviewData
          ? await sdk.getPreviewData()
          : undefined;
  const rows = normalizeRows(rawData);
  const latest = rows[0];

  if (!latest) {
    return {
      config,
      payload: {},
    };
  }

  const contentFieldId = config.contentFieldId || DEFAULT_CONFIG.contentFieldId;
  const summary = pickString(latest, [
    contentFieldId,
    '周报摘要',
    'summary',
    'analysis',
    'content',
    'text',
  ]);

  return {
    config,
    payload: {
      title: pickString(latest, ['title', '标题']),
      summary,
      updatedAt: pickString(latest, ['updatedAt', 'updated_at', '最后更新时间', '消息创建时间', 'fldvNYnYXl']),
    },
  };
}

export async function subscribeSdkChanges(onChange: () => void): Promise<() => void> {
  const rawSdk = await loadRuntimeSdk();
  if (!rawSdk) return () => undefined;

  const sdk = getDashboardSdk(rawSdk);
  sdk.onConfigChange?.(onChange);
  sdk.onDataChange?.(onChange);
  return () => undefined;
}
