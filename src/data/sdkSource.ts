import { DEFAULT_CONFIG } from '../constants';
import { DashboardState, PluginConfig, SummaryPayload } from '../types';

type UnknownRecord = Record<string, unknown>;

interface RuntimeSdk {
  state?: DashboardState | string;
  getConfig?: () => Promise<PluginConfig> | PluginConfig;
  getData?: () => Promise<unknown> | unknown;
  getPreviewData?: (dataConditions?: unknown) => Promise<unknown> | unknown;
  saveConfig?: (config: unknown) => Promise<boolean> | boolean;
  setRendered?: () => Promise<boolean> | boolean;
  onConfigChange?: (handler: (config: unknown) => void) => void;
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

function parseDashboardState(value: unknown): DashboardState | undefined {
  if (typeof value === 'string' && Object.values(DashboardState).includes(value as DashboardState)) {
    return value as DashboardState;
  }
  return undefined;
}

function normalizeConfig(config: unknown, fallbackState: DashboardState): PluginConfig {
  if (!config || typeof config !== 'object') return { state: fallbackState };
  const record = config as UnknownRecord;
  const customConfig =
    record.customConfig && typeof record.customConfig === 'object'
      ? (record.customConfig as PluginConfig)
      : {};

  return {
    ...(record as PluginConfig),
    ...customConfig,
    dataConditions: record.dataConditions || (record as PluginConfig).dataConditions,
    state: parseDashboardState((record as PluginConfig).state) || fallbackState,
  };
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

  const actualState = parseDashboardState(sdk.state) || state;
  const canReadSavedConfig = actualState !== DashboardState.Create;
  let config: PluginConfig = { state: actualState };
  if (canReadSavedConfig && sdk.getConfig) {
    try {
      config = normalizeConfig(await sdk.getConfig(), actualState);
    } catch {
      config = { state: actualState };
    }
  }
  const shouldPreview = actualState === DashboardState.Create || actualState === DashboardState.Config;
  const rawData =
    shouldPreview && sdk.getPreviewData
      ? await sdk.getPreviewData(config.dataConditions)
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

export async function saveDashboardConfig(config: PluginConfig): Promise<boolean> {
  const rawSdk = await loadRuntimeSdk();
  const sdk = rawSdk ? getDashboardSdk(rawSdk) : undefined;
  if (!sdk?.saveConfig) return false;

  const dataConditions =
    config.dataConditions ||
    (config.tableId
      ? [
          {
            tableId: config.tableId,
          },
        ]
      : []);

  return Boolean(
    await sdk.saveConfig({
      dataConditions,
      customConfig: {
        tableId: config.tableId,
        contentFieldId: config.contentFieldId,
        title: config.title,
        showUpdatedAt: config.showUpdatedAt,
        defaultPeriod: config.defaultPeriod,
        accentColor: config.accentColor,
      },
    }),
  );
}

export async function markDashboardRendered(): Promise<void> {
  const rawSdk = await loadRuntimeSdk();
  const sdk = rawSdk ? getDashboardSdk(rawSdk) : undefined;
  await sdk?.setRendered?.();
}
