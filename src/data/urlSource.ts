import { DEFAULT_CONFIG } from '../constants';
import { DashboardState, PluginConfig, SummaryPayload } from '../types';
import { parseBoolean, parseJsonParam, parsePeriod } from '../utils';

export function readUrlData(): { config: PluginConfig; payload: SummaryPayload } {
  const params = new URLSearchParams(window.location.search);
  const packed = parseJsonParam<SummaryPayload>(params.get('data'));
  const configPacked = parseJsonParam<PluginConfig>(params.get('config'));
  const showUpdatedAt = parseBoolean(params.get('showUpdatedAt'));
  const state = params.get('state') as DashboardState | null;

  return {
    config: {
      ...configPacked,
      title: params.get('title') || configPacked?.title,
      showUpdatedAt,
      state: state && Object.values(DashboardState).includes(state) ? state : configPacked?.state,
    },
    payload: {
      ...packed,
      title: params.get('payloadTitle') || packed?.title,
      summary: params.get('summary') || packed?.summary,
      updatedAt: params.get('updatedAt') || packed?.updatedAt,
      period: parsePeriod(params.get('period')) || packed?.period || 'week',
    } as SummaryPayload,
  };
}
