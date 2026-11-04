# MuSSE / 小七 — S6 会话交接（2026-11-05）

> 目的：用户已明确要求停止当前对话里不断追加测试脚本的循环；新开一个 S6 网络阻塞专项对话。**本文件是交接记录，不是新的运行指令。** 新对话应先阅读本文件与既有 `docs/IWIKI_S6_IMPLEMENTATION.md`，**不得重复已经完成的 S5/S6 验收、不得擅自向 iWiki 写入**。

## 0. 最新结论（请先读）

- Windows S6 工作区最近成功快进到提交 `dcf6fa892a622605412204d72e3544c216bc4205`（`dcf6fa8`）。
- 用户最新执行了 `npm test *> $null`，后续 `npm run recover:s6-progress -- --once` 被运行，表明本地测试门槛通过；较早的可见完整测试记录明确为 **207/207 通过**（在 `d8d6fe0` 上），不是所有真实网络/远程写入均通过。
- **本次失败精准定位到 iWiki MCP `initialize`**，早于 `list_docs`、`read_doc`、用户授权与 `edit_doc`：
  ```json
  {
    "inspection": "S6_TARGETED_PROGRESS_RECOVERY",
    "status": "STOPPED_NO_RETRY",
    "failureStage": "iwiki_initialize",
    "failureCode": "S6_TOOL_ACCESS_FAILED",
    "preflightChecks": null,
    "writeAttempts": 0,
    "editResponse": null,
    "remoteErrorCode": null,
    "backupSaved": false,
    "lastListError": null,
    "toolAccessStage": "initialize",
    "toolAccessError": {
      "category": "NETWORK_OR_RESPONSE",
      "httpStatus": null,
      "rpcCode": null,
      "networkCause": "ECONNRESET"
    },
    "writeRetryPermitted": false
  }
  ```
- `ECONNRESET` 是客户端感知的连接被重置；**尚不能判定具体责任是本地网络/代理/TLS、中间设备还是服务器**，更不能假定 HTTP 401/403、目标正文损坏或进度算法错误。该调用甚至没有产生 HTTP 状态码。
- **本次 0 次写入**。不要重新运行旧的 `accept:s6` 全流程。

## 1. 项目/仓库/子对话结构

