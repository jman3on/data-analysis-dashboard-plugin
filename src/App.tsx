import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Select, Spin, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { bridge } from '@lark-base-open/js-sdk';
import { DEFAULT_CONFIG, PERIOD_OPTIONS } from './constants';
import { loadDashboardData } from './data/loadDashboardData';
import { markDashboardRendered, saveDashboardConfig, subscribeSdkChanges } from './data/sdkSource';
import { ConfigPanel } from './components/ConfigPanel';
import { EmptyGuide } from './components/EmptyGuide';
import { MarkdownText } from './components/MarkdownText';
import { AppProps, DashboardData, DashboardState, PeriodKey, PluginConfig } from './types';
import { formatDateTime, resolveSummary, resolveUpdatedAt } from './utils';
import './styles.css';

type ResolvedTheme = 'light' | 'dark';

function normalizeTheme(theme: unknown): ResolvedTheme | undefined {
  if (typeof theme !== 'string') return undefined;
  const normalized = theme.toLowerCase();
  if (normalized === 'light') return 'light';
  if (normalized === 'dark') return 'dark';
  return undefined;
}

function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.dataset.theme = theme;
  document.body.setAttribute('theme-mode', theme);
}

export default function App(props: AppProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [draftConfig, setDraftConfig] = useState<Required<PluginConfig> | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('week');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const previewRequestId = useRef(0);

  const refresh = async (showToast = false) => {
    try {
      setRefreshing(true);
      const next = await loadDashboardData(props);
      setData(next);
      setDraftConfig(next.config);
      setPeriod(next.payload.period || next.config.defaultPeriod || 'week');
      if (showToast) Toast.success('已刷新');
    } catch (error) {
      Toast.error('读取分析结果失败');
      console.error(error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const config = draftConfig || data?.config || DEFAULT_CONFIG;
  const periodOptions = useMemo(
    () => (data?.payload.periodOptions?.length
      ? data.payload.periodOptions
      : config.periodFields.length
        ? config.periodFields.map(({ label, value }) => ({ label, value }))
        : PERIOD_OPTIONS),
    [config.periodFields, data?.payload.periodOptions],
  );
  const summary = useMemo(() => (data ? resolveSummary(data.payload, period) : ''), [data, period]);
  const updatedAt = useMemo(() => (data ? resolveUpdatedAt(data.payload, period) : undefined), [data, period]);
  const state = config.state || DashboardState.View;
  const isSetupState = state === DashboardState.Create || state === DashboardState.Config;
  const needsSetup = isSetupState && (!config.tableId || !config.designerValue || !config.contentFieldId);
  const hasConfiguredSource = Boolean(config.tableId && config.designerValue && config.contentFieldId);
  const hideDemoData = needsSetup || (hasConfiguredSource && data?.source === 'demo');
  const visibleSummary = hideDemoData ? '' : summary;
  const shellStyle = {
    '--accent': config.accentColor,
    '--surface': config.panelBackgroundColor,
    '--text': config.textColor,
  } as CSSProperties;

  useEffect(() => {
    refresh();

    let cleanup: () => void = () => undefined;
    subscribeSdkChanges(() => refresh()).then((unsubscribe) => {
      cleanup = unsubscribe;
    });

    return () => {
      cleanup();
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const urlTheme = normalizeTheme(new URLSearchParams(window.location.search).get('theme'));
    const forcedTheme = config.appearanceMode === 'light' || config.appearanceMode === 'dark'
      ? config.appearanceMode
      : undefined;

    let disposed = false;

    const applyFallbackTheme = () => {
      applyResolvedTheme(urlTheme || (mediaQuery.matches ? 'dark' : 'light'));
    };

    if (forcedTheme) {
      applyResolvedTheme(forcedTheme);
      return () => undefined;
    }

    if (urlTheme) {
      applyResolvedTheme(urlTheme);
      return () => undefined;
    }

    applyFallbackTheme();
    const themePromise = bridge.getTheme?.();
    themePromise?.then((theme) => {
        const resolved = normalizeTheme(theme);
        if (!disposed && resolved) applyResolvedTheme(resolved);
      })
      .catch(() => undefined);

    const unsubscribeTheme = bridge.onThemeChange?.((event) => {
      const resolved = normalizeTheme(event.data.theme);
      if (resolved) applyResolvedTheme(resolved);
    });

    mediaQuery.addEventListener('change', applyFallbackTheme);
    return () => {
      disposed = true;
      mediaQuery.removeEventListener('change', applyFallbackTheme);
      unsubscribeTheme?.();
    };
  }, [config.appearanceMode]);

  useEffect(() => {
    if (!loading && data) {
      markDashboardRendered().catch(() => undefined);
    }
  }, [loading, data, period]);

  useEffect(() => {
    if (!data || !periodOptions.length) return;

    const hasCurrentPeriod = periodOptions.some((option) => option.value === period);
    const firstPeriodWithContent = periodOptions.find((option) => resolveSummary(data.payload, option.value))?.value;
    const payloadPeriod = data.payload.period && periodOptions.some((option) => option.value === data.payload.period)
      ? data.payload.period
      : undefined;
    const fallbackPeriod = payloadPeriod || firstPeriodWithContent || periodOptions[0]?.value;

    if (!hasCurrentPeriod && fallbackPeriod && fallbackPeriod !== period) {
      setPeriod(fallbackPeriod);
    }
  }, [data, period, periodOptions]);

  const handleConfigChange = (nextConfig: Required<PluginConfig>) => {
    setDraftConfig(nextConfig);
    const requestId = previewRequestId.current + 1;
    previewRequestId.current = requestId;

    loadDashboardData(props, nextConfig)
      .then((next) => {
        if (previewRequestId.current !== requestId) return;
        setData({
          ...next,
          config: nextConfig,
        });

        const nextPeriodOptions = next.payload.periodOptions?.length
          ? next.payload.periodOptions
          : nextConfig.periodFields.length
            ? nextConfig.periodFields.map(({ label, value }) => ({ label, value }))
            : PERIOD_OPTIONS;
        const canKeepCurrentPeriod = nextPeriodOptions.some((option) => option.value === period);
        setPeriod(canKeepCurrentPeriod ? period : next.payload.period || nextPeriodOptions[0]?.value || 'week');
      })
      .catch((error) => {
        Toast.error('读取分析结果失败');
        console.error(error);
      });
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      const saved = await saveDashboardConfig(config);
      if (saved) {
        Toast.success('配置已保存');
        await refresh();
      } else {
        Toast.info('本地预览已更新，飞书内会保存配置');
      }
    } catch (error) {
      Toast.error('保存配置失败');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="dashboard-shell loading-shell">
        <Spin size="large" />
      </main>
    );
  }

  return (
    <main
      className={`dashboard-shell state-${state.toLowerCase()} ${isSetupState ? 'config-mode' : ''}`}
      style={shellStyle}
    >
      <section className="summary-panel">
        <header className="panel-header">
          <div className="title-block">
            <Typography.Title heading={4}>{config.title || '数据分析'}</Typography.Title>
            {(config.showStatusTag || state === DashboardState.FullScreen) && (
              <div className="meta-row">
                {config.showStatusTag && (
                  <Tag color={hideDemoData || data?.source === 'demo' ? 'amber' : 'green'} size="small">
                    {needsSetup ? '等待配置' : hideDemoData ? '等待数据' : data?.source === 'demo' ? '演示数据' : '实时数据'}
                  </Tag>
                )}
                {state === DashboardState.FullScreen && <Tag size="small">全屏</Tag>}
              </div>
            )}
          </div>

          <div className="toolbar">
            <Select
              value={period}
              optionList={periodOptions}
              size="small"
              className="period-select"
              dropdownClassName="period-select-dropdown"
              onChange={(value) => setPeriod(value as PeriodKey)}
            />
            <Button
              icon={<IconRefresh />}
              aria-label="刷新"
              theme="borderless"
              loading={refreshing}
              onClick={() => refresh(true)}
            />
          </div>
        </header>

        <div className="summary-content">
          {visibleSummary ? (
            <MarkdownText
              content={visibleSummary}
              displayMode={config.textDisplayMode}
              textSize={config.textSize}
            />
          ) : (
            <EmptyGuide />
          )}
        </div>

        {config.showUpdatedAt && updatedAt && (
          <footer className="panel-footer">
            <Typography.Text type="secondary">最后更新：{formatDateTime(updatedAt)}</Typography.Text>
        </footer>
        )}
      </section>

      {isSetupState && (
        <ConfigPanel
          config={config}
          saving={saving}
          onChange={handleConfigChange}
          onSave={handleSaveConfig}
        />
      )}
    </main>
  );
}
