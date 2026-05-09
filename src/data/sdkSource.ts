import { DEFAULT_CONFIG } from '../constants';
import {
  DashboardState,
  DataFieldOption,
  DataTableOption,
  PeriodFieldConfig,
  PluginConfig,
  SummaryPayload,
} from '../types';
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
  getName?: () => Promise<string> | string;
  getFieldMetaList?: () => Promise<FieldMetaLike[]> | FieldMetaLike[];
  getRecords?: (params?: { pageSize?: number }) => Promise<{ records?: RecordLike[] }> | { records?: RecordLike[] };
}

interface FieldMetaLike {
  id?: string;
  name?: string;
  fieldId?: string;
  fieldName?: string;
}

interface RecordLike {
  fields?: Record<string, unknown>;
  [key: string]: unknown;
}

const CONTENT_FIELD_FALLBACKS = ['周', '月', '季度', '半年', '周报摘要', 'summary', 'analysis', 'content', 'text'];
const CONTENT_TYPE_FIELD_FALLBACKS = ['内容', '标题', '类型', '分类', 'contentType', 'type', 'category'];
const TITLE_FIELD_FALLBACKS = ['标题', 'title'];
const UPDATED_AT_FIELD_FALLBACKS = ['最后更新时间', '消息创建时间', 'updatedAt', 'updated_at'];
const PERIOD_FIELD_CANDIDATES: Array<{ label: string; value: string; names: string[] }> = [
  { label: '周', value: 'week', names: ['周', '周报', '本周'] },
  { label: '月', value: 'month', names: ['月', '月报', '本月'] },
  { label: '季度', value: 'quarter', names: ['季度', '季报', '本季度'] },
  { label: '半年', value: 'half', names: ['半年', '半年度'] },
  { label: '年', value: 'year', names: ['年', '年度', '全年'] },
];

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

function readFieldId(field: FieldMetaLike): string | undefined {
  return field.id || field.fieldId;
}

function readFieldName(field: FieldMetaLike): string | undefined {
  return field.name || field.fieldName;
}

async function readTableName(table: TableLike, fallback: string): Promise<string> {
  try {
    const meta = await withTimeout(table.getMeta?.());
    if (meta?.name) return meta.name;
  } catch {
    // Continue with getName/id fallback.
  }

  try {
    const name = await withTimeout(table.getName?.());
    if (name) return name;
  } catch {
    // Continue with id fallback.
  }

  return fallback;
}

function cellToString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    const text = value
      .map((item) => cellToString(item))
      .filter(Boolean)
      .join('');
    return text.trim() || undefined;
  }

  if (typeof value === 'object') {
    const record = value as UnknownRecord;
    return (
      cellToString(record.text) ||
      cellToString(record.name) ||
      cellToString(record.value) ||
      cellToString(record.link) ||
      cellToString(record.url)
    );
  }

  return undefined;
}

function pickCellString(fields: UnknownRecord, fieldMetas: FieldMetaLike[], keys: string[]): string | undefined {
  for (const key of keys.filter(Boolean)) {
    const byRawKey = cellToString(fields[key]);
    if (byRawKey) return byRawKey;

    const matchedField = fieldMetas.find((field) => readFieldId(field) === key || readFieldName(field) === key);
    const fieldId = matchedField ? readFieldId(matchedField) : undefined;
    if (fieldId) {
      const byFieldId = cellToString(fields[fieldId]);
      if (byFieldId) return byFieldId;
    }
  }

  return undefined;
}

function normalizeComparableText(value?: string): string {
  return (value || '').replace(/\s+/g, '').toLowerCase();
}

function fieldMatchesAnyName(field: FieldMetaLike, names: string[]): boolean {
  const fieldName = normalizeComparableText(readFieldName(field));
  return names.some((name) => fieldName === normalizeComparableText(name));
}

function inferPeriodFields(fieldMetas: FieldMetaLike[], config: PluginConfig): PeriodFieldConfig[] {
  if (config.periodFields?.length) return config.periodFields;

  const inferred = PERIOD_FIELD_CANDIDATES
    .map((candidate) => {
      const field = fieldMetas.find((item) => fieldMatchesAnyName(item, candidate.names));
      const fieldId = field ? readFieldId(field) : undefined;
      if (!fieldId) return undefined;
      return {
        label: candidate.label,
        value: candidate.value,
        fieldId,
      };
    })
    .filter((field): field is PeriodFieldConfig => Boolean(field));

  if (inferred.length) return inferred;

  return CONTENT_FIELD_FALLBACKS
    .map((key) => {
      const field = fieldMetas.find((item) => readFieldId(item) === key || fieldMatchesAnyName(item, [key]));
      const fieldId = field ? readFieldId(field) : undefined;
      const label = field ? readFieldName(field) : undefined;
      if (!fieldId || !label) return undefined;
      return {
        label,
        value: fieldId,
        fieldId,
      };
    })
    .filter((field): field is PeriodFieldConfig => Boolean(field));
}

