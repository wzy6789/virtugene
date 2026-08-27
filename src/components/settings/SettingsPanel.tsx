import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useAuthStore } from '../../store/auth-store';
import { useChatStore } from '../../store/chat-store';
import { useCharacterStateStore } from '../../store/character-state-store';
import { useEmotionStore } from '../../store/emotion-store';
import { useUpdateStore } from '../../store/update-store';
import { useSettingsStore } from '../../store/settings-store';
import { userRepo } from '../../db/user-repo';
import { encryptApiKey, verifyPassword } from '../../lib/crypto';
import { ipc } from '../../lib/ipc-client';
import { resetDiaryUnlock } from '../../lib/diary-unlock';
import { DesktopSyncSection } from './DesktopSyncSection';
import { IS_ELECTRON } from '../../lib/platform';
import { DEFAULT_VOICE } from '../../lib/voice-map';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

function maskKey(apiKey: string): string {
  if (apiKey.length <= 7) return 'sk-****';
  return apiKey.slice(0, 5) + '****' + apiKey.slice(-4);
}

export function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { userId, username, apiKey, setApiKey, logout } = useAuthStore();
  const deleteAccount = useChatStore((s) => s.deleteAccount);
  const updateStatus = useUpdateStore((s) => s.status);
  const updateChecking = useUpdateStore((s) => s.checking);
  const checkUpdate = useUpdateStore((s) => s.check);
  const downloadUpdate = useUpdateStore((s) => s.download);
  const installUpdate = useUpdateStore((s) => s.install);
  const aiUsage = useSettingsStore((s) => s.aiUsage);
  const chatFontSize = useSettingsStore((s) => s.chatFontSize);
  const setChatFontSize = useSettingsStore((s) => s.setChatFontSize);
  const chatDensity = useSettingsStore((s) => s.chatDensity);
  const setChatDensity = useSettingsStore((s) => s.setChatDensity);
  const closeToTrayEnabled = useSettingsStore((s) => s.closeToTrayEnabled);
  const setCloseToTrayEnabled = useSettingsStore((s) => s.setCloseToTrayEnabled);
  const ttsEnabled = useSettingsStore((s) => s.ttsEnabled);
  const setTtsEnabled = useSettingsStore((s) => s.setTtsEnabled);
  const ttsSpeed = useSettingsStore((s) => s.ttsSpeed);
  const setTtsSpeed = useSettingsStore((s) => s.setTtsSpeed);
  const [modelStatus, setModelStatus] = useState<{ installed: boolean; sizeMB: number; dir: string } | null>(null);
  const [modelBusy, setModelBusy] = useState(false);

  // 打开时刷新语音模型状态
  useEffect(() => {
    if (!open || !IS_ELECTRON) return;
    void ipc.tts.modelStatus().then(setModelStatus).catch(() => {});
  }, [open]);

  // Key replacement state
  const [isReplacing, setIsReplacing] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  // Password for re-encryption
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // App version
  const [appVersion, setAppVersion] = useState('');

  useEffect(() => {
    if (!open) return;
    ipc.app.getVersion().then((v) => setAppVersion(v));
  }, [open]);

  const handleStartReplace = () => {
    setIsReplacing(true);
    setNewKey('');
    setPassword('');
    setKeyError(null);
  };

  const handleCancelReplace = () => {
    setIsReplacing(false);
    setNewKey('');
    setPassword('');
    setKeyError(null);
  };

  const handleValidateAndSave = async () => {
    if (!newKey.trim() || !password.trim()) return;
    setIsValidating(true);
    setKeyError(null);

    const result = await ipc.key.validate(newKey.trim());
    if (!result.valid) {
      setKeyError(result.error ?? 'Key 无效');
      setIsValidating(false);
      return;
    }

    // Verify password before re-encrypting
    if (!username || !userId) {
      setKeyError('用户信息丢失，请重新登录');
      setIsValidating(false);
      return;
    }

    const user = await userRepo.findByUsername(username);
    if (!user) {
      setKeyError('用户信息丢失，请重新登录');
      setIsValidating(false);
      return;
    }

    const pwdValid = await verifyPassword(password.trim(), user.passwordHash, user.passwordSalt);
    if (!pwdValid) {
      setKeyError('密码错误，请重新输入');
      setIsValidating(false);
      return;
    }

    // Re-encrypt the new key with the same password
    const salt = Uint8Array.from(atob(user.passwordSalt), (c) => c.charCodeAt(0));
    const { iv, ciphertext } = await encryptApiKey(newKey.trim(), password.trim(), salt);

    // Update IndexedDB user record
    await userRepo.update(userId, { apiKeyIv: iv, apiKeyCiphertext: ciphertext });

    // Update in-memory auth store
    setApiKey(newKey.trim());

    // Reset state
    setIsReplacing(false);
    setNewKey('');
    setPassword('');
    setKeyError(null);
    setIsValidating(false);
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    await deleteAccount();
    useCharacterStateStore.getState().clear();
    useEmotionStore.getState().clearCurrent();
    resetDiaryUnlock();
    localStorage.clear();
    logout();
    setIsDeleting(false);
    setShowDeleteConfirm(false);
    onClose();
  };

  const masked = apiKey ? maskKey(apiKey) : '';

  return (
    <>
      <Modal open={open} onClose={onClose} title="设置">
        <div className="p-6 space-y-6">
          {/* API Key section */}
          <div>
            <h3 className="text-sm font-medium text-ink mb-3">基因序列标识</h3>
            <div className="p-4 rounded-xl bg-surface border border-line space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">API Key</span>
                  <span className="text-sm text-ink font-mono">
                    {showKey ? apiKey : masked}
                  </span>
                </div>
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="text-xs text-gray-500 hover:text-sub transition-colors"
                >
                  {showKey ? '隐藏' : '显示'}
                </button>
              </div>

              {!isReplacing ? (
                <button
                  onClick={handleStartReplace}
                  className="text-xs text-life-cyan hover:underline"
                >
                  更换基因序列
                </button>
              ) : (
                <div className="space-y-3 pt-2 border-t border-line">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={newKey}
                    onChange={(e) => {
                      setNewKey(e.target.value);
                      setKeyError(null);
                    }}
                    placeholder="输入新的 API Key (sk-...)"
                    className="w-full px-3 py-2 bg-surface border border-line-strong rounded-lg text-sm text-ink placeholder-gray-500 focus:outline-none focus:border-gene-purple/50 transition-colors"
                  />
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="输入登录密码以确认"
                      className="w-full px-3 py-2 bg-surface border border-line-strong rounded-lg text-sm text-ink placeholder-gray-500 focus:outline-none focus:border-gene-purple/50 transition-colors"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-sub"
                    >
                      {showPassword ? '隐藏' : '显示'}
                    </button>
                  </div>
                  {keyError && (
                    <p className="text-xs text-red-400">{keyError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={handleValidateAndSave}
                      disabled={!newKey.trim() || !password.trim() || isValidating}
                      className="px-4 py-2 rounded-lg text-sm bg-gene-purple hover:bg-[#5B4BD4] disabled:opacity-30 text-white transition-colors"
                    >
                      {isValidating ? '验证中...' : '确认更换'}
                    </button>
                    <button
                      onClick={handleCancelReplace}
                      className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-surface transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 局域网同步：桌面端作为服务端供手机连接 */}
          {IS_ELECTRON && <DesktopSyncSection />}

          {/* AI 用量（本地估算） */}
          <div>
            <h3 className="text-sm font-medium text-ink mb-3">🤖 AI 用量</h3>
            <div className="p-4 rounded-xl bg-surface border border-line space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">今日消耗</span>
                <span className="text-sm font-mono text-ink tabular-nums">{aiUsage.todayTokens.toLocaleString()} tokens</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">本月消耗</span>
                <span className="text-sm font-mono text-ink tabular-nums">{aiUsage.monthTokens.toLocaleString()} tokens</span>
              </div>
              <p className="text-[11px] text-gray-500 pt-1">本地估算值，仅用于了解用量趋势；实际计费以 DeepSeek 平台账单为准。</p>
            </div>
          </div>

          {/* 聊天显示设置 */}
          <div>
            <h3 className="text-sm font-medium text-ink mb-3">💬 聊天显示</h3>
            <div className="p-4 rounded-xl bg-surface border border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">气泡字号</span>
                <div className="flex rounded-lg border border-line overflow-hidden">
                  {[['12', '小'], ['14', '中'], ['16', '大']].map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setChatFontSize(Number(v))}
                      className={`px-3 py-1.5 text-xs transition-colors ${chatFontSize === Number(v) ? 'bg-gene-purple/15 text-gene-purple' : 'text-gray-500 hover:text-ink'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">消息间距</span>
                <div className="flex rounded-lg border border-line overflow-hidden">
                  {[['0', '紧凑'], ['1', '标准'], ['2', '宽松']].map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setChatDensity(Number(v))}
                      className={`px-3 py-1.5 text-xs transition-colors ${chatDensity === Number(v) ? 'bg-gene-purple/15 text-gene-purple' : 'text-gray-500 hover:text-ink'}`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* App update（仅桌面端支持自动更新） */}
          {IS_ELECTRON && (
            <div>
              <h3 className="text-sm font-medium text-ink mb-3">基因序列更新</h3>
            <div className="p-4 rounded-xl bg-surface border border-line space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">当前版本</span>
                <span className="text-sm text-ink font-mono">{appVersion ? `v${appVersion}` : 'v...'}</span>
              </div>

              {updateStatus?.state === 'available' && (
                <button
                  onClick={downloadUpdate}
                  className="w-full px-4 py-2 rounded-lg text-sm bg-gene-purple text-white hover:bg-[#5B4BD4] transition-colors"
                >
                  下载新版本 v{updateStatus.version}
                </button>
              )}
              {updateStatus?.state === 'downloaded' && (
                <button
                  onClick={installUpdate}
                  className="w-full px-4 py-2 rounded-lg text-sm bg-gene-purple text-white hover:bg-[#5B4BD4] transition-colors"
                >
                  重启安装 v{updateStatus.version}
                </button>
              )}
              {updateStatus?.state === 'downloading' && (
                <p className="text-xs text-life-cyan">正在下载更新... {updateStatus.percent}%</p>
              )}
              {updateStatus?.state === 'not-available' && (
                <p className="text-xs text-sub">已是最新版本</p>
              )}
              {updateStatus?.state === 'error' && (
                <p className="text-xs text-red-400">{updateStatus.message}</p>
              )}

              <button
                onClick={checkUpdate}
                disabled={updateChecking}
                className="w-full px-4 py-2 rounded-lg text-sm text-ink bg-surface border border-line-strong hover:border-gene-purple/50 disabled:opacity-50 transition-colors"
              >
                {updateChecking ? '检查中...' : '检查更新'}
              </button>
            </div>
            </div>
          )}

          {/* 关闭行为：关闭到托盘 */}
          {IS_ELECTRON && (
            <div>
              <h3 className="text-sm font-medium text-ink mb-3">🪟 窗口行为</h3>
              <div className="p-4 rounded-xl bg-surface border border-line space-y-3">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500">关闭时最小化到托盘（后台继续收消息）</span>
                  <button
                    onClick={() => {
                      const next = !closeToTrayEnabled;
                      setCloseToTrayEnabled(next);
                      void ipc.window.setCloseToTray(next);
                    }}
                    className={`relative w-11 h-6 rounded-full transition-colors ${closeToTrayEnabled ? 'bg-gene-purple' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${closeToTrayEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </label>
                <p className="text-[11px] text-gray-500">开启后点右上角 ✕ 会隐藏到系统托盘，角色仍可主动发消息并通知你。退出请用托盘菜单「退出」。</p>
              </div>
            </div>
          )}

          {/* 语音（TTS） */}
          {IS_ELECTRON && (
            <div>
              <h3 className="text-sm font-medium text-ink mb-3">🎙 角色语音</h3>
              <div className="p-4 rounded-xl bg-surface border border-line space-y-3">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-500">启用角色语音（点击消息 🔊 朗读）</span>
                  <button
                    onClick={() => setTtsEnabled(!ttsEnabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${ttsEnabled ? 'bg-gene-purple' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${ttsEnabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </label>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">朗读语速</span>
                  <div className="flex rounded-lg border border-line overflow-hidden">
                    {[[0.8, '慢'], [1.0, '标准'], [1.2, '快']].map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => setTtsSpeed(Number(v))}
                        className={`px-3 py-1.5 text-xs transition-colors ${ttsSpeed === Number(v) ? 'bg-gene-purple/15 text-gene-purple' : 'text-gray-500 hover:text-ink'}`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 试听（Edge 优先 → 本地离线兜底 → 系统语音） */}
                <button
                  onClick={async () => {
                    const demoText = '你好，我是你的数字灵魂，很高兴认识你。';
                    try {
                      const r = await ipc.tts.synth({ text: demoText, voice: DEFAULT_VOICE.voice, sid: DEFAULT_VOICE.sid, rate: DEFAULT_VOICE.rate, pitch: DEFAULT_VOICE.pitch });
                      if (r.ok && r.audio) {
                        const binary = atob(r.audio);
                        const bytes = new Uint8Array(binary.length);
                        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                        const isWav = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
                        const url = URL.createObjectURL(new Blob([bytes], { type: isWav ? 'audio/wav' : 'audio/mpeg' }));
                        const audio = new Audio(url);
                        audio.play();
                        audio.onended = () => URL.revokeObjectURL(url);
                        return;
                      }
                    } catch {
                      /* 落入系统语音兜底 */
                    }
                    if ('speechSynthesis' in window) {
                      const u = new SpeechSynthesisUtterance(demoText);
                      const v = window.speechSynthesis.getVoices().filter((x) => x.lang.toLowerCase().startsWith('zh'))[0];
                      if (v) u.voice = v;
                      window.speechSynthesis.cancel();
                      window.speechSynthesis.speak(u);
                    }
                  }}
                  className="w-full px-4 py-2 rounded-lg text-sm text-ink bg-surface border border-line-strong hover:border-life-cyan/50 transition-colors"
                >
                  🔊 试听默认音色
                </button>

                {/* 离线语音模型（免代理） */}
                <div className="rounded-lg bg-panel/60 border border-line px-3 py-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">离线语音模型（免代理）</span>
                    {modelStatus?.installed ? (
                      <span className="text-[11px] text-life-cyan">已安装 {modelStatus.sizeMB}MB</span>
                    ) : (
                      <span className="text-[11px] text-gray-400">未安装</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {modelStatus?.installed ? (
                      <button
                        onClick={() => void (async () => {
                          await ipc.tts.modelRemove();
                          setModelStatus(await ipc.tts.modelStatus());
                        })()}
                        className="flex-1 px-3 py-1.5 rounded-lg text-[11px] text-gray-400 bg-surface border border-line hover:text-red-400 transition-colors"
                      >
                        删除模型
                      </button>
                    ) : (
                      <button
                        onClick={() => void (async () => {
                          setModelBusy(true);
                          await ipc.tts.modelDownload();
                          setModelBusy(false);
                          setModelStatus(await ipc.tts.modelStatus());
                        })()}
                        disabled={modelBusy}
                        className="flex-1 px-3 py-1.5 rounded-lg text-[11px] text-life-cyan bg-life-cyan/10 border border-life-cyan/30 hover:bg-life-cyan/20 transition-colors disabled:opacity-40"
                      >
                        {modelBusy ? '下载中…' : '⬇ 下载离线模型（约 163MB）'}
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-500">无需代理也能朗读；下载存 D 盘（D:\VirtuGeneModels）。有代理时优先用 Edge 音色。</p>
                </div>

                <p className="text-[11px] text-gray-500">语音由 AI 按角色形象自动挑选声线并固定；仅在你点击 🔊 时才发声。有代理 → Edge 高质量音色；无代理 → 离线模型；都不可用 → 系统语音兜底。</p>
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
            <h3 className="text-sm font-medium text-red-400 mb-2">危险区域</h3>
            <p className="text-xs text-gray-500 mb-3">
              注销后所有基因序列和对话记录将被永久抹除，此操作不可撤销。
            </p>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 rounded-lg text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
            >
              注销账号
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete account confirmation modal */}
      <Modal open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <div className="p-6">
          <p className="text-sm text-sub mb-2">
            所有基因序列和对话记录将被永久抹除，此操作不可撤销。
          </p>
          <p className="text-xs text-gray-500 mb-6">确认注销？</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-surface transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={isDeleting}
              className="px-4 py-2 rounded-lg text-sm bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50 transition-colors"
            >
              {isDeleting ? '注销中...' : '确认注销'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
