import { useState } from 'react';
import { useSyncStore } from '../../store/sync-store';

/**
 * 局域网同步（手机端）：作为 HTTP 客户端直连桌面端同步服务。
 * 桌面端实现协议见 MOBILE.md（GET /sync/export、POST /sync/import，带 CORS）。
 */
export function SyncSection() {
  const { clientStatus, clientBusy, pullFromDesktop, pushToDesktop } = useSyncStore();
  const [host, setHost] = useState('');
  const [port, setPort] = useState('46789');

  const inputCls =
    'w-full px-3 py-2 bg-surface border border-line-strong rounded-lg text-sm text-ink placeholder-gray-500 focus:outline-none focus:border-gene-purple/50 transition-colors';

  return (
    <div>
      <h3 className="text-sm font-medium text-ink mb-3">🧬 局域网同步（桌面互联）</h3>
      <div className="p-4 rounded-xl bg-surface border border-line space-y-3">
        <div className="grid grid-cols-[1fr_96px] gap-2">
          <input
            value={host}
            onChange={(e) => setHost(e.target.value.trim())}
            placeholder="桌面端 IP，如 192.168.1.8"
            inputMode="decimal"
            className={inputCls}
          />
          <input
            value={port}
            onChange={(e) => setPort(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="端口"
            inputMode="numeric"
            className={inputCls}
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void pullFromDesktop(host, Number(port || '46789'))}
            disabled={!host || clientBusy}
            className="flex-1 px-4 py-2 rounded-lg text-sm bg-gene-purple text-white hover:bg-[#5B4BD4] disabled:opacity-30 shadow-[0_2px_12px_rgba(108,92,231,0.35)] transition-all"
          >
            拉取桌面数据
          </button>
          <button
            onClick={() => void pushToDesktop(host, Number(port || '46789'))}
            disabled={!host || clientBusy}
            className="flex-1 px-4 py-2 rounded-lg text-sm text-life-cyan bg-life-cyan/10 border border-life-cyan/30 hover:bg-life-cyan/20 disabled:opacity-30 transition-all"
          >
            推送本机数据
          </button>
        </div>

        {clientBusy && <p className="text-xs text-life-cyan animate-pulse">正在连接桌面端…</p>}
        {clientStatus && !clientBusy && <p className="text-xs text-gray-500 break-all">{clientStatus}</p>}

        <p className="text-[11px] text-gray-500">
          先在桌面端设置中开启「局域网同步」，并确保手机与电脑连接同一 Wi-Fi。互传角色、对话与日记，不含账号与 API Key。
        </p>
      </div>
    </div>
  );
}
