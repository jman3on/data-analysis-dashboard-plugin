export enum DashboardState {
  Create = 'Create',
  Config = 'Config',
  View = 'View',
  FullScreen = 'FullScreen',
}

export type PeriodKey = 'week' | 'month' | 'quarter' | 'half';

export interface PluginConfig {
  tableId?: string;
  contentFieldId?: string;
  title?: string;
  showUpdatedAt?: boolean;
  defaultPeriod?: PeriodKey;
  accentColor?: string;
  state?: DashboardState;
  dataConditions?: unknown;
}

export interface SummaryPayload {
  title?: string;
  summary?: string;
  updatedAt?: string;
  period?: PeriodKey;
  summaries?: Partial<Record<PeriodKey, string>>;
  updatedAtByPeriod?: Partial<Record<PeriodKey, string>>;
}

export interface AppProps {
  analysisResult?: SummaryPayload | string;
}

export interface DashboardData {
  config: Required<PluginConfig>;
  payload: SummaryPayload;
  source: 'sdk' | 'url' | 'props' | 'demo';
}
