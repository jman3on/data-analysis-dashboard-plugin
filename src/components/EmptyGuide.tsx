import { Empty, Typography } from '@douyinfe/semi-ui';
import { IconSetting } from '@douyinfe/semi-icons';

export function EmptyGuide() {
  return (
    <div className="empty-guide">
      <Empty
        image={<IconSetting size="extra-large" />}
        title="等待配置分析字段"
        description={
          <Typography.Text type="secondary">
            请选择「过稿记录表」和 aily 写入的「周报摘要」字段，或通过 URL 参数传入 summary。
          </Typography.Text>
        }
      />
    </div>
  );
}
