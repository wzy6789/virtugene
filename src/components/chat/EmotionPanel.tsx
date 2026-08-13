import { useEffect } from 'react';
import { useEmotionStore } from '../../store/emotion-store';
import { useChatStore } from '../../store/chat-store';
import { useCharacterStateStore } from '../../store/character-state-store';
import { EmotionChart } from './EmotionChart';
import type { EmotionDimensions } from '../../db/index';

const DIM_LABELS: { key: keyof EmotionDimensions; label: string }[] = [
  { key: 'valence', label: '愉悦度' },
  { key: 'arousal', label: '唤醒度' },
  { key: 'intimacy', label: '亲密度' },
  { key: 'engagement', label: '投入度' },
  { key: 'expressiveness', label: '外显度' },
  { key: 'stability', label: '稳定度' },
];

function getValenceBadgeClass(valence: number) {
  if (valence >= 7.5) return 'bg-life-cyan/15 text-life-cyan border-life-cyan/25';
  if (valence >= 5) return 'bg-amber-500/15 text-amber-400 border-amber-500/25';
  if (valence >= 2.5) return 'bg-orange-500/15 text-orange-400 border-orange-500/25';
  return 'bg-red-500/15 text-red-400 border-red-500/25';
}

function deltaArrow(current: number, previous: number) {
  const diff = current - previous;
  if (diff >= 0.5) return { arrow: '↑', color: 'text-life-cyan' };
  if (diff <= -0.5) return { arrow: '↓', color: 'text-amber-400' };
  return { arrow: '→', color: 'text-gray-500' };
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
}

function moodColor(mood: number): string {
  if (mood >= 75) return '#00CEC9';
  if (mood >= 50) return '#FBBF24';
  if (mood >= 25) return '#FB923C';
  return '#F87171';
}

