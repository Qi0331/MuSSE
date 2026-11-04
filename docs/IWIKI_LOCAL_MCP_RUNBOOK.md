# MuSSE — Windows 本地 iWiki MCP 桥接运行手册

> **2026-11-04 最新状态覆盖**：S4-D 任务与日程语音已按用户现场报告验收通过。Windows 当前同时运行官方 `iwiki` 远程 MCP 与新增 `musse_iwiki_readonly` 本地 stdio MCP，用户确认六个只读业务工具可见、新工具被调用，以及任务数量、今日、近期/逾期和普通聊天均正常。仅任务表完成私有 ID 映射；目标/笔记尚未验收。**以下“仅官方 MCP、业务尚未上线”属于 2026-11-03 的历史描述**，应以 [S4-D 最终交接](IWIKI_S4D_FINAL_HANDOFF.md) 为准。
- 当前运行仍用 `Set-Location "$HOME\MuSSE-MCP-Local\musse-bridge"` 后 `xiaozhi start`，保持电脑运行。管理面板 `http://localhost:9999/dashboard` 应见两个服务，其中新服务 6 工具。无需重新安装客户端或固件。
- 安装辅助脚本位于 `$HOME\MuSSE-Lab\MuSSE\software\musse-iwiki\tools\s4d-bridge.mjs`。出现故障先停止桥接，在该业务源码目录执行 `node tools/s4d-bridge.mjs --rollback`，再运行原桥接；只移除新增服务配置项，原官方 iWiki 保留。绝不上传含密钥备份或私人映射文件。


> 验证日期：2026-11-03。此手册描述**已经实际跑通**的独立 Windows 本地桥接，而不是尚未上线的 `software/musse-iwiki/` 业务 MCP 服务。用户确认 ESP32-S3 通过小智智能体语音查询 iWiki 成功；更细粒度的服务端写权限与长期稳定性未经独立审计。

## 一、链路与实际范围

```text
MuSSE ESP32-S3 (小智 v2.5.2 / bread-compact-wifi)
  ↕ 正常设备语音连接
小智官方云端 MuSSE 智能体
  ↕ 用户私有 MCP 接入点 (wss://...，不得入库)
Windows xiaozhi-client v2.3.0
  ↕ Streamable HTTP + Bearer Token（不得入库）
iWiki 官方远程 MCP https://ssemarket.cn/iwiki-api/mcp
```

本次**不**运行本仓库的 `software/musse-iwiki/src/mcp/server.ts`，亦不接入该目录的任务/日程/目标/笔记业务工具；那是另一条尚未完成真实联调的路线。无需为外部 MCP 修改 ESP32 固件。未部署腾讯云、CloudBase、NAS、Docker 或常驻后台服务。

## 二、下次开机：两条 PowerShell 命令

要求：电脑有网络，现有 MuSSE 设备已可正常联网，且**本机安装包与私有配置未被删除或覆盖**。

在普通 Windows PowerShell（不需要管理员权限）运行：

```powershell
Set-Location "$HOME\MuSSE-MCP-Local\musse-bridge"
xiaozhi start
```

- **保持此 PowerShell 窗口运行**，电脑不要休眠或断网；设备照常上电与语音交互即可。
- 在本机浏览器打开 `http://localhost:9999/dashboard`。正常目标：小智接入点为已连接（1 个），iWiki MCP 服务为 `1/1`，可看到查询工具。页面上单独的 “Xiaozhi Client 未连接” 或“实时语音 0/3”不等于这条 MCP 桥接链路故障；原有设备语音是小智官方云端处理。
- 停止桥接：在运行 `xiaozhi start` 的窗口按 `Ctrl+C`。停止或电脑休眠/关机后，iWiki 工具不可用，但设备原有普通语音对话仍可使用。
- 没有配置 Windows 开机自启动，也没有部署云端。**每次电脑重新开机，都需手动执行上述命令**。
- 无需再次烧录 ESP32、配网、绑定设备、重装 Node/npm 或创建 MCP 项目。

## 三、配置与工具权限（只在需要检查或恢复时）

项目本地目录：`$HOME\MuSSE-MCP-Local\musse-bridge`；私有配置为该目录下的 `xiaozhi.config.json`。

- `mcpEndpoint`：从小智官方控制台获取的个人 `wss://...` 接入点；URL 中含 Token。
- `mcpServers.iwiki`：`type: "http"`、`url: "https://ssemarket.cn/iwiki-api/mcp"`、`headers.Authorization: "Bearer <私人只读 iWiki Token>"`。该值只在本机配置，绝不粘贴至聊天、终端截图或公开仓库。
- 用户按只读 Token 方案联调；**服务端实际权限拒绝写操作尚未做负向验证**。管理页面默认发现了约 27 个 iWiki 工具，包括写入工具。应在工具管理里关闭不需要的写入/发布/上传/长期记忆和网页搜索工具，优先只留 `list_spaces`、`list_docs`、`list_doc_tree`、`search_kb`、`read_doc`、`get_doc_outline`。工具开关状态需按现场确认，不能仅凭只读 Token 视作已关闭。
- `software/musse-iwiki/config/xiaozhi-client.example.json` 是原业务 MCP 方案的**公开示例**，不是本地生产配置。不要将真实配置移动进去。

