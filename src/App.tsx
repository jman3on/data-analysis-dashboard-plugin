import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { Button, Select, Spin, Tag, Toast, Typography } from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { DEFAULT_CONFIG, PERIOD_OPTIONS } from './constants';
import { loadDashboardData } from './data/loadDashboardData';
import { markDashboardRendered, saveDashboardConfig, subscribeSdkChanges } from './data/sdkSource';
import { ConfigPanel } from './components/ConfigPanel';
import { EmptyGuide } from './components/EmptyGuide';
import { MarkdownText } from './components/MarkdownText';
import { AppProps, DashboardData, DashboardState, PeriodKey, PluginConfig } from './types';
import { formatDateTime, resolveSummary, resolveUpdatedAt } from './utils';
import './styles.css';

export default function App(props: AppProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [draftConfig, setDraftConfig] = useState<Required<PluginConfig> | null>(null);
  const [period, setPeriod] = useState<PeriodKey>('week');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    refresh();
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const urlTheme = new URLSearchParams(window.location.search).get('theme');
      const dark = urlTheme ? urlTheme === 'dark' : mediaQuery.matches;
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.body.setAttribute('theme-mode', dark ? 'dark' : 'light');
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);

    let cleanup: () => void = () => undefined;
    subscribeSdkChanges(() => refresh()).then((unsubscribe) => {
      cleanup = unsubscribe;
    });

    return () => {
      mediaQuery.removeEventListener('change', applyTheme);
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!loading && data) {
      markDashboardRendered().catch(() => undefined);
    }
  }, [loading, data, period]);

  const config = draftConfig || data?.config || DEFAULT_CONFIG;
  const summary = useMemo(() => (data ? resolveSummary(data.payload, period) : ''), [data, period]);
  const updatedAt = useMemo(() => (data ? resolveUpdatedAt(data.payload, period) : undefined), [data, period]);
  const state = config.state || DashboardState.View;
  const isSetupState = state === DashboardState.Create || state === DashboardState.Config;
  const shellStyle = { '--accent': config.accentColor } as CSSProperties;

  const handleConfigChange = (nextConfig: Required<PluginConfig>) => {
    setDraftConfig(nextConfig);
    setPeriod(nextConfig.defaultPeriod);
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      const saved = await saveDashboardConfig(config);
      if (saved) {
        Toast.success('配置已保存');
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
            <div className="meta-row">
              <Tag color={data?.source === 'demo' ? 'amber' : 'green'} size="small">
                {data?.source === 'demo' ? '演示数据' : '实时数据'}
              </Tag>
              {state === DashboardState.FullScreen && <Tag size="small">全屏</Tag>}
            </div>
          </div>

          <div className="toolbar">
            <Select
              value={period}
              optionList={PERIOD_OPTIONS}
              size="small"
              className="period-select"
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

        <div className="summary-content">{summary ? <MarkdownText content={summary} /> : <EmptyGuide />}</div>

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
