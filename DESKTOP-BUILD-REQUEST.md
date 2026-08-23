# 申请单：重新构建 VirtuGene 桌面端（启用局域网同步功能）

> 提交方：VirtuGene 手机版改造会话
> 接收方：负责桌面端构建的工作聊天
> 状态：待执行

## 一、背景

VirtuGene 桌面端（Electron）已由手机版改造会话**完成代码改动**：新增了「局域网同步」能力，
用于与手机版互传角色/对话/日记。**当前已安装/运行的桌面 App 是旧版本，不含该功能，需要重新构建**。

## 二、已完成的代码改动（无需再改源码）

| 文件 | 改动 |
| :--- | :--- |
| `electron/services/sync-server.ts` | 新增：HTTP 同步服务（GET /sync/health、GET /sync/export、POST /sync/import，带 CORS） |
| `electron/ipc/sync.ts` | 新增：sync:start / stop / status / setExportData / importResult IPC |
| `electron/main.ts` | 注册 `registerSyncIPC()` |
| `electron/preload.ts` | 暴露 `window.virtugene.sync.*` |
| `src/components/settings/SyncSection.tsx` | 新增：设置面板「局域网同步」区块（桌面端=服务端开关，手机端=IP 拉取/推送） |
| `src/lib/sync.ts` / `src/store/sync-store.ts` | 新增：数据收集/合并写入、服务端快照保鲜、手机推送导入监听 |
| `src/lib/web-api.ts` 等 | 手机端 AI 直连与响应式布局（桌面端不受影响） |

验证：`npx tsc --noEmit` 零错误；`node scripts/build-electron.mjs` 构建通过。

## 三、需要执行的操作

工作目录：`F:\VirtuGene`

### 方式 A：开发模式直接运行（最快，验证功能）

```powershell
npm run dev
```

### 方式 B：打包成正式安装包（Windows）

```powershell
npm run build
npm run package
# 产物在 release/ 目录（NSIS 安装包 / 免安装版）
```

### 方式 C：仅构建产物（不打包）

```powershell
npm run build
# dist-electron/ + dist/renderer/ 即最新桌面端
```

## 四、构建后验证（验收标准）

1. 启动桌面端 → 设置面板出现「🧬 局域网同步（手机互联）」区块
2. 点「开启同步服务（端口 46789）」→ 显示 `http://<本机IP>:46789` 地址
3. 手机端（已安装 VirtuGene 手机版 APK）设置 → 局域网同步 → 填该 IP →
   点「拉取桌面数据」成功合并角色/对话/日记
4. 手机点「推送本机数据」→ 桌面端自动合并并在界面刷新

## 五、注意事项

- Node 环境：node v22、npm 11。npm 11 默认拦截 postinstall 脚本（`allowScripts`），
  若 Electron 二进制缺失，可执行 `node node_modules/electron/install.js` 手动补装；
  国内网络可设 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`。
- 打包若需改图标/版本，见 `resources/` 与 `package.json`（version 2.0.1）。
- 手机版 APK 已构建完成：`release/VirtuGene-2.0.1-debug.apk`，与本申请无依赖。

## 六、产出物

- [ ] 桌面端新版本产物（dist-electron/main.cjs + dist/renderer/，或 release/ 安装包）
- [ ] 同步服务验证通过（桌面设置面板可见并可开启）