## 四、真实验收证据（仅脱敏摘要）

- Node.js `v22.23.2`，npm `10.9.8`，`xiaozhi-client@2.3.0`。
- 初次正常安装因 `@discordjs/opus` GitHub 预构建下载超时、Windows C++ 构建工具缺失而失败。改用 `npm install -g xiaozhi-client@2.3.0 --ignore-scripts` 安装成功；实际验证该用法足以运行本地 MCP 桥接，**不代表客户端自身音频功能完整**。
- Windows 防火墙创建了入站 TCP 9999 阻止规则 `MuSSE MCP - Block Inbound 9999`（Profile Any），用户报告 `127.0.0.1:9999` 本机访问仍正常。实际服务监听 `0.0.0.0:9999`，因此该规则应保留；未经检查不要把端口开放到局域网/公网。
- 独立测试中，假 iWiki Token 曾被 `console.log("转换配置", { config })` 打印到日志。已在本机已安装 npm 包的 `dist/backend/WebServer.js` 与 `dist/backend/WebServerLauncher.js` 各修复 1 处，原文件留有 `.musse-original.bak` 备份。二次假令牌日志复测：小智完整 Token `False`、iWiki 完整 Token `False`。**这只能证明测试路径没有完整令牌泄露，不能替代全链路安全审计**；部分小智 URL 在日志中仍有脱敏片段。
- 用户日志显示小智 MCP WebSocket 连接成功 `1/1`，协议初始化后最初工具数 `0`（尚未添加 iWiki）。
- 随后用户截图显示 iWiki 服务 `1/1`，已加载约 27 个工具；本地 `list_spaces` 实际调用 `ok: true`，返回 41 个可访问空间的列表。用户随后报告 MuSSE 设备语音查询成功（对话用户确认），没有保留可公开核对的每次设备调用完整原始日志。
- 以上不代表 `software/musse-iwiki` 的 29 项离线测试已经升级为远程读写、冲突处理或任务业务的真实验收。

## 五、安全与维护

1. **绝不推送**：`xiaozhi.config.json`、含令牌的备份、`mcp-canary*.log`、`xiaozhi.log`、`tool-calls.jsonl`、任何账号截图、完整接入点 URL、iWiki 私人资料。Public GitHub 只收脱敏文档。Windows 本地日志与配置也不应随意分享。
2. 重新安装、升级或修复 `xiaozhi-client` **可能覆盖此前两处本机日志补丁**。升级前先备份本地私密配置；升级后不要直接携带真实 Token 启动，应重新用假令牌验证日志行为，再恢复生产配置。补丁脚本只针对当时安装产物，不保证兼容其他版本。
3. 专用只读 Token 应限制权限、妥善保存并能随时撤销；不要与论坛 SSE MARKET 个人令牌混用。调用服务端会读取用户有权访问的空间，可能包含私人知识资料。
4. 仅完成“被动语音查询”使用路径。未实现后台通知/定时主动查询、独立数据库/网页，也没有 24/7 SLA。后续若明确要电脑关机仍可查询，再评估腾讯云轻量服务器迁移，另行处理成本和凭证保护；本次不启动迁移。
5. 仍应保留当前仓库硬件边界：新板 FT232R/COM7 与旧板 CH343/COM6 不可混淆；无理由不重刷固件，不对尚未电气核验的 LED 矩阵与外置电源做实物操作。

## 六、出现问题的最短排查

- `xiaozhi` 命令不存在：先检查 `node --version`、`xiaozhi --help`，不要立即卸载重装（会覆盖安全补丁）。
- 本机页面无法打开：确认启动窗口仍在运行，查看 `Test-NetConnection 127.0.0.1 -Port 9999 -InformationLevel Quiet`；确认 9999 未被别的进程占用。
- “小智接入点 0 / 未连接”：检查互联网、小智控制台接入点状态、Token 是否失效；**不要输出完整 URL**。
- “iWiki 服务 0/1”或工具为 0：先在终端看脱敏后的 HTTP/连接错误，再核查远程 API 可达性、只读 Token 是否有效、JSON 配置是否仍指向正确接口；勿上传含鉴权头的配置与日志。
- 本地工具能查询、MuSSE 不能：确认小智接入点显示已连接，保持本机桥接运行，查看工具使用计数是否变化；不要用模型口头给出的答案单独证明实际调用了工具。

## 七、新对话的项目入口

先读 `AGENTS.md`、`docs/STATUS.md`、`docs/HANDOFF.md`、`docs/TEST_LOG.md` 和本手册。当前已完成 Windows 本地语音查询闭环；后续任务需由用户在新对话明确指定。不要重复安排旧下载模式排障、设备配网、首次小智 MCP 连接、真实 `list_spaces` 验证；不要擅自部署云端、更新固件或修改 iWiki 内容。