function recordMatchesContentType(fields: UnknownRecord, fieldMetas: FieldMetaLike[], config: PluginConfig): boolean {
  const expected = normalizeComparableText(config.contentTypeValue);
  if (!expected) return true;

  const contentType = pickCellString(fields, fieldMetas, [
    config.contentTypeFieldId || '',
    ...CONTENT_TYPE_FIELD_FALLBACKS,
  ]);
  return normalizeComparableText(contentType).includes(expected);
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

export async function loadDataTables(): Promise<DataTableOption[]> {
  try {
    const tableList = (await withTimeout(officialBase.getTableList?.())) as TableLike[] | undefined;
    if (!tableList?.length) return [];

    const options = await Promise.all(
      tableList.map(async (table) => {
        const meta = await withTimeout(table.getMeta?.()).catch(() => undefined);
        const value = isValidTableId(table.id) ? table.id : isValidTableId(meta?.id) ? meta?.id : undefined;
        if (!value) return undefined;

        return {
          label: await readTableName(table, meta?.name || value),
          value,
        };
      }),
    );

    return options.filter((option): option is DataTableOption => Boolean(option));
  } catch {
    return [];
  }
}

async function getTableByConfig(config: PluginConfig): Promise<TableLike | undefined> {
  const tableId = isValidTableId(config.tableId) ? config.tableId : await getDefaultTableId();
  if (!tableId) return undefined;

  try {
    return (await withTimeout(officialBase.getTableById?.(tableId))) as TableLike | undefined;
  } catch {
    return undefined;
  }
}

export async function loadDataFields(tableId?: string): Promise<DataFieldOption[]> {
  if (!isValidTableId(tableId)) return [];

  try {
    const table = (await withTimeout(officialBase.getTableById?.(tableId))) as TableLike | undefined;
    const fields = (await withTimeout(table?.getFieldMetaList?.())) as FieldMetaLike[] | undefined;
    return (fields || [])
      .map<DataFieldOption | undefined>((field) => {
        const value = readFieldId(field);
        const label = readFieldName(field) || value;
        return value && label ? { label, value, fieldName: label } : undefined;
      })
      .filter((option): option is DataFieldOption => Boolean(option));
  } catch {
    return [];
  }
}

async function readBaseTablePayload(config: PluginConfig): Promise<SummaryPayload | undefined> {
  const table = await getTableByConfig(config);
  if (!table?.getFieldMetaList || !table.getRecords) return undefined;

  const fieldMetas = ((await withTimeout(table.getFieldMetaList())) || []) as FieldMetaLike[];
  const response = await withTimeout(table.getRecords({ pageSize: 50 }));
  const records = response?.records || [];
  const periodFields = inferPeriodFields(fieldMetas, config);
  const contentKeys = [config.contentFieldId || '', ...periodFields.map((field) => field.fieldId), ...CONTENT_FIELD_FALLBACKS];

  for (const record of records) {
    const fields = (record.fields && typeof record.fields === 'object' ? record.fields : record) as UnknownRecord;
    if (!recordMatchesContentType(fields, fieldMetas, config)) continue;

    const summaries = periodFields.reduce<NonNullable<SummaryPayload['summaries']>>((result, periodField) => {
      const text = pickCellString(fields, fieldMetas, [periodField.fieldId]);
      if (text) result[periodField.value] = text;
      return result;
    }, {});
    const summary = summaries[config.defaultPeriod || ''] || pickCellString(fields, fieldMetas, contentKeys);
    if (!summary) continue;

    return {
      title: pickCellString(fields, fieldMetas, TITLE_FIELD_FALLBACKS),
      summary,
      summaries,
      period: config.defaultPeriod || periodFields[0]?.value,
      periodOptions: periodFields.map(({ label, value }) => ({ label, value })),
      updatedAt: pickCellString(fields, fieldMetas, UPDATED_AT_FIELD_FALLBACKS),
    };
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

  const basePayload = await readBaseTablePayload(config).catch(() => undefined);
  if (basePayload?.summary) {
    return {
      config,
      payload: basePayload,
    };
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

  const summary = pickString(latest, [
    config.contentFieldId || DEFAULT_CONFIG.contentFieldId,
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
        contentTypeFieldId: config.contentTypeFieldId,
        contentTypeValue: config.contentTypeValue,
        periodFields: config.periodFields,
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
