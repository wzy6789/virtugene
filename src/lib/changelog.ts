export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.0.4',
    date: '2026-08-14',
    notes: [
      '修复设置面板版本号不随更新变化的问题',
      '新增更新公告：每次更新后展示本次变更内容',
      '优化长对话消息列表性能，200+ 条消息依然流畅',
      '全新 DNA 双螺旋启动动画',
      '支持一键复制聊天消息',
    ],
  },
];

export function getChangelog(version: string): ChangelogEntry | undefined {
  return CHANGELOG.find((c) => c.version === version);
}

export const LAST_SEEN_VERSION_KEY = 'virtugene:lastSeenVersion';
