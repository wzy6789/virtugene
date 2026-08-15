export interface ChangelogEntry {
  version: string;
  date: string;
  notes: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '1.1.0',
    date: '2026-08-15',
    notes: [
      '角色库扩充至 12 位数字灵魂，覆盖温柔/傲娇/治愈/神秘/热血等类型',
      '角色创建升级：AI 一次生成完整基因序列（标签/签名/开场白/性格），支持多候选对比',
      '新增关系系统：好感度五档「初识→熟悉→亲近→挚友→知己」，越聊越熟，进阶有里程碑动画',
      '新增情绪系统：愉悦度心情曲线 + 每 3 条自动分析情绪，角色会带出情绪回应',
      '新增新手引导：欢迎弹窗 + 气泡提示，一键开聊',
      '消息支持引用/删除，新增「对方正在输入」状态与消息到达动效',
      '侧边栏与情绪面板支持拖拽调宽',
      '角色档案卡：查看角色背景、性格标签与示例对话',
    ],
  },
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
