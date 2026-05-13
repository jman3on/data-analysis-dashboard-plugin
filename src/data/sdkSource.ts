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

interface DataItemLike {
  value?: unknown;
  text?: unknown;
  groupKey?: unknown;
}

const CONTENT_FIELD_FALLBACKS = ['周', '月', '季度', '半年', '周报摘要', 'summary', 'analysis', 'content', 'text'];
const CONTENT_TYPE_FIELD_FALLBACKS = ['内容', '标题', '类型', '分类', 'contentType', 'type', 'category'];
const DESIGNER_FIELD_FALLBACKS = ['人员', '设计师', '成员', '姓名', '负责人', 'owner', 'designer', 'user'];
const TIME_FIELD_FALLBACKS = ['时间', '日期', '月份', '周期', 'period', 'time', 'date'];
const TITLE_FIELD_FALLBACKS = ['标题', 'title'];
const UPDATED_AT_FIELD_FALLBACKS = ['最后更新时间', '消息创建时间', 'updatedAt', 'updated_at'];
const ANALYSIS_FIELD_FALLBACKS = ['我的卡点', '待提升', '技能成长', '工作量/预警', '工作流/预警'];
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
    const fieldName = matchedField ? readFieldName(matchedField) : undefined;
    if (fieldId) {
      const byFieldId = cellToString(fields[fieldId]);
      if (byFieldId) return byFieldId;
    }
    if (fieldName && fieldName !== fieldId) {
      const byFieldName = cellToString(fields[fieldName]);
      if (byFieldName) return byFieldName;
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

function findFieldByNames(fieldMetas: FieldMetaLike[], names: string[], preferredFieldId?: string): FieldMetaLike | undefined {
  if (preferredFieldId) {
    const preferred = fieldMetas.find((field) => readFieldId(field) === preferredFieldId);
    if (preferred) return preferred;
  }
  return fieldMetas.find((field) => fieldMatchesAnyName(field, names));
}

function inferPeriodFields(fieldMetas: FieldMetaLike[], config: PluginConfig): PeriodFieldConfig[] {
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

function isDataItem(value: unknown): value is DataItemLike {
  return Boolean(value && typeof value === 'object' && ('value' in value || 'text' in value || 'groupKey' in value));
}

function cellDisplayText(value: unknown): string | undefined {
  if (isDataItem(value)) {
    return cellToString(value.text) || cellToString(value.value) || cellToString(value.groupKey);
  }
  return cellToString(value);
}

function isPositiveDataCell(value: unknown): boolean {
  if (!isDataItem(value)) return true;
  const rawValue = value.value;
  if (typeof rawValue === 'number') return rawValue > 0;
  const text = cellDisplayText(value);
  if (!text) return false;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric > 0 : true;
}

function uniqueTexts(texts: string[]): string[] {
  const seen = new Set<string>();
  return texts.filter((text) => {
    const normalized = normalizeComparableText(text);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function isLikelyAnalysisText(text?: string): text is string {
  if (!text) return false;
  const normalized = normalizeComparableText(text);
  if (!normalized) return false;
  if (normalized === 'bitable_dashboard_count') return false;
  if (['count', 'counter', '计数', '记录数'].includes(normalized)) return false;
  if (/^bitable_.*count$/.test(normalized)) return false;
  if (/^\d+(\.\d+)?$/.test(normalized)) return false;
  return text.trim().length >= 6;
}

function normalizeDataMatrix(data: unknown): DataItemLike[][] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((row): row is unknown[] => Array.isArray(row))
    .map((row) => row.filter(isDataItem));
}

function readDashboardMatrixPayload(rawData: unknown, config: PluginConfig): SummaryPayload | undefined {
  const matrix = normalizeDataMatrix(rawData);
  if (matrix.length === 0) return undefined;

  const headerRow = matrix[0] || [];
  const bodyRows = matrix.slice(1);
  const expectedContent = normalizeComparableText(config.contentTypeValue);
  const period = config.defaultPeriod || config.periodFields?.[0]?.value;
  const periodOptions = config.periodFields?.map(({ label, value }) => ({ label, value }));

  if (headerRow.length > 1 && bodyRows.length > 0) {
    const matchedRows = expectedContent
      ? bodyRows.filter((row) => normalizeComparableText(cellDisplayText(row[0])).includes(expectedContent))
      : bodyRows;

    const summaries = uniqueTexts(
      matchedRows.flatMap((row) =>
        headerRow.slice(1).map((header, index) => {
          const metric = row[index + 1];
          if (!isPositiveDataCell(metric)) return '';
          const text = cellDisplayText(header);
          return isLikelyAnalysisText(text) ? text : '';
        }),
      ),
    );

    if (summaries.length > 0) {
      return {
        summary: summaries.join('\n\n---\n\n'),
        summaries: period ? { [period]: summaries.join('\n\n---\n\n') } : undefined,
        period,
        periodOptions,
      };
    }
  }

  const rowSummaries = uniqueTexts(
    bodyRows
      .filter((row) => !expectedContent || normalizeComparableText(cellDisplayText(row[0])).includes(expectedContent))
      .map((row) => {
        const text = cellDisplayText(row[0]);
        return isLikelyAnalysisText(text) ? text : '';
      }),
  );

  if (rowSummaries.length > 0) {
    return {
      summary: rowSummaries.join('\n\n---\n\n'),
      summaries: period ? { [period]: rowSummaries.join('\n\n---\n\n') } : undefined,
      period,
      periodOptions,
    };
  }

  return undefined;
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

export async function loadContentValueOptions(tableId?: string, fieldId?: string): Promise<DataFieldOption[]> {
  if (!isValidTableId(tableId) || !fieldId) return [];

  try {
    const table = (await withTimeout(officialBase.getTableById?.(tableId))) as TableLike | undefined;
    const fieldMetas = ((await withTimeout(table?.getFieldMetaList?.())) || []) as FieldMetaLike[];
    const response = await withTimeout(table?.getRecords?.({ pageSize: 500 }));
    const records = response?.records || [];
    const seen = new Set<string>();

    return records
      .map((record) => {
        const fields = (record.fields && typeof record.fields === 'object' ? record.fields : record) as UnknownRecord;
        return pickCellString(fields, fieldMetas, [fieldId]);
      })
      .filter((value): value is string => {
        const normalized = normalizeComparableText(value);
        if (!normalized || seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      })
      .map((value) => ({ label: value, value }));
  } catch {
    return [];
  }
}

export async function loadDesignerOptions(tableId?: string): Promise<DataFieldOption[]> {
  if (!isValidTableId(tableId)) return [];

  try {
    const table = (await withTimeout(officialBase.getTableById?.(tableId))) as TableLike | undefined;
    const fieldMetas = ((await withTimeout(table?.getFieldMetaList?.())) || []) as FieldMetaLike[];
    const designerField = findFieldByNames(fieldMetas, DESIGNER_FIELD_FALLBACKS);
    const designerFieldId = designerField ? readFieldId(designerField) : undefined;
    if (!designerFieldId) return [];

    return loadContentValueOptions(tableId, designerFieldId);
  } catch {
    return [];
  }
}

export async function loadAnalysisFieldOptions(tableId?: string): Promise<DataFieldOption[]> {
  if (!isValidTableId(tableId)) return [];

  try {
    const table = (await withTimeout(officialBase.getTableById?.(tableId))) as TableLike | undefined;
    const fields = (await withTimeout(table?.getFieldMetaList?.())) as FieldMetaLike[] | undefined;
    return (fields || [])
      .map<DataFieldOption | undefined>((field) => {
        const value = readFieldId(field);
        const label = readFieldName(field) || value;
        if (!value || !label) return undefined;
        if (!fieldMatchesAnyName(field, ANALYSIS_FIELD_FALLBACKS)) return undefined;
        return { label, value, fieldName: label };
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
  const selectedContentField = config.contentFieldId
    ? fieldMetas.find((field) => readFieldId(field) === config.contentFieldId)
    : undefined;
  const selectedContentFieldName = selectedContentField ? readFieldName(selectedContentField) : undefined;
  const designerField = findFieldByNames(fieldMetas, DESIGNER_FIELD_FALLBACKS, config.designerFieldId);
  const designerFieldId = designerField ? readFieldId(designerField) : undefined;
  const timeField = findFieldByNames(fieldMetas, TIME_FIELD_FALLBACKS, config.timeFieldId);
  const timeFieldId = timeField ? readFieldId(timeField) : undefined;

  if (config.designerValue && config.contentFieldId && timeFieldId) {
    const expectedDesigner = normalizeComparableText(config.designerValue);
    const summaries: NonNullable<SummaryPayload['summaries']> = {};
    const periodOptions: NonNullable<SummaryPayload['periodOptions']> = [];
    let fallbackTitle: string | undefined;
    let fallbackUpdatedAt: string | undefined;

    for (const record of records) {
      const fields = (record.fields && typeof record.fields === 'object' ? record.fields : record) as UnknownRecord;
      const designer = pickCellString(fields, fieldMetas, [
        designerFieldId || '',
        ...DESIGNER_FIELD_FALLBACKS,
      ]);
      if (expectedDesigner && normalizeComparableText(designer) !== expectedDesigner) continue;

      const periodLabel = pickCellString(fields, fieldMetas, [timeFieldId, ...TIME_FIELD_FALLBACKS]);
      const summary = pickCellString(fields, fieldMetas, [config.contentFieldId]);
      if (!periodLabel || !summary) continue;

      summaries[periodLabel] = summary;
      periodOptions.push({ label: periodLabel, value: periodLabel });
      fallbackTitle = fallbackTitle || pickCellString(fields, fieldMetas, TITLE_FIELD_FALLBACKS);
      fallbackUpdatedAt = fallbackUpdatedAt || pickCellString(fields, fieldMetas, UPDATED_AT_FIELD_FALLBACKS);
    }

    const selectedPeriod = periodOptions[0]?.value;
    const summary = selectedPeriod ? summaries[selectedPeriod] : undefined;
    if (summary) {
      return {
        title: fallbackTitle || selectedContentFieldName || config.title,
        summary,
        summaries,
        period: selectedPeriod,
        periodOptions,
        updatedAt: fallbackUpdatedAt,
      };
    }
  }

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
    const selectedPeriod = summaries[config.defaultPeriod || ''] ? config.defaultPeriod : periodFields[0]?.value;
    const summary = summaries[selectedPeriod || ''] || pickCellString(fields, fieldMetas, contentKeys);
    if (!summary) continue;

    return {
      title: pickCellString(fields, fieldMetas, TITLE_FIELD_FALLBACKS),
      summary,
      summaries,
      period: selectedPeriod,
      periodOptions: periodFields.map(({ label, value }) => ({ label, value })),
      updatedAt: pickCellString(fields, fieldMetas, UPDATED_AT_FIELD_FALLBACKS),
    };
  }

  return undefined;
}

async function resolveDataConditions(config: PluginConfig): Promise<UnknownRecord[]> {
  const savedConditions = normalizeDataConditions(config.dataConditions);
  const savedCondition = savedConditions[0];

  const tableId = isValidTableId(config.tableId)
    ? config.tableId
    : isValidTableId(savedCondition?.tableId)
      ? String(savedCondition?.tableId)
      : await getDefaultTableId();
  if (!tableId) return [];

  const groupFieldIds = [
    config.designerFieldId,
    config.contentTypeFieldId,
  ].filter((fieldId, index, fields): fieldId is string =>
    Boolean(fieldId && fields.indexOf(fieldId) === index),
  );

  return [
    {
      tableId,
      dataRange: savedCondition?.dataRange,
      groups: groupFieldIds.map((fieldId) => ({ fieldId })),
      series: 'COUNTA',
    },
  ];
}

export async function readSdkData(
  state: DashboardState = DashboardState.View,
  configOverride?: PluginConfig,
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
  if (configOverride) {
    config = {
      ...config,
      ...configOverride,
      dataConditions: configOverride.dataConditions ?? config.dataConditions,
      state: actualState,
    };
  }

  const shouldPreview = actualState === DashboardState.Create || actualState === DashboardState.Config;
  const dataConditions = await resolveDataConditions(config);
  const hasDataConditions = dataConditions.length > 0;
  let rawData: unknown;
  try {
    rawData =
      shouldPreview && sdk.getPreviewData && hasDataConditions
        ? await withTimeout(sdk.getPreviewData(dataConditions))
        : !shouldPreview && sdk.getData
          ? await withTimeout(sdk.getData())
          : undefined;
  } catch {
    rawData = undefined;
  }

  const basePayload = await readBaseTablePayload(config).catch(() => undefined);
  if (basePayload?.summary) {
    return {
      config,
      payload: basePayload,
    };
  }

  const dashboardPayload = readDashboardMatrixPayload(rawData, config);
  if (dashboardPayload?.summary) {
    return {
      config,
      payload: dashboardPayload,
    };
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
        designerFieldId: config.designerFieldId,
        designerValue: config.designerValue,
        timeFieldId: config.timeFieldId,
        periodFields: [],
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
