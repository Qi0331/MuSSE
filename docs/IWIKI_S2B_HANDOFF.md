# MuSSE iWiki 新对话专用交接（2026-11-03，S2-A → S2-B）

> **本页记录可复核的当前状态。** 主仓库 `Qi0331/MuSSE`；`main` 基线 `a9ae041531c138483a1c9c2fbf3b6c2992ec0baf`。当前开发位于 `feat/iwiki-s2a-readonly-contract`，草稿 [PR #24](https://github.com/Qi0331/MuSSE/pull/24)，**未合并主线**。不要将本页的新开发草案视作生产部署。

## 1. 产品方案与已运行架构

- **唯一持久化来源**：官方 iWiki“我的知识库”；仅在用户主动提问时被动查询。无网页、CloudBase、独立云数据库、主动提醒或云端部署。决策以 `docs/DECISIONS.md` 的 D-013 / D-014 为准。
- **当前已运行设备链路**：ESP32-S3（小智上游 v2.5.2 / bread-compact-wifi）→ 小智官方云端 MuSSE 智能体 → Windows `xiaozhi-client@2.3.0` → 官方 `https://ssemarket.cn/iwiki-api/mcp`；Windows 手动启动、电脑离线/关机即失去 iWiki 工具。
- **注意区别**：当前运行的是官方 iWiki 远程 MCP，**不是**仓库 `software/musse-iwiki/src/mcp/server.ts` 的自研业务 MCP。自研业务代码已有 29 项历史离线测试，但 **13 个业务工具尚未部署到小智**。
- 生产 Windows 客户端已有本地修补的两处配置日志敏感信息泄露点。不要重新安装/升级、覆盖私有配置或把 Token 上传 GitHub；客户端防火墙 TCP 9999 拦截入站规则应保留。运行手册：`docs/IWIKI_LOCAL_MCP_RUNBOOK.md`。

## 2. S2-A 真实验收（用户在 Windows 已完成）

- Windows Node.js `v22.23.2`；用户从功能分支单独克隆到 `$HOME\MuSSE-S2A-Check`。
- MCP `initialize` + `tools/list` 真实成功：发现 27 个工具，六个查询工具均存在：`list_spaces`、`list_docs`、`list_doc_tree`、`search_kb`、`read_doc`、`get_doc_outline`。具体输入字段和 required 请读 `software/musse-iwiki/docs/S2A_READONLY_HANDOFF.md`。
- 用户在自己创建的专用虚构测试文档上调用一次 `read_doc`。返回 `content[0].text` JSON，结构 `{ok:boolean,data:{doc_id:string,title:string,content:string,...}}`，无独立 `structuredContent`。
- 用户随后执行 `node --test tests/official-iwiki-read.test.mjs tests/probe-task-queries.test.mjs`：**7/7 通过**。通过 `node tools/probe-task-queries.mjs --live` 真实读取虚构任务表，结果：`validatedTaskTable=true`、总任务 **3**、未完成 **2**、完成 **1**、当天到期 **0**、未来七天 **1**、逾期 **1**；本地计数 `remoteReadCalls=1`、`remoteWriteCalls=0`。这是用户直接回传的程序结果，不是独立的服务端调用审计。
- 用户最后报告，**MuSSE 设备语音询问该虚构任务表也成功**。未提供该次语音的逐字回答与 MCP 工具调用次数，不可伪称已独立验证工具轨迹。
- 本分支 `src/store/official-iwiki-read.ts` 是严格只读适配器：需显式的逻辑文档路径→ `page-...` ID 映射；确认 `ok === true`、返回的 ID 与输入匹配，并拒绝任何 `write()/list()`。它尚未作为自研 MCP 服务部署。

## 3. S2-B 当前开发草稿（**尚未用户实测**）

为继续验证**长期目标进度和快捷笔记**，PR #24 分支已新增：

- `software/musse-iwiki/docs/S2B_GOAL_NOTES_ACCEPTANCE.md`：三篇虚构 Markdown 文档模板与完整操作、语音验收步骤。已修正文档代码块排版。
- `software/musse-iwiki/tools/probe-goal-notes.mjs`：默认无网络，显式 `--live` + 三个不同的文档 ID + 大写 `YES` 才请求读文档，最多 3 次 `read_doc`；仅返回目标完成率、阶段数、笔记数量等汇总，不输出私人正文、实际文档 ID 或 Token。
- `software/musse-iwiki/tests/probe-goal-notes.test.mjs`：新增合成测试，覆盖进度计算、脱敏、坏 ID/错误响应；**新测试还未有本轮执行回执，不可宣称已通过**。
- 预设验收：目标 G-001 关联 **2** 项、完成 **1** 项、进度 **50%**；笔记 **2** 条；远端读取本地计数 **3** 次，远端写入 **0** 次。
- **未完成**：用户尚未根据模板创建/修改相应三篇测试文档，也尚未执行本轮 Windows 本地测试或设备目标/笔记语音验收。

## 4. 新对话的紧接任务

1. **先阅读** `AGENTS.md`、`docs/STATUS.md`、`docs/HANDOFF.md`、`docs/TEST_LOG.md`、本页与 `software/musse-iwiki/docs/S2B_GOAL_NOTES_ACCEPTANCE.md`。以当前功能分支的最新内容为准，不能只读 `main` 误判工作没做。
2. 检查本分支新增 S2-B 脚本、测试和样例的正确性；尽可能完成**离线**测试、记录真实结果。若有 bug，在本草稿分支修复，**不要擅自合并 PR**。
3. 在审查无误后，指导用户在自己的 iWiki 网页中**手动**更新原虚构任务测试文档（补 `G-001/P1` 两行关联），新建虚构目标文档、虚构快捷笔记文档。**不要使用 MCP 写入去代替网页手动操作**。
4. 用户的 Windows 目录原在 `$HOME\MuSSE-S2A-Check\software\musse-iwiki`。按验收手册，先 `git pull`，运行 `node --test tests/probe-goal-notes.test.mjs`；仅在样例文档保存后，用户才主动运行 `node tools/probe-goal-notes.mjs --live`。只收 `SAFE_GOAL_NOTES_SUMMARY_BEGIN/END` 之间的脱敏报告。
5. 如 Windows 只读统计通过，再引导用户通过 MuSSE 语音分别问目标完成率与最新测试笔记，尽量同时观察官方 MCP 查询工具使用计数，而不以模型正确回答单独证明工具调用。
6. 后续再评价是否有必要接入自研 13 个业务工具的**只读子集**；优先复用当前可用官方 MCP。绝不把尚未授权的远程写入、归档、删除等测试当作下一步默认任务。

## 5. 安全与交接边界

- 禁止上传/打印真实 `xiaozhi.config.json`、小智接入点 URL、iWiki Token、私人空间/文档内容、原始服务日志；PR 的公共仓库仅保存虚构数据、脱敏统计和代码。
- 不动已经运行成功的 Windows 桥接、固件、硬件电气连接；不采购/部署云服务，不改个人其它 Agent/私人档案。
- 不主动开放 iWiki 远程写入，不假设服务端 Token 一定拒写（尚未独立核验）；不要为测试调用写工具。
- 不以“草稿 PR 已提交”替代用户 Windows 实机验收；区分离线模拟、真实 iWiki 读取与 MuSSE 设备语音三种证据等级。
- 不需要重复已成功的首次小智连接、读表和逾期统计测试。应从 S2-B 目标/笔记开始。
