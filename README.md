# 数据分析展示器

用于飞书多维表格仪表盘的自定义插件。插件读取 aily 写入的「周报摘要」字段，在仪表盘中展示 Markdown 分析内容，并支持周/月/季度/半年切换与深色模式。

## 功能

- 接收分析结果：支持飞书 Dashboard SDK、URL 参数、React props 三种来源
- 渲染文字分析：支持标题、列表、粗体等常用 Markdown
- 时间维度切换：周、月、季度、半年
- 深色模式：自动跟随系统主题，也可通过 URL `theme=dark` 指定
- 飞书状态适配：创建/配置态优先使用 `getPreviewData`，展示态使用 `getData`

## 本地开发

```bash
npm install
npm run dev
```

构建：

```bash
npm run build
```

项目使用 Vite，并已按飞书插件部署要求设置：

```ts
base: './'
```

## URL 参数

可直接在自定义插件地址后追加参数进行调试：

```text
?title=周报摘要&period=week&summary=## 本周分析&updatedAt=2026-05-07T16:00:00%2B08:00
```

也支持通过 `data` 传入 JSON：

```json
{
  "title": "周报摘要",
  "period": "week",
  "summary": "## 本周分析\n\n### 优势\n- 过稿率提升",
  "updatedAt": "2026-05-07T16:00:00+08:00",
  "summaries": {
    "week": "## 本周分析",
    "month": "## 本月分析",
    "quarter": "## 本季度分析",
    "half": "## 半年分析"
  }
}
```

## 数据字段

默认配置来自需求文档：

- App Token：`SPSTbnjWeaIbo3smY2UcAdVZnab`
- 表名：`过稿记录表`
- 分析字段：`周报摘要` / `fld_summary`

## 部署到飞书仪表盘

1. 执行 `npm run build`
2. 将 `dist` 部署到 Vercel、GitHub Pages 或自有静态服务
3. 在飞书多维表格仪表盘中选择「添加组件」->「更多」->「添加自定义插件」
4. 填入部署后的 URL

## 发布前检查

- 本地 `npm install` 成功
- 本地 `npm run build` 成功
- 创建/配置态预览正常
- 展示态读取数据正常
- 拖拽改变组件尺寸时布局正常
- 全屏模式下深色主题正常
