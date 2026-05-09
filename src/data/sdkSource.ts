import { DEFAULT_CONFIG } from '../constants';
import { DashboardState, PluginConfig, SummaryPayload } from '../types';
import { base as officialBase, dashboard as officialDashboard } from '@lark-base-open/js-sdk';

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

interface TableLike {
  id?: string;
  getMeta?: () => Promise<{ id?: string; name?: string }> | { id?: string; name?: string };
}

function withTimeout<T>(task: Promise<T> | T, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    Promise.resolve(task),
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error('SDK request timed out')), timeoutMs);
    }),
  ]);
}

declare global {
  interface Window {
    BIPluginSDK?: RuntimeSdk;
    __WEEKLY_SUMMARY_PLUGIN_DATA__?: SummaryPayload | string;
  }
}

async function loadRuntimeSdk(): Promise<RuntimeSdk | undefined> {
  if (officialDashboard) return officialDashboard as RuntimeSdk;
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

function isValidTableId(tableId: unknown): tableId is string {
  return typeof tableId === 'string' && /^tbl[A-Za-z0-9]/.test(tableId);
}

function normalizeDataConditions(dataConditions: unknown): UnknownRecord[] {
  if (!dataConditions) return [];
  const conditions = Array.isArray(dataConditions) ? dataConditions : [dataConditions];
  return conditions.filter((condition): condition is UnknownRecord => Boolean(condition && typeof condition === 'object'));
}

async function getDefaultTableId(): Promise<string | undefined> {
  try {
    const activeTable = (await withTimeout(officialBase.getActiveTable?.())) as TableLike | undefined;
    if (isValidTableId(activeTable?.id)) return activeTable.id;
    const activeMeta = await withTimeout(activeTable?.getMeta?.());
    if (isValidTableId(activeMeta?.id)) return activeMeta.id;
  } catch {
    // Some dashboard hosts do not expose active table; fall back to the table list.
  }

  try {
    const tableList = (await withTimeout(officialBase.getTableList?.())) as TableLike[] | undefined;
    const firstTable = tableList?.[0];
    if (isValidTableId(firstTable?.id)) return firstTable.id;
    const firstMeta = await withTimeout(firstTable?.getMeta?.());
    if (isValidTableId(firstMeta?.id)) return firstMeta.id;
  } catch {
    return undefined;
  }

  return undefined;
}

async function resolveDataConditions(config: PluginConfig): Promise<UnknownRecord[]> {
  const savedConditions = normalizeDataConditions(config.dataConditions);
  if (savedConditions.length > 0) return savedConditions;

  const tableId = isValidTableId(config.tableId) ? config.tableId : await getDefaultTableId();
  if (!tableId) return [];

  return [
    {
      tableId,
      series: 'COUNTA',
    },
  ];
}

export async function readSdkData(
  state: DashboardState = DashboardState.View,
): Promise<{ config: PluginConfig; payload: SummaryPayload } | undefined> {
  const rawSdk = await loadRuntimeSdk();
  if (!rawSdk) return undefined;

  const sdk = getDashboardSdk(rawSdk);
  if (!sdk.getConfig && !sdk.getData && !sdk.getPreviewData) return undefined;

  let actualState = parseDashboardState(sdk.state) || state;
  const canReadSavedConfig = actualState !== DashboardState.Create;
  let config: PluginConfig = { state: actualState };
  if (canReadSavedConfig && sdk.getConfig) {
    try {
      config = normalizeConfig(await withTimeout(sdk.getConfig()), actualState);
    } catch {
      actualState = DashboardState.Create;
      config = { state: actualState };
    }
  }
  const shouldPreview = actualState === DashboardState.Create || actualState === DashboardState.Config;
  const hasDataConditions = Array.isArray(config.dataConditions)
    ? config.dataConditions.length > 0
    : Boolean(config.dataConditions);
  let rawData: unknown;
  try {
    rawData =
      shouldPreview && sdk.getPreviewData && hasDataConditions
        ? await withTimeout(sdk.getPreviewData(config.dataConditions))
        : !shouldPreview && sdk.getData
          ? await withTimeout(sdk.getData())
          : undefined;
  } catch {
    rawData = undefined;
  }
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

  const dataConditions = await resolveDataConditions(config);
  if (dataConditions.length === 0) return false;

  return Boolean(
    await sdk.saveConfig({
      dataConditions,
      customConfig: {
        tableId: dataConditions[0]?.tableId || config.tableId,
        contentFieldId: config.contentFieldId,
        title: config.title,
        showUpdatedAt: config.showUpdatedAt,
        defaultPeriod: config.defaultPeriod,
        accentColor: config.accentColor,
        appearanceMode: config.appearanceMode,
      },
    }),
  );
}

export async function markDashboardRendered(): Promise<void> {
  const rawSdk = await loadRuntimeSdk();
  const sdk = rawSdk ? getDashboardSdk(rawSdk) : undefined;
  await sdk?.setRendered?.();
}
