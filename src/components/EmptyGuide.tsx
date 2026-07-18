import { Empty, Typography } from '@douyinfe/semi-ui';
import { IconRefresh, IconSetting } from '@douyinfe/semi-icons';

interface EmptyGuideProps {
  needsSetup?: boolean;
}

export function EmptyGuide({ needsSetup = false }: EmptyGuideProps) {
  return (
    <div className="empty-guide">
      <Empty
        image={needsSetup ? <IconSetting size="extra-large" /> : <IconRefresh size="extra-large" />}
        title={needsSetup ? '等待配置内容' : '点击左上角刷新'}
        description={
          <Typography.Text type="secondary">
            {needsSetup ? '右边选择配置信息后预览内容。' : '数据拉取失败，请重试'}
          </Typography.Text>
        }
      />
    </div>
  );
}