export function EmotionPanel() {
  const isPanelOpen = useEmotionStore((s) => s.isPanelOpen);
  const isAnalyzing = useEmotionStore((s) => s.isAnalyzing);
  const analysisError = useEmotionStore((s) => s.analysisError);
  const currentSnapshot = useEmotionStore((s) => s.currentSnapshot);
  const previousSnapshot = useEmotionStore((s) => s.previousSnapshot);
  const snapshots = useEmotionStore((s) => s.snapshots);
  const closePanel = useEmotionStore((s) => s.closePanel);
  const analyzeCurrentSession = useEmotionStore((s) => s.analyzeCurrentSession);
  const loadSessionSnapshots = useEmotionStore((s) => s.loadSessionSnapshots);

  const selectedCharacterId = useChatStore((s) => s.selectedCharacterId);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const characters = useChatStore((s) => s.characters);
  const messages = useChatStore((s) => s.messages);
  const affinity = useCharacterStateStore((s) => s.affinity);
  const mood = useCharacterStateStore((s) => s.mood);

  const character = characters.find((c) => c.id === selectedCharacterId);

  // Load snapshots when session changes
  useEffect(() => {
    if (currentSessionId && isPanelOpen) {
      loadSessionSnapshots(currentSessionId);
    }
  }, [currentSessionId, isPanelOpen, loadSessionSnapshots]);

  const handleAnalyze = () => {
    if (!selectedCharacterId || !currentSessionId || !character) return;
    analyzeCurrentSession(selectedCharacterId, currentSessionId, character.name);
  };

  // Select a history snapshot for preview
  const handleSelectSnapshot = (snapshot: typeof currentSnapshot) => {
    if (!snapshot) return;
    const idx = snapshots.findIndex((s) => s.id === snapshot.id);
    const prev = idx >= 0 && idx + 1 < snapshots.length ? snapshots[idx + 1] : null;
    useEmotionStore.setState({ currentSnapshot: snapshot, previousSnapshot: prev });
  };

  return (
    <div
      className="h-full flex flex-col bg-app border-l border-line shrink-0 overflow-hidden transition-all duration-300"
      style={{ width: isPanelOpen ? 280 : 0, opacity: isPanelOpen ? 1 : 0 }}
    >
      <div className="flex flex-col h-full" style={{ minWidth: 280 }}>
        {/* Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-line shrink-0">
          <span className="text-sm font-medium text-ink">
            {character ? `${character.name} 的情绪图谱` : '情绪图谱'}
          </span>
          <button
            onClick={closePanel}
            className="w-6 h-6 flex items-center justify-center rounded text-gray-500 hover:text-sub hover:bg-surface transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* 好感度 / 心情 */}
          <div className="rounded-xl bg-surface border border-line p-3 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">好感度</span>
                <span className="text-xs tabular-nums text-gray-400">{Math.round(affinity)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full bg-gene-purple transition-all duration-500"
                  style={{ width: `${affinity}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-500">心情</span>
                <span className="text-xs tabular-nums" style={{ color: moodColor(mood) }}>
                  {Math.round(mood)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-surface overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${mood}%`, backgroundColor: moodColor(mood) }}
                />
              </div>
            </div>
          </div>

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || messages.length === 0}
            className="w-full py-2.5 rounded-xl bg-gene-purple hover:bg-[#5B4BD4] disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium text-white transition-colors flex items-center justify-center gap-2"
          >
            {isAnalyzing ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="20" />
                </svg>
                正在解析情绪序列...
              </>
            ) : (
              '⚗ 分析情绪基因'
            )}
          </button>

          {/* Error banner */}
          {analysisError && (
            <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              {analysisError}
            </div>
          )}

          {/* Empty state */}
          {!currentSnapshot && !isAnalyzing && !analysisError && (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <span className="text-3xl mb-2">🧬</span>
              <span className="text-xs">尚未生成情绪图谱</span>
              <span className="text-xs text-gray-600 mt-1">点击上方按钮开始分析</span>
            </div>
          )}

          {/* Chart + badge + summary */}
          {currentSnapshot && (
            <>
              {/* Low message warning */}
              {currentSnapshot.messageCount < 4 && (
                <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
                  对话数据较少，分析可能不够准确
                </div>
              )}

              {/* Radar chart */}
              <div className="flex justify-center">
                <EmotionChart
                  dimensions={currentSnapshot.dimensions}
                  previousDimensions={previousSnapshot?.dimensions}
                  size={220}
                />
              </div>

              {/* Dominant emotion badge */}
              <div className="flex justify-center">
                <span
                  className={`text-xs px-3 py-1 rounded-full border ${getValenceBadgeClass(currentSnapshot.dimensions.valence)}`}
                >
                  {currentSnapshot.dominantEmotion}
                </span>
              </div>

              {/* Summary */}
              <p className="text-xs text-gray-400 leading-relaxed text-center">
                {currentSnapshot.summary}
              </p>

              {/* Delta indicators */}
              {previousSnapshot && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">情绪波动追踪</p>
                  {DIM_LABELS.map(({ key, label }) => {
                    const cur = currentSnapshot.dimensions[key];
                    const prev = previousSnapshot.dimensions[key];
                    const { arrow, color } = deltaArrow(cur, prev);
                    return (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{label}</span>
                        <div className="flex items-center gap-1.5 tabular-nums">
                          <span className="text-gray-400">{cur.toFixed(1)}</span>
                          <span className={color}>{arrow}</span>
                          <span className={color}>{Math.abs(cur - prev).toFixed(1)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* History list */}
              {snapshots.length > 1 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">历史图谱</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {snapshots.slice(1).map((snap) => (
                      <button
                        key={snap.id}
                        onClick={() => handleSelectSnapshot(snap)}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-surface transition-colors text-left"
                      >
                        <span className="text-xs text-gray-500">{formatTime(snap.createdAt)}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full border ${getValenceBadgeClass(snap.dimensions.valence)}`}
                        >
                          {snap.dominantEmotion}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
