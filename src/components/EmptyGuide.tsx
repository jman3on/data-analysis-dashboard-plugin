import { Empty, Typography } from '@douyinfe/semi-ui';
import { IconSetting } from '@douyinfe/semi-icons';

export function EmptyGuide() {
  return (
    <div className="empty-guide">
      <Empty
        image={<IconSetting size="extra-large" />}
        title="等待配置内容"
        description={
          <Typography.Text type="secondary">
            右边选择配置信息后预览内容。
          </Typography.Text>
        }
      />
    </div>
  );
}
