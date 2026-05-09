import { useEffect, useState } from 'react';
import { Button, Input, Select, Typography } from '@douyinfe/semi-ui';
import { APPEARANCE_OPTIONS, COLOR_OPTIONS } from '../constants';
import { loadContentValueOptions, loadDataFields, loadDataTables } from '../data/sdkSource';
import { AppearanceMode, DataFieldOption, DataTableOption, PluginConfig } from '../types';

interface ConfigPanelProps {
  config: Required<PluginConfig>;
  saving: boolean;
  onChange: (config: Required<PluginConfig>) => void;
  onSave: () => void;
}

export function ConfigPanel({ config, saving, onChange, onSave }: ConfigPanelProps) {
  const [tableOptions, setTableOptions] = useState<DataTableOption[]>([]);
  const [fieldOptions, setFieldOptions] = useState<DataFieldOption[]>([]);
  const [contentOptions, setContentOptions] = useState<DataFieldOption[]>([]);

  const update = (patch: Partial<Required<PluginConfig>>) => {
    onChange({
      ...config,
      ...patch,
    });
  };

  useEffect(() => {
    let disposed = false;
    loadDataTables().then((options) => {
      if (!disposed) setTableOptions(options);
    });
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    loadDataFields(config.tableId).then((options) => {
      if (disposed) return;
      setFieldOptions(options);

      if (!config.contentTypeFieldId) {
        const contentField = options.find((option) => option.fieldName === '内容' || option.label === '内容');
        if (contentField) {
          update({
            contentTypeFieldId: contentField.value,
            contentTypeValue: '',
          });
        }
      }
    });
    return () => {
      disposed = true;
    };
  }, [config.tableId, config.contentTypeFieldId]);

  useEffect(() => {
    let disposed = false;
    loadContentValueOptions(config.tableId, config.contentTypeFieldId).then((options) => {
      if (disposed) return;
      const hasCurrentValue = options.some((option) => option.value === config.contentTypeValue);
      setContentOptions(
        config.contentTypeValue && !hasCurrentValue
          ? [{ label: config.contentTypeValue, value: config.contentTypeValue }, ...options]
          : options,
      );
    });
    return () => {
      disposed = true;
    };
  }, [config.tableId, config.contentTypeFieldId, config.contentTypeValue]);

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
          <Typography.Text strong>数据表</Typography.Text>
          <Typography.Text type="secondary" className="config-help">
            选择存放分析结论的多维表格数据表。
          </Typography.Text>
          <Select
            value={config.tableId || undefined}
            optionList={tableOptions}
            placeholder={tableOptions.length ? '请选择数据表' : '未读取到数据表'}
            onChange={(value) => update({
              tableId: String(value || ''),
              contentFieldId: '',
              contentTypeFieldId: '',
              contentTypeValue: '',
              periodFields: [],
            })}
          />
        </div>

        <div className="config-field">
          <Typography.Text strong>内容项</Typography.Text>
          <Typography.Text type="secondary" className="config-help">
            选择这个插件要展示的分析维度，例如「过稿分析」。可以放置多个插件，分别选择不同内容项。
          </Typography.Text>
          <Select
            value={config.contentTypeValue || undefined}
            optionList={contentOptions}
            placeholder={
              config.contentTypeFieldId
                ? contentOptions.length ? '请选择内容项' : '未读取到内容项'
                : fieldOptions.length ? '未找到「内容」字段' : '请先选择数据表'
            }
            disabled={!config.contentTypeFieldId}
            onChange={(value) => update({ contentTypeValue: String(value || '') })}
          />
          {!config.contentTypeFieldId && (
            <Typography.Text type="secondary" className="config-help compact">
              插件会自动读取名为「内容」的字段，用它来识别过稿分析、影响力分析等内容项。
            </Typography.Text>
          )}
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
