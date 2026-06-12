import { useEffect, useState } from 'react';
import { Button, Input, Select, Typography } from '@douyinfe/semi-ui';
import { APPEARANCE_OPTIONS, COLOR_OPTIONS } from '../constants';
import { loadAnalysisFieldOptions, loadDataFields, loadDataTables, loadDesignerOptions } from '../data/sdkSource';
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
  const [designerOptions, setDesignerOptions] = useState<DataFieldOption[]>([]);
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

      const designerField = options.find((option) => ['人员', '设计师'].includes(option.fieldName || option.label));
      const timeField = options.find((option) => option.fieldName === '统计周期' || option.label === '统计周期');
      const patch: Partial<Required<PluginConfig>> = {};
      if (!config.designerFieldId && designerField) patch.designerFieldId = designerField.value;
      if (!config.timeFieldId && timeField) patch.timeFieldId = timeField.value;
      if (Object.keys(patch).length) update(patch);
    });
    return () => {
      disposed = true;
    };
  }, [config.tableId, config.designerFieldId, config.timeFieldId]);

  useEffect(() => {
    let disposed = false;
    loadDesignerOptions(config.tableId).then((options) => {
      if (disposed) return;
      const hasCurrentValue = options.some((option) => option.value === config.designerValue);
      setDesignerOptions(
        config.designerValue && !hasCurrentValue
          ? [{ label: config.designerValue, value: config.designerValue }, ...options]
          : options,
      );
    });
    return () => {
      disposed = true;
    };
  }, [config.tableId, config.designerValue]);

  useEffect(() => {
    let disposed = false;
    loadAnalysisFieldOptions(config.tableId).then((options) => {
      if (disposed) return;
      const hasCurrentValue = options.some((option) => option.value === config.contentFieldId);
      setContentOptions(
        config.contentFieldId && !hasCurrentValue
          ? [{ label: config.contentFieldId, value: config.contentFieldId }, ...options]
          : options,
      );
    });
    return () => {
      disposed = true;
    };
  }, [config.tableId, config.contentFieldId]);

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
              designerFieldId: '',
              designerValue: '',
              timeFieldId: '',
              periodFields: [],
            })}
          />
        </div>

        <div className="config-field">
          <Typography.Text strong>设计师</Typography.Text>
          <Typography.Text type="secondary" className="config-help">
            选择这个仪表盘对应的设计师，插件会只读取该设计师的数据。
          </Typography.Text>
          <Select
            value={config.designerValue || undefined}
            optionList={designerOptions}
            placeholder={
              config.designerFieldId
                ? designerOptions.length ? '请选择设计师' : '未读取到设计师'
                : fieldOptions.length ? '未找到「人员」字段' : '请先选择数据表'
            }
            disabled={!config.designerFieldId}
            onChange={(value) => update({ designerValue: String(value || '') })}
          />
          {!config.designerFieldId && (
            <Typography.Text type="secondary" className="config-help compact">
              插件会自动读取名为「人员」或「设计师」的字段。
            </Typography.Text>
          )}
        </div>

        <div className="config-field">
          <Typography.Text strong>数据列分类</Typography.Text>
          <Typography.Text type="secondary" className="config-help">
            选择这个插件要展示的分析列，例如「我的卡点」。可以放置多个插件，分别选择不同分类。
          </Typography.Text>
          <Select
            value={config.contentFieldId || undefined}
            optionList={contentOptions}
            placeholder={
              contentOptions.length ? '请选择数据列分类' : '未读取到可用分类列'
            }
            disabled={!contentOptions.length}
            onChange={(value) => {
              const nextContentFieldId = String(value || '');
              const selectedOption = contentOptions.find((option) => option.value === nextContentFieldId);
              update({
                contentFieldId: nextContentFieldId,
                title: selectedOption?.label || config.title,
              });
            }}
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
