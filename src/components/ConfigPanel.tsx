import { useEffect, useState } from 'react';
import { Button, Input, Select, Typography } from '@douyinfe/semi-ui';
import { APPEARANCE_OPTIONS, COLOR_OPTIONS, PERIOD_OPTIONS } from '../constants';
import { loadDataFields, loadDataTables } from '../data/sdkSource';
import { AppearanceMode, DataFieldOption, DataTableOption, PeriodFieldConfig, PeriodKey, PluginConfig } from '../types';

interface ConfigPanelProps {
  config: Required<PluginConfig>;
  saving: boolean;
  onChange: (config: Required<PluginConfig>) => void;
  onSave: () => void;
}

export function ConfigPanel({ config, saving, onChange, onSave }: ConfigPanelProps) {
  const [tableOptions, setTableOptions] = useState<DataTableOption[]>([]);
  const [fieldOptions, setFieldOptions] = useState<DataFieldOption[]>([]);
  const periodOptions = config.periodFields.length
    ? config.periodFields.map(({ label, value }) => ({ label, value }))
    : PERIOD_OPTIONS;

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
      if (!disposed) setFieldOptions(options);
    });
    return () => {
      disposed = true;
    };
  }, [config.tableId]);

  const updatePeriodFields = (value: unknown) => {
    const selectedFieldIds = Array.isArray(value) ? value.map(String) : [];
    const nextPeriodFields: PeriodFieldConfig[] = selectedFieldIds
      .map((fieldId) => {
        const field = fieldOptions.find((option) => option.value === fieldId);
        if (!field) return undefined;
        return {
          fieldId,
          label: field.fieldName || field.label,
          value: fieldId,
        };
      })
      .filter((field): field is PeriodFieldConfig => Boolean(field));

    update({
      periodFields: nextPeriodFields,
      defaultPeriod: nextPeriodFields[0]?.value || 'week',
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
              periodFields: [],
            })}
          />
        </div>

        <div className="config-field">
          <Typography.Text strong>内容类型字段</Typography.Text>
          <Typography.Text type="secondary" className="config-help">
            选择区分「过稿分析 / 影响力分析」这类标题的字段，通常是「内容」。
          </Typography.Text>
          <Select
            value={config.contentTypeFieldId || undefined}
            optionList={fieldOptions}
            placeholder="例如：内容"
            onChange={(value) => update({ contentTypeFieldId: String(value || '') })}
          />
        </div>

        <div className="config-field">
          <Typography.Text strong>内容标题</Typography.Text>
          <Typography.Text type="secondary" className="config-help">
            填写要展示的那一行标题，例如「过稿分析」。留空则读取当前权限范围内第一条有内容的记录。
          </Typography.Text>
          <Input
            value={config.contentTypeValue || ''}
            placeholder="例如：过稿分析"
            onChange={(value) => update({ contentTypeValue: value })}
          />
        </div>

        <div className="config-field">
          <Typography.Text strong>默认时间维度</Typography.Text>
          <Select
            value={config.defaultPeriod}
            optionList={periodOptions}
            onChange={(value) => update({ defaultPeriod: value as PeriodKey, })}
          />
        </div>

        <div className="config-field">
          <Typography.Text strong>时间维度字段</Typography.Text>
          <Typography.Text type="secondary" className="config-help">
            多选承载分析结论的字段，例如「周、月、季度、半年」。下拉时间维度会跟随这里变化。
          </Typography.Text>
          {fieldOptions.length > 0 ? (
            <Select
              multiple
              value={config.periodFields.map((field) => field.fieldId)}
              optionList={fieldOptions}
              placeholder="自动识别：周 / 月 / 季度 / 半年"
              onChange={updatePeriodFields}
            />
          ) : (
            <Input
              value={config.contentFieldId || ''}
              placeholder="无法读取字段时，可填写一个备用字段名或字段 ID"
              onChange={(value) => update({ contentFieldId: value })}
            />
          )}
          <Typography.Text type="secondary" className="config-help compact">
            不选择时会自动匹配：周 / 月 / 季度 / 半年 / summary / analysis / content / text
          </Typography.Text>
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