- GitHub 仓库：[`Qi0331/MuSSE`](https://github.com/Qi0331/MuSSE)。
- 当前专用分支：`feat/iwiki-s6-document-discovery`；Draft PR [#26](https://github.com/Qi0331/MuSSE/pull/26)，目标基线 `feat/iwiki-s5-guarded-write-design`；最新交接前的功能提交 `dcf6fa8`。
- Windows 工作区：`C:\Users\HONOR\MuSSE-Lab\MuSSE-S6\software\musse-iwiki`（**S6 独立工作树**）。
- 已有 S4/S5 路线独立存在，S5 写服务、配置、映射和已验证业务 **本轮没有修改**；当前远端服务实时可用性不能由此推出。
- 本次应**新开** MuSSE 项目内一个子对话，建议名称：`S6-B｜iWiki MCP 初始化 ECONNRESET 排障与收尾`。旧对话保持为历史现场证据；**不要**新开 S6 代码分支/新工作树。
- 代码根目录（GitHub）：`software/musse-iwiki/`。核心文件：`src/store/iwiki-mcp-client.ts`（MCP initialize/HTTP/JSON-RPC），`src/goals/s6-official-port.ts`（`list_docs/read_doc/edit_doc`），`src/goals/s6-goal-discovery.ts`（扫描/严格范围），`src/goals/s6-goal-flow.ts`（预览/确认/写前检查/读回），`tools/s6-recover-progress-once.mjs`（仅 G-998 定向恢复），`tools/s6-audit-post-uncertain.mjs`（只读核对）；`docs/IWIKI_S6_IMPLEMENTATION.md` 为逐阶段历史文档。

## 2. 已完成且无需重测的真实验收

1. 用户在 iWiki 独立知识库 `长期目标` 手动创建 `G-999`，S6 通过动态发现 `list_docs` 找到其确切归属和 ID，`read_doc` 读取解析成功；《任务总表》确认 12 列、4 条任务。
2. 一次性测试 `npm run accept:s6 -- --once` 的三项**无写入**预览/取消均通过：`goal_update`、`goal_create`、`goal_record_progress`。
3. 用户逐项明确确认：对隔离目标 `G-999` 说明追加验收标记，**真实写入+读回成功**；自动在 Windows 私有目录保存该页原文备份。
4. 用户逐项明确确认：在专用知识库创建隔离目标 `G-998`，**真实创建+读回成功**。
5. 用户逐项明确确认：第一次对 `G-998` 追加一条进度历史时发出一次 `edit_doc`，返回 `S6_WRITE_UNCERTAIN`，**结果未获成功确认**；后续独立只读检查确认 `G-998` 文档仍存在但对应历史记录**未观察到**（`matchingProgressRecords=0`, `thirdWriteStatus=NOT_OBSERVED_DO_NOT_RETRY`）。
6. 随后开发了定向一次恢复工具，但多次运行都**停在写前**：先 `goal_scan`/`S6_TOOLS_UNAVAILABLE`，最终精确定位至本次 `iwiki_initialize`/`ECONNRESET`。后续这些运行的写入次数均为 **0**。
7. 207/207 离线自动化测试曾在真实 Windows 通过；它们验证逻辑、安全阀和模拟业务流程，**不能替代真实远端网络可用性或未完成的第三项真实写入**。

## 3. 当前明确未完成的事项

- **S6 真实进度记录写入**：截至最后一次远端可读检查，`G-998` 中验收备注 `小七 S6 受控进度写入验收（隔离测试）` 未出现。之后的初始化失败并不提供关于该备注的新状态。
- **iWiki MCP 连接初始化稳定性**：最近日志 `NETWORK_OR_RESPONSE / ECONNRESET`；需要通过单次最小只读诊断隔离网络层与服务器层。
- **S6 真正的小智语音 MCP 部署与端到端验收**：未完成；本地命令行测试不可冒充语音端已上线。
- **生产约束**：S6 写入本身是写前再次检查 + 写后读回的 best-effort 防护，不具备真正原子比较并交换（CAS）；不能称绝对无竞态。知识库分页大规模场景未实测。

## 4. Windows 本地敏感配置与保护边界

私人目录：`$HOME\MuSSE-MCP-Local\musse-bridge\`，包含 `xiaozhi.config.json`（iWiki 连接/令牌）、`musse-iwiki-readonly.json`（《任务总表》的文档映射）、`musse-iwiki-s6-scope.json`（已固定的 `mode:"space"` 长期目标知识库）。**这些文件只在用户 Windows 存在，未加入 GitHub；不可要求用户上传/粘贴原文，勿打印 endpoint 令牌、私有 ID、完整文档或远端异常消息。**
- 不要覆盖这三个文件；不要变更现有 S4/S5 桥接配置、语音服务、云端或设备。
- 不删除 `G-999`/`G-998` 和原文备份；不对 `G-998` 进行未经用户新一轮明确授权的任何写入。
- 不运行 `npm run accept:s6 -- --once`（已创建 G-998，必定与首次验收前提冲突）。不重复 S5 业务测试或迁移配置。
- 无论新对话中的连接恢复采用何方案，**只读诊断可先进行；真实写入需展示具体变更、备份、得到用户当次确认、至多一次发送、读回并在不确定时停止**。

## 5. 为什么反复试很久仍没收尾（排障思路纠偏）

此前测试脚本增量太频繁，现场用户被要求反复 `fetch/merge/npm`。早期 `S6_WRITE_UNCERTAIN` 与近期 `ECONNRESET` 不应混为一种错误。真正当前阻塞是 **HTTP/MCP 连接尚未完成初始化**；继续修改进度计算、扩增验收脚本或重新写 G-998 均不能解决 TCP/TLS/连接重置。当前代码已有 `iwiki_initialize` 的脱敏错误分类，**现在应停改业务代码，优先检验外部网络可达性与连接中断位置**。

新对话第一步应在不修改任何数据的前提下给出**合并的最小排障方案**：检查 iWiki 官方 MCP 主机的 DNS/TCP 443/TLS 连通、Windows 代理/网络环境、Node fetch 与同一官方端点的初始化差异，并区分本机网络与服务端中断。最好一次命令输出脱敏阶段/布尔值/标准网络错误码，避免打印请求头、URI 中的账号或敏感内容。不要直接推荐禁用 TLS 证书验证，不改官方地址，不暴露 Bearer Token。也不应无依据断言是服务端故障。

仅在连接稳定、再次只读核验 G-998 进度备注仍缺失、用户明确授权的前提下，才考虑 **一次**定向写入/读回。若连接始终不通，终止远端验收并给出阻塞结论，避免无限循环。后续语音部署另起阶段。

## 6. 重要路径与命令（供新对话了解，不是要求立即执行）

- S6 工作目录：`C:\Users\HONOR\MuSSE-Lab\MuSSE-S6\software\musse-iwiki`。
- Git 更新：`git -c http.version=HTTP/1.1 fetch --no-tags origin feat/iwiki-s6-document-discovery` 后**仅在成功时** `git merge --ff-only FETCH_HEAD`；不要把失败后的 `FETCH_HEAD` 当作已更新。
- 离线套件：`npm test`。
- 仅只读复核：`npm run audit:s6-uncertain -- --read-only`。
- 定向恢复：`npm run recover:s6-progress -- --once`，**可能发起远端单次写入，未经新确认不得执行**。
- `npm run accept:s6 -- --once` **禁止重新执行**。
- 新对话需要继续检查：`src/store/iwiki-mcp-client.ts` 中 `IwikiMcpClient.initialize()` 在实际 `fetch` 网络请求处是否收到 `ECONNRESET`，并用严格脱敏诊断确定重置发生的层次；不得误把本地模拟测试等同远端通过。

## 7. 新对话最小完成标准

1. 明确判断当前初始化失败是网络阻塞、服务端错误、代理/TLS 问题还是其他可证实类别；若证据不足，如实标记。
2. 不因排障触发任何 iWiki 写入；保留既有 S5、G-999、G-998 和备份。
3. 连接若恢复，进行**一次**实时只读 G-998 核对后再与用户决定是否补写；有明确授权才可写。
4. 给出完成/阻塞的明确结论，不再以拆分多轮小脚本替代定位根因。语音侧上线单列未完成。

> 交接时间：2026-11-05；本文件应作为新对话的权威现场交接，历史详细记录见 `docs/IWIKI_S6_IMPLEMENTATION.md`。