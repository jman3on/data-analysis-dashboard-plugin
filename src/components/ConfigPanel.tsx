import { Button, Input, Select, Typography } from '@douyinfe/semi-ui';
import { APPEARANCE_OPTIONS, COLOR_OPTIONS, PERIOD_OPTIONS } from '../constants';
import { AppearanceMode, PeriodKey, PluginConfig } from '../types';

interface ConfigPanelProps {
  config: Required<PluginConfig>;
  saving: boolean;
  onChange: (config: Required<PluginConfig>) => void;
  onSave: () => void;
}

export function ConfigPanel({ config, saving, onChange, onSave }: ConfigPanelProps) {
  const update = (patch: Partial<Required<PluginConfig>>) => {
    onChange({
      ...config,
      ...patch,
    });
  };

  return (
    <aside className="config-panel">
      <div className="config-panel-scroll">
        <div className="config-field">
          <Typography.Text strong>标题</Typography.Text>
          <Input
            value={config.title}
            placeholder="数据分析"
            onChange={(value) => update({ title: value })}
          />
        </div>

        <div className="config-field">
          <Typography.Text strong>默认时间维度</Typography.Text>
          <Select
            value={config.defaultPeriod}
            optionList={PERIOD_OPTIONS}
            onChange={(value) => update({ defaultPeriod: value as PeriodKey, })}
          />
        </div>

        <label className="config-check">
          <input
            type="checkbox"
            checked={config.showUpdatedAt}
            onChange={(event) => update({ showUpdatedAt: event.currentTarget.checked })}
          />
          <span>显示最后更新时间</span>
        </label>

        <div className="config-field">
          <Typography.Text strong>外观模式</Typography.Text>
          <Select
            value={config.appearanceMode}
            optionList={APPEARANCE_OPTIONS}
            onChange={(value) => update({ appearanceMode: value as AppearanceMode })}
          />
        </div>

        <div className="config-field">
          <Typography.Text strong>强调色</Typography.Text>
          <div className="color-grid" role="radiogroup" aria-label="主题颜色">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                type="button"
                className={`color-swatch ${config.accentColor === color ? 'is-selected' : ''}`}
                style={{ backgroundColor: color }}
                aria-label={`选择颜色 ${color}`}
                onClick={() => update({ accentColor: color })}
              />
            ))}
          </div>
        </div>

        <div className="config-note">
          <Typography.Text type="secondary">
            修改配置会实时更新左侧预览；点击确定后会保存到仪表盘。
          </Typography.Text>
        </div>
      </div>

      <div className="config-actions">
        <Button theme="solid" type="primary" block loading={saving} onClick={onSave}>
          确定
        </Button>
      </div>
    </aside>
  );
}
