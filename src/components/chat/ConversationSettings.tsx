import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useChatStore } from '../../store/chat-store';
import { useAuthStore } from '../../store/auth-store';
import { characterRepo } from '../../db/character-repo';
import { messageRepo } from '../../db/message-repo';
import { ipc } from '../../lib/ipc-client';
import {
  VOICE_POOL,
  LOCAL_VOICE_BANDS,
  EDGE_VOICE_TO_SLOT,
  pickSidByVoice,
  sanitizeVoiceProfile,
  completeVoiceProfile,
  type VoiceBand,
  type VoiceProfile,
} from '../../lib/voice-map';

const RATE_OPTIONS = ['-20%', '-10%', '+0%', '+10%', '+20%'];
const PITCH_OPTIONS = ['-15Hz', '-8Hz', '+0Hz', '+8Hz', '+15Hz'];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ConversationSettings({ open, onClose }: Props) {
  const characters = useChatStore((s) => s.characters);
  const selectedCharacterId = useChatStore((s) => s.selectedCharacterId);
  const currentSessionId = useChatStore((s) => s.currentSessionId);
  const messages = useChatStore((s) => s.messages);

  const character = characters.find((c) => c.id === selectedCharacterId) ?? null;

  const [hint, setHint] = useState('');
  const [judging, setJudging] = useState(false);
  const [judged, setJudged] = useState(false);
  const [judgeError, setJudgeError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);

  /** 停止当前试听 */
  const stopPreview = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingKey(null);
  }, []);

  // 关闭弹窗时停掉试听
  useEffect(() => {
    if (!open) stopPreview();
    return () => stopPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stopPreview]);

  if (!character) return null;

  const voice = character.voice;
  const band = voice?.band as VoiceBand | undefined;
  const bandInfo = LOCAL_VOICE_BANDS.find((b) => b.band === band);

  /** 保存声线（写库 + 同步内存；预设副本同样允许个性化） */
  const saveVoice = async (profile: VoiceProfile) => {
    const full = completeVoiceProfile(profile, character.id);
    await characterRepo.update(character.id, { voice: full });
    useChatStore.setState((s) => ({
      characters: s.characters.map((c) => (c.id === character.id ? { ...c, voice: full } : c)),
    }));
  };

  /** 试听一段语音（Edge 优先 → 本地兜底）；同 key 再点 = 停止；自动管理 ▶/⏸ 图标 */
  const playPreview = async (previewVoice: string, previewSid: number, key: string) => {
    if (playingKey === key) {
      stopPreview();
      return;
    }
    stopPreview();
    try {
      const r = await ipc.tts.synth({ text: '你好，我是你的数字灵魂，很高兴认识你。', voice: previewVoice, sid: previewSid, rate: '+0%', pitch: '+0Hz' });
      if (!r.ok || !r.audio) return;
      const binary = atob(r.audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const isWav = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
      const url = URL.createObjectURL(new Blob([bytes], { type: isWav ? 'audio/wav' : 'audio/mpeg' }));
      const audio = new Audio(url);
      audioRef.current = audio;
      const clear = () => {
        if (audioRef.current === audio) audioRef.current = null;
        URL.revokeObjectURL(url);
        setPlayingKey((k) => (k === key ? null : k));
      };
      audio.onended = clear;
      audio.onerror = clear;
      setPlayingKey(key);
      void audio.play();
    } catch {
      /* 试听失败静默 */
    }
  };

  /** 播放中显示两条竖线（⏸），否则显示 ▶ */
  const PlayIcon = ({ active }: { active: boolean }) =>
    active ? (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <rect x="5" y="4" width="5" height="16" rx="1.5" />
        <rect x="14" y="4" width="5" height="16" rx="1.5" />
      </svg>
    ) : (
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 8 5.5z" />
      </svg>
    );

  /** 试听某个音色：本地兜底用该音色专属池的 sid（不串音、不同性格词声音不同） */
  const previewVoiceWithSid = (edgeVoice: string): number => pickSidByVoice(edgeVoice, character.id);

  /** 手动选音色：Edge 音色 + 自动同步本地档位（性别强制一致） */
  const selectVoice = async (edgeVoice: string) => {
    await saveVoice({
      voice: edgeVoice,
      band: EDGE_VOICE_TO_SLOT[edgeVoice]?.band ?? (band ?? undefined),
      rate: voice?.rate ?? '+0%',
      pitch: voice?.pitch ?? '+0Hz',
    });
  };

  const setRate = async (rate: string) => {
    await saveVoice({ voice: voice?.voice ?? 'zh-CN-XiaoxiaoNeural', band, rate, pitch: voice?.pitch ?? '+0Hz' });
  };
  const setPitch = async (pitch: string) => {
    await saveVoice({ voice: voice?.voice ?? 'zh-CN-XiaoxiaoNeural', band, rate: voice?.rate ?? '+0%', pitch });
  };

  /** LLM 判定：用户输入期望 + 角色形象 → DeepSeek 重新选声线 */
  const runAIJudge = async () => {
    if (judging) return;
    const apiKey = useAuthStore.getState().apiKey;
    if (!apiKey) {
      setJudgeError('尚未配置 API Key，请先在「设置」中填写 DeepSeek API Key');
      return;
    }
    setJudging(true);
    setJudged(false);
    setJudgeError(null);
    try {
      const r = await ipc.voice.assign({
        apiKey,
        characterId: character.id,
        character: { name: character.name, systemPrompt: character.systemPrompt, tags: character.tags },
        userHint: hint.trim() || undefined,
      });
      if (r.voice) {
        await saveVoice(sanitizeVoiceProfile(r.voice));
        setHint('');
        setJudged(true);
        setTimeout(() => setJudged(false), 2500);
      } else {
        const msg = r.error === 'auth:invalid_key' ? 'API Key 无效，请到「设置」中更新' : (r.detail ? `AI 判定失败：${r.detail}` : 'AI 判定失败，请稍后重试');
        setJudgeError(msg);
      }
    } catch (err) {
      setJudgeError(`AI 判定失败：${(err as Error)?.message ?? err}`);
    }
    setJudging(false);
  };

  /** 清空当前会话（仅删消息，保留会话） */
  const clearSession = async () => {
    if (!currentSessionId) return;
    if (!window.confirm('确定清空当前会话的所有消息吗？此操作不可恢复。')) return;
    await messageRepo.deleteBySession(currentSessionId);
    useChatStore.setState({ messages: [], hasMoreMessages: false });
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  /** 导出当前会话为文本文件 */
  const exportSession = () => {
    if (messages.length === 0) return;
    const lines = [`与「${character.name}」的对话记录`, '='.repeat(24), ''];
    for (const m of messages) {
      const who = m.role === 'user' ? '我' : character.name;
      const t = new Date(m.createdAt).toLocaleString('zh-CN', { hour12: false });
      lines.push(`[${t}] ${who}：${m.content}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${character.name}-对话记录-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const femaleVoices = VOICE_POOL.filter((v) => v.gender === 'female');
  const maleVoices = VOICE_POOL.filter((v) => v.gender === 'male');

  const VoiceGrid = ({ list }: { list: typeof VOICE_POOL }) => (
    <div className="grid grid-cols-1 gap-1">
      {list.map((v) => {
        const active = voice?.voice === v.voice;
        const localBand = LOCAL_VOICE_BANDS.find((b) => b.band === EDGE_VOICE_TO_SLOT[v.voice]?.band);
        return (
          <div
            key={v.voice}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${active ? 'bg-gene-purple/15 ring-1 ring-gene-purple/40' : 'hover:bg-surface'}`}
            onClick={() => void selectVoice(v.voice)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                void playPreview(v.voice, previewVoiceWithSid(v.voice), `voice:${v.voice}`);
              }}
              title={playingKey === `voice:${v.voice}` ? '停止' : '试听'}
              className={`w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-xs bg-surface border transition-colors ${playingKey === `voice:${v.voice}` ? 'border-life-cyan/70 text-life-cyan' : 'border-line-strong hover:border-life-cyan/60 hover:text-life-cyan'}`}
            >
              <PlayIcon active={playingKey === `voice:${v.voice}`} />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-ink truncate">{v.vibe}</span>
                {active && <span className="text-[10px] text-gene-purple shrink-0">当前</span>}
              </div>
              <div className="text-[10px] text-gray-500 truncate">
                {v.gender === 'female' ? '👩' : '👨'} {v.voice.replace(/^zh-CN-/, '').replace(/Neural$/, '')}
                {localBand ? ` · 离线：${localBand.label}` : ''}
              </div>
            </div>
            {active && <span className="w-2 h-2 rounded-full bg-gene-purple shrink-0" />}
          </div>
        );
      })}
    </div>
  );

  return (
    <Modal open={open} onClose={onClose} title="对话设置" width="max-w-2xl">
      <div className="px-6 py-5 space-y-6">
        {/* ── 角色资料 ── */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 mb-2.5">角色档案</h3>
          <div className="flex items-start gap-3 rounded-xl bg-panel/60 border border-line px-3.5 py-3">
            <div className="w-11 h-11 rounded-xl bg-gene-purple/10 flex items-center justify-center text-2xl shrink-0">
              {character.avatar.startsWith('data:') ? <img src={character.avatar} alt="" className="w-full h-full rounded-xl object-cover" /> : character.avatar}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink">{character.name}</span>
                {character.isPreset && <span className="text-[10px] px-1.5 py-0.5 rounded bg-life-cyan/10 text-life-cyan">基因库</span>}
              </div>
              {character.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {character.tags.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-line text-gray-500">{t}</span>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2 leading-relaxed">{character.systemPrompt.slice(0, 140)}</p>
            </div>
          </div>
        </section>

        {/* ── 声线设置 ── */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 mb-2.5">声线设置</h3>

          {/* 当前声线 */}
          <div className="flex items-center justify-between rounded-xl bg-panel/60 border border-line px-3.5 py-2.5 mb-3">
            <div className="text-xs text-ink">
              <span className="text-gray-500">当前声线：</span>
              <span className="font-medium">{voice ? (VOICE_POOL.find((v) => v.voice === voice.voice)?.vibe ?? voice.voice) : '温柔自然（默认）'}</span>
              {bandInfo && <span className="ml-2 text-[11px] text-life-cyan">离线档位：{bandInfo.label}</span>}
              {Number.isInteger(voice?.sid) && <span className="ml-1.5 text-[11px] text-gray-500">sid {voice?.sid}</span>}
            </div>
            <button
              onClick={() => void playPreview(voice?.voice ?? 'zh-CN-XiaoxiaoNeural', voice?.sid ?? 0, 'current')}
              className={`text-[11px] px-2.5 py-1 rounded-lg transition-colors shrink-0 ${playingKey === 'current' ? 'bg-life-cyan/15 text-life-cyan' : 'bg-gene-purple/10 text-gene-purple hover:bg-gene-purple/20'}`}
            >
              <span className="inline-flex items-center gap-1">
                <PlayIcon active={playingKey === 'current'} />
                {playingKey === 'current' ? '停止' : '试听当前'}
              </span>
            </button>
          </div>

          {/* 语速 / 音调 */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl bg-panel/60 border border-line px-3 py-2.5">
              <div className="text-[11px] text-gray-500 mb-1.5">语速</div>
              <div className="flex gap-1">
                {RATE_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => void setRate(r)}
                    className={`flex-1 text-[11px] py-1 rounded-md transition-colors ${voice?.rate === r ? 'bg-gene-purple/15 text-gene-purple' : 'text-gray-500 hover:bg-surface'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-panel/60 border border-line px-3 py-2.5">
              <div className="text-[11px] text-gray-500 mb-1.5">音调</div>
              <div className="flex gap-1">
                {PITCH_OPTIONS.map((p) => (
                  <button
                    key={p}
                    onClick={() => void setPitch(p)}
                    className={`flex-1 text-[11px] py-1 rounded-md transition-colors ${voice?.pitch === p ? 'bg-gene-purple/15 text-gene-purple' : 'text-gray-500 hover:bg-surface'}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 手动选择（男女分组） */}
          <div className="text-[11px] text-gray-500 mb-1.5">手动选择音色（点击选中，▶ 可试听）</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-xl border border-line p-2.5">
              <div className="text-[10px] text-gray-400 mb-1.5">👩 女声</div>
              <VoiceGrid list={femaleVoices} />
            </div>
            <div className="rounded-xl border border-line p-2.5">
              <div className="text-[10px] text-gray-400 mb-1.5">👨 男声</div>
              <VoiceGrid list={maleVoices} />
            </div>
          </div>

          {/* LLM 判定 */}
          <div className="rounded-xl bg-panel/60 border border-line px-3 py-2.5">
            <div className="text-[11px] text-gray-500 mb-1.5">
              让 AI 重新判定 <span className="text-gray-400">（可补充你的期望，例如："想要慵懒磁性的御姐音，说话慢一点"）</span>
            </div>
            <div className="flex gap-2">
              <input
                value={hint}
                onChange={(e) => setHint(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void runAIJudge(); }}
                placeholder="描述你想要的声线…（留空则按角色形象判定）"
                className="flex-1 min-w-0 bg-surface border border-line-strong rounded-lg px-3 py-2 text-xs text-ink placeholder:text-gray-500 outline-none focus:border-life-cyan/60"
              />
              <button
                onClick={() => void runAIJudge()}
                disabled={judging}
                className="shrink-0 px-3.5 py-2 rounded-lg text-xs font-medium bg-gene-purple text-white hover:bg-gene-purple/90 disabled:opacity-50 transition-colors"
              >
                {judging ? '判定中…' : 'AI 判定'}
              </button>
            </div>
            {judged && <div className="text-[11px] text-life-cyan mt-1.5">✅ 声线已更新，点 🔊 即可试听新声音</div>}
            {judgeError && <div className="text-[11px] text-red-500 mt-1.5">⚠️ {judgeError}</div>}
          </div>
        </section>

        {/* ── 对话操作 ── */}
        <section>
          <h3 className="text-xs font-semibold text-gray-500 mb-2.5">对话操作</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => void clearSession()}
              className="px-3 py-2.5 rounded-xl text-xs text-ink bg-surface border border-line-strong hover:border-red-400/60 hover:text-red-500 transition-colors"
            >
              {cleared ? '✅ 已清空' : '🗑 清空当前会话'}
            </button>
            <button
              onClick={exportSession}
              disabled={messages.length === 0}
              className="px-3 py-2.5 rounded-xl text-xs text-ink bg-surface border border-line-strong hover:border-life-cyan/60 hover:text-life-cyan disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              📤 导出对话记录
            </button>
          </div>
        </section>
      </div>
    </Modal>
  );
}
