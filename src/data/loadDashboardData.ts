import { DEFAULT_CONFIG, DEMO_SUMMARIES } from '../constants';
import { AppProps, DashboardData, PluginConfig, SummaryPayload } from '../types';
import { normalizePayload } from '../utils';
import { readSdkData } from './sdkSource';
import { readUrlData } from './urlSource';

function hasPayload(payload: SummaryPayload): boolean {
  return Boolean(payload.summary || payload.summaries || payload.title || payload.updatedAt);
}

function mergeConfig(...configs: Array<PluginConfig | undefined>): Required<PluginConfig> {
  return configs.reduce<Required<PluginConfig>>((merged, config) => {
    if (!config) return merged;

    return {
      tableId: config.tableId ?? merged.tableId,
      contentFieldId: config.contentFieldId ?? merged.contentFieldId,
      title: config.title ?? merged.title,
      showUpdatedAt: config.showUpdatedAt ?? merged.showUpdatedAt,
      defaultPeriod: config.defaultPeriod ?? merged.defaultPeriod,
      accentColor: config.accentColor ?? merged.accentColor,
      appearanceMode: config.appearanceMode ?? merged.appearanceMode,
      state: config.state ?? merged.state,
      dataConditions: config.dataConditions ?? merged.dataConditions,
    };
  }, DEFAULT_CONFIG);
}

function mergePayload(...payloads: Array<SummaryPayload | undefined>): SummaryPayload {
  return payloads.reduce<SummaryPayload>((merged, payload) => ({ ...merged, ...payload }), {});
}

export async function loadDashboardData(props?: AppProps): Promise<DashboardData> {
  const urlData = readUrlData();
  const propPayload = normalizePayload(props?.analysisResult || window.__WEEKLY_SUMMARY_PLUGIN_DATA__);
  const initialState = urlData.config.state || DEFAULT_CONFIG.state;
  const sdkData = await readSdkData(initialState);

  const payload = mergePayload(
    { summaries: DEMO_SUMMARIES, updatedAt: new Date().toISOString() },
    sdkData?.payload,
    urlData.payload,
    propPayload,
  );

  const config = mergeConfig(sdkData?.config, urlData.config, {
    title: payload.title || urlData.config.title || sdkData?.config.title,
  });

  let source: DashboardData['source'] = 'demo';
  if (hasPayload(sdkData?.payload || {})) source = 'sdk';
  if (hasPayload(urlData.payload)) source = 'url';
  if (hasPayload(propPayload)) source = 'props';

  return { config, payload, source };
}
