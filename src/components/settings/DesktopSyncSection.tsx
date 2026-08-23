import { useEffect, useState } from 'react';
import { useDesktopSyncStore } from '../../store/desktop-sync-store';

/**
 * 局域网同步 · 桌面服务端 UI：
 * 开启后本机成为同步服务端，手机在同一 Wi-Fi 下连接此地址即可拉取/推送数据。
 */
export function DesktopSyncSection() {
  const { running, port, url, addresses, error, lastImport, start, stop } = useDesktopSyncStore();
  const [customPort, setCustomPort] = useState('46789');

  useEffect(() => {
    void useDesktopSyncStore.getState().refresh();
  }, []);

  const inputCls =
    'w-full px-3 py-2 bg-surface border border-line-strong rounded-lg text-sm text-ink placeholder-gray-500 focus:outline-none focus:border-gene-purple/50 transition-colors';

  return (
    <div>
      <h3 className="text-sm font-medium text-ink mb-3">🧬 局域网同步（服务端）</h3>
      <div className="p-4 rounded-xl bg-surface border border-line space-y-3">
        {!running ? (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              开启后本机作为同步服务端，手机 VirtuGene 在同一 Wi-Fi 下连接下方地址即可互传角色、对话与日记（不含账号与 API Key）。
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 shrink-0">端口</span>
              <input
                value={customPort}
                onChange={(e) => setCustomPort(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="46789"
                inputMode="numeric"
                className={inputCls}
              />
              <button
                onClick={() => void start(Number(customPort || '46789'))}
                className="px-4 py-2 rounded-lg text-sm bg-gene-purple text-white hover:bg-[#5B4BD4] shadow-[0_2px_12px_rgba(108,92,231,0.35)] transition-all"
              >
                开启同步
              </button>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-life-cyan font-medium">🟢 同步服务运行中</span>
              <button
                onClick={() => void stop()}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-surface hover:text-red-400 transition-colors"
              >
                停止
              </button>
            </div>
            <div className="rounded-lg bg-panel/60 border border-line px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">手机连接地址</span>
                <span className="text-xs font-mono text-life-cyan">{url}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">端口</span>
                <span className="text-xs font-mono text-ink">{port}</span>
              </div>
            </div>
            {addresses.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {addresses.map((ip) => (
                  <span key={ip} className="px-2 py-0.5 rounded-md bg-surface border border-line text-[11px] font-mono text-sub">
                    http://{ip}:{port}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-gray-500">在手机 VirtuGene 的「设置 → 局域网同步」中输入上面的地址即可互传。</p>
            {lastImport && <p className="text-xs text-life-cyan">{lastImport}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
