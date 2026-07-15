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
      contentTypeFieldId: config.contentTypeFieldId ?? merged.contentTypeFieldId,
      contentTypeValue: config.contentTypeValue ?? merged.contentTypeValue,
      designerFieldId: config.designerFieldId ?? merged.designerFieldId,
      designerValue: config.designerValue ?? merged.designerValue,
      timeFieldId: config.timeFieldId ?? merged.timeFieldId,
      periodFields: config.periodFields ?? merged.periodFields,
      title: config.title ?? merged.title,
      showUpdatedAt: config.showUpdatedAt ?? merged.showUpdatedAt,
      showStatusTag: config.showStatusTag ?? merged.showStatusTag,
      defaultPeriod: config.defaultPeriod ?? merged.defaultPeriod,
      accentColor: config.accentColor ?? merged.accentColor,
      panelBackgroundColor: config.panelBackgroundColor ?? merged.panelBackgroundColor,
      textColor: config.textColor ?? merged.textColor,
      appearanceMode: config.appearanceMode ?? merged.appearanceMode,
      textDisplayMode: config.textDisplayMode ?? merged.textDisplayMode,
      textSize: config.textSize ?? merged.textSize,
      state: config.state ?? merged.state,
      dataConditions: config.dataConditions ?? merged.dataConditions,
    };
  }, DEFAULT_CONFIG);
}

function mergePayload(...payloads: Array<SummaryPayload | undefined>): SummaryPayload {
  return payloads.reduce<SummaryPayload>((merged, payload) => ({ ...merged, ...payload }), {});
}

export async function loadDashboardData(props?: AppProps, configOverride?: PluginConfig): Promise<DashboardData> {
  const urlData = readUrlData();
  const propPayload = normalizePayload(props?.analysisResult || window.__WEEKLY_SUMMARY_PLUGIN_DATA__);
  const initialState = configOverride?.state || urlData.config.state || DEFAULT_CONFIG.state;
  const sdkData = await readSdkData(initialState, configOverride);

  const payload = mergePayload(
    { summaries: DEMO_SUMMARIES, updatedAt: new Date().toISOString() },
    sdkData?.payload,
    urlData.payload,
    propPayload,
  );

  const config = mergeConfig(sdkData?.config, urlData.config, configOverride, {
    title: payload.title || urlData.config.title || sdkData?.config.title,
  });

  let source: DashboardData['source'] = 'demo';
  if (hasPayload(sdkData?.payload || {})) source = 'sdk';
  if (hasPayload(urlData.payload)) source = 'url';
  if (hasPayload(propPayload)) source = 'props';

  return { config, payload, source };
}
