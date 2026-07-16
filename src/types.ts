export enum DashboardState {
  Create = 'Create',
  Config = 'Config',
  View = 'View',
  FullScreen = 'FullScreen',
}

export type PeriodKey = string;
export type AppearanceMode = 'auto' | 'light' | 'dark';
export type TextDisplayMode = 'auto' | 'preserve' | 'section';
export type TextSize = 'small' | 'medium' | 'large';

export interface PeriodFieldConfig {
  label: string;
  value: PeriodKey;
  fieldId: string;
}

export interface PluginConfig {
  tableId?: string;
  contentFieldId?: string;
  contentTypeFieldId?: string;
  contentTypeValue?: string;
  designerFieldId?: string;
  designerValue?: string;
  timeFieldId?: string;
  periodFields?: PeriodFieldConfig[];
  title?: string;
  showUpdatedAt?: boolean;
  showStatusTag?: boolean;
  defaultPeriod?: PeriodKey;
  accentColor?: string;
  panelBackgroundColor?: string;
  textColor?: string;
  appearanceMode?: AppearanceMode;
  textDisplayMode?: TextDisplayMode;
  textSize?: TextSize;
  state?: DashboardState;
  dataConditions?: unknown;
}

export interface DataTableOption {
  label: string;
  value: string;
}

export interface DataFieldOption {
  label: string;
  value: string;
  fieldName?: string;
}

export interface SummaryPayload {
  title?: string;
  summary?: string;
  updatedAt?: string;
  period?: PeriodKey;
  summaries?: Partial<Record<PeriodKey, string>>;
  updatedAtByPeriod?: Partial<Record<PeriodKey, string>>;
  periodOptions?: Array<{ label: string; value: PeriodKey }>;
}

export interface AppProps {
  analysisResult?: SummaryPayload | string;
}

export interface DashboardData {
  config: Required<PluginConfig>;
  payload: SummaryPayload;
  source: 'sdk' | 'url' | 'props' | 'demo';
}
