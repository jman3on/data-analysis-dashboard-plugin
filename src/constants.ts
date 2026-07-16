import { DashboardState, PeriodKey, PluginConfig } from './types';

export function getCurrentHalfYearPeriod(date = new Date()): PeriodKey {
  const year = date.getFullYear();
  const half = date.getMonth() < 6 ? '上半年' : '下半年';
  return `${year}${half}`;
}

export function getFallbackPeriodOptions(date = new Date()): Array<{ label: string; value: PeriodKey }> {
  const year = date.getFullYear();
  return [
    { label: `${year}上半年`, value: `${year}上半年` },
    { label: `${year}下半年`, value: `${year}下半年` },
  ];
}

export const DEFAULT_CONFIG: Required<PluginConfig> = {
  tableId: '',
  contentFieldId: '',
  contentTypeFieldId: '',
  contentTypeValue: '',
  designerFieldId: '',
  designerValue: '',
  timeFieldId: '',
  periodFields: [],
  title: '图表解读辅助',
  showUpdatedAt: true,
  showStatusTag: false,
  defaultPeriod: getCurrentHalfYearPeriod(),
  accentColor: '#3370ff',
  panelBackgroundColor: '#ffffff',
  textColor: '#1f2329',
  appearanceMode: 'light',
  textDisplayMode: 'preserve',
  textSize: 'medium',
  state: DashboardState.View,
  dataConditions: undefined,
};

export const PERIOD_OPTIONS: Array<{ label: string; value: PeriodKey }> = [
  ...getFallbackPeriodOptions(),
];

export const COLOR_OPTIONS = [
  '#343A40',
  '#3370FF',
  '#5B5CE2',
  '#2FB344',
  '#22B8CF',
  '#FAB005',
  '#FD7E14',
  '#F06565',
];

export const APPEARANCE_OPTIONS = [
  { label: '浅色', value: 'light' },
  { label: '跟随仪表盘', value: 'auto' },
  { label: '深色', value: 'dark' },
];

export const TEXT_DISPLAY_MODE_OPTIONS = [
  { label: '按原文换行', value: 'preserve' },
  { label: '智能分段', value: 'auto' },
  { label: '小标题模式', value: 'section' },
];

export const TEXT_SIZE_OPTIONS = [
  { label: '小', value: 'small' },
  { label: '中', value: 'medium' },
  { label: '大', value: 'large' },
];

export const DEMO_SUMMARIES: Record<PeriodKey, string> = {
  week: `## 本周视觉组过稿分析（5.1-5.7）

### 核心数据
- 本周新增过稿：23 条
- 过稿率：78.3%（较上周上升 5.2%）
- 平均过稿轮数：4.2 轮

### 关键洞察

**1. 马一鸣 过稿效率最高**
- 过稿轮数 3.1（组均 4.2）
- 主要问题集中在「风格确认」环节

**2. 卡稿原因 TOP3**
- 风格/细节问题：占比 45%
- 大小/比例问题：占比 18%
- 颜色/饱和度问题：占比 12%

### 建议关注
- 细化-内部阶段平均耗时较长，建议提前对齐风格参考`,
  month: `## 本月视觉组过稿分析

### 突破点
- 整体过稿率连续 3 周提升，返修集中度下降。
- 加急单响应速度比上月更稳定。

### 优势
- 风格确认前置后，首轮通过率明显改善。
- 设计师之间的问题类型分布更均衡。

### 薄弱项
- 细节和比例问题仍是主要返修来源。
- 部分复杂资源在中后段评审等待较久。`,
  quarter: `## 本季度视觉组过稿分析

### 突破点
- 过稿效率在季度中段后持续改善。
- TOP 问题从流程等待转向设计细节，说明协作链路更顺。

### 优势
- 组内高效案例可沉淀为风格参考模板。
- 加急资源的排期识别更加及时。

### 薄弱项
- 低频但高成本的返修问题需要单独复盘。
- 新人资源的初稿稳定性仍需观察。`,
  half: `## 半年视觉组过稿分析

### 突破点
- 过稿数据已具备趋势复盘价值，可用于制定下阶段资源策略。
- 高频卡点逐步收敛到可标准化的问题。

### 优势
- 设计师效率差异变小，团队整体稳定性增强。
- 反馈闭环更完整，过稿完成率可持续跟踪。

### 薄弱项
- 长周期任务仍容易在细化阶段堆积。
- 建议建立问题标签和参考库，减少重复返修。`,
};
