# MuSSE 当前项目状态（唯一权威）
## 2026-11-04 S5-F 私人空间选择改进
- 用户截图里有多个团队/公共空间，“我的文档”不一定是创建接口接受的空间名称。已改为自动探针首先只读调用 `list_spaces`，本机列出编号，由用户自行选择拥有写入权限的私人测试空间；输入 `0` 取消。列表不可解析则停止，不创建。详见 `docs/IWIKI_S5F_DISCOVERY.md`。

## 2026-11-04 S5-F Windows 跨平台测试失败修复（最新）
- 用户 Windows 独立 S5 worktree 更新到 `e660f2b` 后，115 项本地测试 113 通过、2 失败，测试门槛已拦截真实 iWiki 写入。失败原因分别是 Node CLI 测试把 `file URL.pathname` 作为 Windows 命令行路径，以及任务表编辑函数把 Windows CRLF 换行归一化，意外改动了非目标行。
- 已在 S5 分支修复：前者使用 `fileURLToPath`，后者使 `updateTaskRow` 保留原有换行分隔符；新增混合换行/CRLF 回归测试。此次属于 Windows 兼容性与任务正文数据保真修复，并未执行生产更新。
- 等完整 CI / Windows 复测确认通过后，才允许对用户指定私人空间的合成测试页面执行一次真实创建与编辑。详情 `docs/TEST_LOG.md` T-20261104-18。


## 2026-11-04 S5-F 确认创建必须指定空间（最新）
- 用户在 Windows 实际只读检查官方 `create_markdown_doc` 元数据，证明目标空间必须 `space_id` 或 `space_name` 二选一；此条件未体现在其 `required` 数组里。此前仅传 title/content 造成 `ok:false` 的原因与此一致，无需假设是 Token 权限问题。
- 开发分支已修改自动创建+编辑探针：交互式在 Windows 本机输入准确 `space_name`，仅对该空间尝试新建一篇合成隔离文档，继续最多一次 `edit_doc` 与读回检查；不改桥接、生产 Token、现有任务或已部署两个 MCP。见 `docs/IWIKI_S5F_DISCOVERY.md`。**修正后尚未真实写入验证**。

## 2026-11-04 S5-F 真实创建联调已触达业务层（最新）
- 用户已用 HTTP/1.1 成功将 Windows S5 worktree 快进到 `7aa98f0`。真实运行一次自动测试时，`create_markdown_doc` 有 MCP 响应，但服务器业务 JSON `ok:false`，携带 `data.error/reason/expected`；没有确认文档 ID，因此程序停止，`edit_doc` **没有调用**。
- **不能把此次视为真实写入成功，也不能武断归因于 Token 或空间**。在未明晰业务规则和页面是否已创建之前，不重复创建。新增仅读取工具元数据的 `npm run inspect:s5-create -- --live`，用于检查创建的空间参数说明。见 `docs/TEST_LOG.md` 最新 T-20261104-16。
- 现有 S4 双 MCP、生产配置和私人映射保持不变，S5 生产未启用。


- **自动创建探针本轮 CI 实际通过**：GitHub Node.js 全量测试 `112/112 pass`（run `41799562069`），文档检查通过（run `41799562141`）。新增 8 项模拟测试，不是远端写入证据。
- **S5-F 简化调整**：用户指出可由官方 `create_markdown_doc` 直接创建隔离页，故增加 `npm run probe:s5-auto -- --create-and-write-test` 自动创建→核验→编辑一次→读回流程，免去网页手工创建和输入 page ID。该探针尚未远端执行；创建响应 ID/默认空间是否可用仍需实测。详见 `docs/IWIKI_S5F_DISCOVERY.md`。


## 2026-11-04 S5-F 最新进展：官方写工具真实发现，尚无写入
- **当前最新 CI**：S5-F 新增隔离探针 6 项离线测试后，完整 Node 22 GitHub Actions `npm test` **104/104 pass、0 fail**（run `41798382817`），文档检查也成功（run `41798382801`）；仍不代表真实远端写入。
- 用户 Windows 创建了独立 S5 worktree，HEAD `508e908`，未切换原 S4 工作目录；`npm run inspect:s5-write -- --live` 实际成功，官方 SSE_MARKET iWiki `tools/list` 共 27 个工具，筛出 6 个候选。
- 主要候选：`edit_doc`（字段 `doc_id/content/title`，仅 `content` 必填）；`append_to_doc`（`doc_id/content`，仅 `content` 必填）。真实更新语义、响应格式、写权限**均未验证**。未调用任何 `tools/call`。
- S5-F 已新增严格匹配测试标记的一次性隔离 `edit_doc` 探针和离线测试；不调用真实工具，必须经用户**另行明确授权**并自行在 iWiki 网页建立专门测试页后才可运行。见 `docs/IWIKI_S5F_DISCOVERY.md`。
- S4 双 MCP、既有用户工作区、私有配置、MuSSE 角色、Windows 补丁/防火墙和 ESP32 不动。Draft PR #24/#25 不合并。自动化测试以最新 CI 为准。

## 2026-11-04 S5-E 最新进展（覆盖旧 S5-D 严格 CAS 门槛）
- 用户已调整为**实用优先、避免过度防御**。对 iWiki 网页与机器人并发修改采取提交前重新读取并比较文本、写后复查的**非原子低频方案**，并明确接受检查至提交之间的残余竞争窗口；不另建事务数据库、独立授权 UI 或硬件确认。
- PR #25 开发分支新增 `src/write/official-iwiki-best-effort.ts`、`src/write/voice-flow.ts`、`src/mcp/s5-voice-protocol.ts`、`src/mcp/server-s5.ts` 与对应单测；`guarded-write.ts` 增加显式 `concurrencyMode:"check-before-write"`；原 strict/atomic 兼容保留。新增可选脚本 `npm run mcp:s5`。
- **完整 GitHub CI Node.js v22.23.4，`npm test` 98/98 成功，0 失败**，同时文档 CI 成功。测试使用模拟官方 iWiki 工具，不代表真实写入。详见 `docs/IWIKI_S5E_PRACTICAL_HANDOFF.md`。
- **未完成**：SSE_MARKET iWiki 官方写入工具名、字段及成功响应尚未真实发现。Windows 真实部署与写入仍未授权；独立新服务器默认关闭、未挂桥接，不更改现有两个 MCP、Muse 角色、Windows/ESP32 与真实数据。
- 下一步最短路径：获取一次**不涉及实际写入**的本地工具列表脱敏摘要，核对官方更新工具，再决定是否授权隔离页面的一次写入及最终桥接。


## 2026-11-04 S5-D 最新进展（覆盖下方 S5-C/B 快照）
- **已首次完成真正完整 GitHub 工程检出上的 Node 全量回归：Node 22.23.4，`npm test` 84/84 通过，0 失败**。独立 CI：`.github/workflows/iwiki-node-tests.yml`，run ID `41784910123`；只具 `contents: read` 权限。旧日期依赖测试首轮 80/81 的失败已修复，并经完整 CI 重跑通过。
- 修复 S5 受控写门禁：`COMMITTING` 不被 TTL 清理；`UNCERTAIN` 不被误降为 `EXPIRED`，并阻止同一文档重复准备；任务 Markdown 单行字段拒绝换行。S5 专项共 **29 项**，已经包含在 84 项全部通过的测试里。
- **注意仍未生产可用**：官方 iWiki 原子 CAS 契约、独立可信用户确认和进程重启后不确定结果的持久恢复都未解决；不连接真实写服务、不改私有配置、Windows/ESP32/云端和现有双 MCP。PR #24/#25 均 Draft、未合并。
- **新的正式交接入口**：`docs/IWIKI_S5D_FINAL_HANDOFF.md`。用户已取消 S4-E 额外验收和 S2-B 三文档验收，后续不重复安排。


## 2026-11-04 S5-C 最新覆盖：受控写入安全门禁增强，专项离线 26/26
- S5 继续推进，无需 S4-E 目标/笔记额外验收；详见 `docs/IWIKI_S5C_HANDOFF.md`。新增只读的 `tools/s5-inspect-write-contract.mjs`（默认无网络，显式 `--live` 仅 `tools/list`，从不 `tools/call`），补充对应离线测试。
- S5 准备/确认流程已修正：任务修改确认预览必须展示字段**前后值**；创建任务/笔记展示完整待确认内容；超长预览拒绝；确认摘要绑定预览；并发准备阶段预留容量；短期已验证结果跨后续准备保留去重；笔记标题不符合格式则拒绝添加。
- **开发侧实际测试**：隔离 Node v22.16，三个 S5 专项测试文件 **26/26**，新增/更新的六文件语法检查 **6/6**；由于依赖按已见仓库源码临时暂存，**不是完整 Git 工作区的 `npm test`**。GitHub 六文件 blob SHA 与本地已测文件哈希 **6/6 对应**。PR #25 最新提交的文档骨架 GitHub Actions 检查成功，**不包含完整 Node 回归**。
- **生产上线硬阻塞仍在**：官方 iWiki 远端原子条件写入契约未确认，可信独立用户批准通道未接入。只读双 MCP、旧 PR #24、Windows 补丁/防火墙、Muse 人设、固件、云端、私有 Token 和真实文档均未改变；PR #25 仍 Draft，不能据离线测试声称可语音写入。


## 2026-11-04 最新进展：S5-B 离线受控写入门禁已入新分支（覆盖下方 S4 快照）
- 用户明确跳过 S4-E 目标/笔记额外验收，直接推进 S5；**仅授权仓库开发和离线安全测试，不等于允许真实 iWiki 写入或部署**。
- 新分支 `feat/iwiki-s5-guarded-write-design` 从 S4-D `25a9f64` 创建；新增 `docs/IWIKI_S5_SECURITY_DESIGN.md`、`src/write/guarded-write.ts`、`src/write/plan-write.ts` 与两份 S5 离线测试文件（均位于 `software/musse-iwiki/`）。
- **真实执行**：隔离 Linux Node.js `v22.16.0` 使用 `--experimental-strip-types` 跑 `tests/s5-guarded-write.test.ts`，13/13 通过；新增核心/业务规划文件及两份测试通过 Node strip-types 语法检查。`tests/s5-plan-write.test.ts` **尚未在完整仓库执行**；未执行完整 `npm test`，不可将核心 13 项写成所有 S5 集成测试通过。
- S5 核心支持严格操作白名单、只读预览、短期内存事务、独立可信批准接口、过期/拒绝/冲突/不确定状态、原子条件写入前置门槛、写后读回、同一事务防重复；业务规划器覆盖任务创建/更新/完成/归档/恢复和笔记追加。**尚未连接任何真实可信批准界面或已验证 iWiki 写适配器，无法生产写入**。
- 保持官方 `iwiki`、本地 `musse_iwiki_readonly`、Windows 补丁/防火墙、Muse 角色与 ESP32 固件不变；原 PR #24 保持 Draft 未合并。下一步需要核实官方远端原子条件写契约和可信用户确认机制后才能考虑生产写入。


## 2026-11-04 最新最高优先级：S4-D 任务/日程自然语言语音链路按用户现场报告通过

- **用户现场回报**：原官方 `iwiki` MCP 正常，新增 `musse_iwiki_readonly` MCP 正常且六工具可见；用户确认新业务 MCP 被实际调用，四项自然语言场景（任务数量、今日安排、近期与逾期、普通聊天）均“正常”。不需要用户每次口述 MCP 或工具名。
- **证据边界**：这是用户报告的现场验收，没有可供本代理独立复核的逐次原始工具轨迹。因此仅将 **S4-D 任务/日程语音集成标记为用户验收通过**；不宣称长期稳定性或目标/笔记也通过。
- **此前实测**：Windows Node `v22.23.2` 上三份指定离线测试 **10/10**；官方 `read_doc` 真实读取虚构任务表 **总 3、待办 2、完成 1、归档 0**；新增 stdio MCP `--smoke` 输出 `tools=6`、`write_blocked=true`、任务统计一致。`--install` 已备份原私有配置，保留官方 iWiki 并增添本地只读业务服务。
- **仍未验收**：当前 Windows 私有映射只有 `taskDocId`；`goal_query` 和 `note_query` 虽可见，真实目标/笔记 ID 未映射且未作端到端读取。S2-B 三文档繁琐验收已取消，不能默认恢复。S5 受控语音写入仍未授权。
- iWiki 仍为唯一持久化数据源。生产链路：ESP32-S3 → 小智云端 MuSSE → Windows `xiaozhi-client@2.3.0` → 官方 iWiki 远程 MCP / 本地业务只读 MCP。现有 S3-A Muse 角色提示词、固件、本机补丁、防火墙保持不变。PR [#24](https://github.com/Qi0331/MuSSE/pull/24) **继续 Draft、未合并 main**。
- **新对话交接以 [IWIKI_S4D_FINAL_HANDOFF.md](IWIKI_S4D_FINAL_HANDOFF.md) 为准**，优先于下方历史记录；勿重做已完成的 S2-A/S4-B/C/D 测试。


## 2026-11-04 S4-D 首次真实 iWiki 任务只读成功；Windows 桥接接入脚本已准备

- 用户在 Windows `Node.js v22.23.2`、`b0b0436` 工作区用 `buildReadonlyTaskService(process.env)` 构建官方 iWiki 只读 `read_doc` 客户端，终端回传 `CONFIG_OK`、`READ_ONLY_OK`、`total=3`、`todo=2`、`done=1`、`archived=0`。**这是用户实际执行的官方只读文档读取 + 业务解析**，不是模拟；尚未通过新 MCP stdio 或小智设备语音链路。
- 分支新增 `software/musse-iwiki/tools/s4d-bridge.mjs`，提供 `--smoke`（六工具列表、真实任务查询与白名单拒绝写入，仅输出计数）、`--install`（先烟雾测试、再备份现有 Windows 私有桥接配置，添加不含 Token/页面 ID 的第二本地服务）、`--status`、`--rollback`（只移除新增服务项）。原官方 iWiki 服务始终保留。
- 脚本在隔离 Linux Node 22.16 临时放宽本机版本门槛下，使用合成配置、模拟 MCP 子进程验证烟雾测试/安装/状态/回滚，模拟输出成功。实际正式脚本保留 Node>=22.18 门槛；用户 Windows 真实桥接**尚未安装或验收**。
- 用户可按同一批操作拉取分支、停旧桥接、安装第二服务、重启 `xiaozhi start`、核对服务列表并做一次设备语音验证。不得分享私有日志、Token、文档 ID；S5 写入不开放，PR #24 继续草稿。

## 2026-11-04 S4-D Windows 正式工作区离线检查 10/10 通过（用户实测）

- 用户在 Windows PowerShell 的 `C:\Users\HONOR\MuSSE-Lab\MuSSE\software\musse-iwiki` 中克隆分支，反馈 Node.js `v22.23.2`、Git `2.54.0.windows.1`、提交 `b0b0436`。
- 用户执行 `node --test tests/s4b-readonly.test.ts tests/s4c-readonly.test.ts tests/s4d-preflight.test.ts`，回传汇总 **tests 10 / pass 10 / fail 0 / skipped 0**。这是 Windows 上完整代码目录中的离线测试，**不是**真实 iWiki 数据读取或 MCP 桥接/设备语音实测。
- 下一步先建立本机私有文档 ID 映射并检查原桥接配置的可用性；任何实际新增桥接服务项应先备份、审查配置，保留原官方 iWiki MCP 与日志脱敏补丁。不要上传私人配置、Token、文档 ID，也不要恢复已取消的 S2-B 人工验收。
- GitHub PR #24 仍保持 Draft；S5 受控写入未授权，不得启用。

## 2026-11-04 S4-D 接入前代码修正已提交；等待用户 Windows 离线检查

- 用户要求继续推进 S4-D 并询问需要做什么。**目前仅完成仓库内接入前修正**，未读取真实 iWiki、未修改 Windows 桥接/私有配置、未改小智云端/ESP32，PR #24 仍是草稿。
- 已修正只读 MCP 查询数组的 `structuredContent` 形状：按 MCP 对象形式包装；避免任务/笔记列表直接返回数组造成 SDK 解析不兼容。
- 新增从 `$HOME\MuSSE-MCP-Local\musse-bridge\musse-iwiki-readonly.json` 读取本机私有页面映射的支持，官方 iWiki Token 仍从既有私有 `xiaozhi.config.json` 读取。新增 MCP 服务配置里未来只需填写非敏感代码路径，避免旧版上游转换配置时打印环境变量与真实页面 ID。兼容 S4-B/C 原环境变量映射方式，但正式部署建议仅使用私有文件。
- 已新增 `tests/s4d-preflight.test.ts` 作为最小离线检查，覆盖假页面映射与 MCP 数组结果形状；**本轮未在完整仓库执行该新增测试**。请用户在 Windows Node>=22.18 运行精确命令，回传不含私人内容的测试摘要；待通过后再单独审查 Windows 配置与真实只读接入。
- 数据仍唯一保存在 iWiki；S5 写入不在本轮范围，已取消的 S2-B 人工验收不恢复。

## 2026-11-04 S4-C 仓库内目标与笔记只读开发已提交（尚未实际部署）

- 用户授权 S4-C 并再次明确 **iWiki 为唯一持久化数据源**：不引入本地数据库。复用 S4-B 的同一个 `mcp:readonly` 入口，新增 `goal_query`、`note_query`，合计 **6 个只读工具**；写入工具仍在服务端白名单层被拒绝。
- 目标读取复用 `TaskService.queryGoal`，以 iWiki 任务总表中的关联任务状态计算进度；笔记读取复用 `TaskService.queryNotes`。已将最近笔记由文档位置倒序改为基于标题时间和同分钟序号排序。
- 新增 `src/mcp/document-ids.ts`：任务 ID 映射必需；笔记与已知目标的 ID 映射可选、未配置时明确报错。不枚举私有知识库、不猜测 ID、不把真实文档 ID、Token 或个人内容写入公开仓库。
- 隔离工作区 Node v22.16.0（低于项目最低 v22.18），以临时原工具/服务依赖替身运行新增 S4-C 测试 **4/4 通过**，对新增源码进行语法检查通过。**完整检出测试/全部回归尚未执行**，不认定 Windows/设备/真实 iWiki 验收。
- 当前生产 MuSSE 仍走既有 Windows 官方 iWiki MCP。S4-D 的桥接修改和真机验收需单独授权，S5 受控写入仍是后续目标。S2-B 的三文档人工验收保持取消。

## 2026-11-04 S4-B 只读任务与日程代码已加入草稿分支（尚未接入设备）

- 用户已批准 S4-A 方案 B，授权范围仅为分支内 S4-B 开发与最小离线测试；Windows、真实 iWiki、ESP32、云端、提示词与 PR 合并均未授权修改。
- 新增 `server-readonly.ts`、`readonly-protocol.ts`、`tools-readonly.ts`，只暴露 `task_query`、`schedule_today`、`schedule_upcoming`、`schedule_overdue`，工具列表与实际调用均限制白名单。底层复用 `OfficialIwikiReadStore`。
- 未来运行需显式指定私有配置文件及任务表 `page-...` 映射；本轮未启动真实连接。
- 隔离环境 Node v22.16.0（低于项目要求 >=22.18）借助临时依赖替身执行 4/4 新测试通过，源码语法检查通过。**未在完整仓库运行测试/全部回归，不应虚报正式验收**。
- S4-C 目标/笔记、S4-D 设备接入和 S5 受控写入未开始；S2-A 成果保留，不恢复已取消的 S2-B 验收。

## 2026-11-04 最新状态：S3-A 提示词已由用户配置；S4 待审，S5 已定为后续目标

- **当前权威入口**：[S4 新对话专项交接与待审方案](IWIKI_S4_HANDOFF.md)；[用户正在使用的 MuSSE 完整角色提示词](IWIKI_S3_PROMPT_CURRENT.md)。开发仍位于 `feat/iwiki-s2a-readonly-contract` / [草稿 PR #24](https://github.com/Qi0331/MuSSE/pull/24)，**未合并主线**。
- **S3-A 用户反馈**：已将新版本角色介绍配置进小智控制台，并明确当前采用的是 `# Role: Muse` 的自然对话版本；iWiki 查询时机、查询方法、权限与回答原则维持完整的**只读**要求。配置动作由用户确认；目前没有新版人格自然度、唤醒开场变化或 iWiki 工具轨迹的正式验收，不宣称已全部优化成功。
- **S2-B 用户决策**：取消三篇虚构文档准备、Windows 三文档探针和逐项语音验收，不再要求继续操作。相关功能代码与模板仍保留作为历史；长期目标及快捷笔记的**真实 S2-B 只读验收未完成**，S2-A 的已通过结果不变。
- **S4 下一阶段仅为提议，待用户审查**：S4-A 比较最小只读业务接入路径；S4-B 任务与日程；S4-C 目标与笔记；S4-D 设备语音整合。没有实施任何新的业务 MCP 部署、Windows 桥接修改或 iWiki 写入。
- **S5 已明确为将来的实施目标**：通过逐次确认与严格权限控制执行任务/目标/笔记的受控语音写入。**当前仍禁止写操作**；此产品决定不是当下操作授权。
- 本次为文档与交接更新，没有重新进行 Windows/设备真机验收。保持 `xiaozhi-client@2.3.0` 的本机修补、防火墙、现有 ESP32 固件、官方 iWiki MCP、单数据源和不上云方案。

## 2026-11-03 新对话状态锚点：S2-A 已通过，S2-B 目标与笔记待用户验收

- 当前权威交接：[S2-B 专项交接](IWIKI_S2B_HANDOFF.md)、[S2-B 虚构数据与操作说明](../software/musse-iwiki/docs/S2B_GOAL_NOTES_ACCEPTANCE.md)。主线 `main` 仍为 `a9ae041531c138483a1c9c2fbf3b6c2992ec0baf`；最新工作只在 `feat/iwiki-s2a-readonly-contract` 的**草稿 PR #24**，没有合并。
- 用户已在 Windows Node v22.23.2 通过真实官方 `read_doc` 读取虚构任务表，成功统计 3 条/2 未完成/1 已完成/1 逾期/1 未来七天；用户反馈 MuSSE 设备语音任务查询成功，但逐次 MCP 使用证据仍缺失。
- S2-B 目标/笔记只读脚本与虚构三文档模板已开发并提交。**尚未有用户执行新测试或创建设定的目标与笔记测试文档的报告**，不能声称目标和笔记查询已完成。
- 新对话先检查新脚本和本地合成测试，随后引导用户在 iWiki 网页手工准备虚构测试文档，并进行最多三次只读查询、脱敏统计及设备语音验收；不部署第二个 MCP、不开放写入、不动生产桥接。


## 2026-11-03 S2-B 启动：用户确认 MuSSE 语音任务查询成功，长期目标与笔记待测

- 用户在 S2-A 的真实 iWiki 虚构任务表只读统计通过后，进一步确认 **MuSSE 设备端语音查询测试成功**。这属于用户现场反馈，尚无对应单次 `read_doc/search_kb` 使用计数或脱敏调用轨迹；不可据此声称调用证据独立核验完毕，也不能声称本仓库 13 项业务 MCP 已部署。
- **最小路线**：继续沿用已工作的小智智能体 → Windows `xiaozhi-client` → 官方 iWiki MCP 只读查询工具；先测试目标关联计算与快捷笔记，不启动第二个业务 MCP 服务，不动原生产配置、固件或私人知识库。
- 本 PR 功能分支新增 [S2-B 三文档虚构样例与语音验收](../software/musse-iwiki/docs/S2B_GOAL_NOTES_ACCEPTANCE.md)、`tools/probe-goal-notes.mjs` 及合成测试。用户还未在 Windows 执行新的目标/笔记验收，**未验证完成**。只统计目标与笔记数量，不输出正文，明确拒绝写入。
- 不实施自动提醒、CloudBase、真实账号写操作。现有 S2-A 通过结论保留。


## 2026-11-03 S2-A 最新完成：真实 iWiki 任务表只读查询闭环通过（仅 Windows 测试流程）

- 用户在 Windows PowerShell/Node v22.23.2 对 PR #24 的严格只读适配器与任务统计程序进行本地测试：`node --test tests/official-iwiki-read.test.mjs tests/probe-task-queries.test.mjs` **7/7 通过**。
- 用户本人通过 `node tools/probe-task-queries.mjs --live` 授权读取自建、虚构的 iWiki 测试任务表一次，脚本返回 `validatedTaskTable=true`、`taskCount=3`、`todoCount=2`、`doneCount=1`、`archivedCount=0`、`todayCount=0`、`upcoming7DaysCount=1`、`overdueCount=1`。与预先提供的三行虚构样例一致；统计路径报告 `remoteReadCalls=1`、`remoteWriteCalls=0`。
- **验收结论**：S2-A 的**独立 Windows 本地真实文档读取、Markdown 任务解析与任务/日程数量统计通过**。这是用户直接回传的程序输出；未独立审查服务端调用追踪，也不意味着小智云端语音已连接本仓库 13 个业务工具。
- **后续 S2-B**：在不修改原有 Windows 桥接的前提下，先用设备原有官方 iWiki 查询工具对这篇纯虚构文档做语音读取验证，检查实际工具调用证据；若需自然语言任务业务工具，再评估只读业务 MCP 的安全接入，不开放写入。未启用云端/新固件。
- 功能分支 `feat/iwiki-s2a-readonly-contract` / 草稿 PR #24；`main` 未合并。详见 [S2-A 交接](../software/musse-iwiki/docs/S2A_READONLY_HANDOFF.md)。


## 2026-11-03 S2-A 最新实测：iWiki 单文档读取结构已确认（任务业务仍待验收）

- 用户在 Windows Node.js v22.23.2 通过 `probe-read-structure.mjs --live` **一次成功调用官方 `read_doc`**，针对用户自行创建的测试文档 ID。真实响应为 `content[0].text` 承载的 JSON，形状含 `ok:boolean`、`data.doc_id:string`、`data.title:string`、`data.content:string`；没有独立 `structuredContent`。脱敏输出仅记录类型，不记录 `ok` 值、私人正文或文档 ID。
- 本功能分支据此新增 `OfficialIwikiReadStore` 严格只读映射和合成测试：失败时拒绝解析，远程写入与文档枚举均不开放；新增测试任务表模板及单次远程读取、内存统计的后续验收工具。**尚未实测任务表解析、任务/日程语音调用，也没有将该适配器部署到现有桥接**。
- 仅 PR #24 草稿功能分支更新；`main`、Windows `xiaozhi-client`、ESP32 固件和现有 iWiki 内容均未由 ChatGPT 修改。后续在用户手动编辑专用测试文档后再执行只读任务统计。
- 详细说明：[S2-A 交接](../software/musse-iwiki/docs/S2A_READONLY_HANDOFF.md)。


## 2026-11-03 最新 S2-A 补充：用户真实 iWiki 工具发现通过（业务尚未验收）

- 用户在 Windows v22.23.2 完成 S2-A 只读工具元数据实测：检查器离线测试 **3/3 通过**，无参数仅显示帮助；真实 `initialize/tools/list` 成功发现 27 个工具，六个指定查询工具均存在，字段分别为 `list_spaces(q)`、`list_docs(space_id, parent_id)`、`list_doc_tree()`、`search_kb(query, scope, space_id, limit)`、`read_doc(doc_id, doc_path)`、`get_doc_outline(doc_id)`。必填项只有 `list_docs.space_id`、`search_kb.query`（基于 schema）。
- 这是**用户回传的真实工具列表证据**，不是 ChatGPT 独立连接账号，也不是 `read_doc` 实际调用成功的证据。尚未确认响应正文结构、文档路径和 ID 关系、个人任务解析、语音业务工具；不执行写入。
- 本 PR 另外准备单文档只读形状检查器（开发侧新增测试 3/3 通过），用户尚未执行真实读取。见 [S2-A 交接](../software/musse-iwiki/docs/S2A_READONLY_HANDOFF.md)。


## 2026-11-03 S2-A 开发草案（仅功能分支，未完成真实验收）

- 已在独立分支准备 `software/musse-iwiki/tools/inspect-readonly.mjs` 与 3 项离线安全测试，使用已有 `IwikiMcpClient` 对官方 iWiki MCP 仅执行 `initialize` / `tools/list` 并输出脱敏的查询工具入参字段。默认不连接、不读取本地配置；`--live` 才由用户在 Windows 手动执行。
- 本批离线新增测试 3/3 通过（Node 22.16.0 隔离执行）；历史 29 项未在本轮重新执行。本地真实 MCP 契约、任务业务读取及语音查询任务/日程/目标均**未因这次代码提交而完成**，需用户在私有 Windows 环境继续验证。
- 绝不改动现有 `xiaozhi-client`、设备固件、云部署和知识库数据；D-013/D-014 的只读、被动查询决策保持。见 [S2-A 交接](../software/musse-iwiki/docs/S2A_READONLY_HANDOFF.md)。


## 2026-11-03 最终覆盖：Windows 本地 iWiki MCP 语音查询全链路已验证

- **最新里程碑**：用户亲自回传小智 MCP WebSocket `1/1` 已连接、iWiki MCP `1/1`、约 27 个工具成功发现，以及 `list_spaces` 实际调用 `ok: true` 返回 41 个可访问空间；随后用户确认 MuSSE 设备端语音查询 iWiki **成功**。此前的“未绑定设备”“尚未完成语音闭环”“未连接真实 iWiki”均仅为历史阶段记录，不代表当前状态。用户确认普通双向语音正常；没有要求或执行新烧录。
- **实际架构**：新 `YD-ESP32-23 2022-V1.3 / ESP32-S3 N16R8 / FT232R COM7` + 小智上游 `v2.5.2/bread-compact-wifi` → 已绑定的 MuSSE 小智云端智能体 → Windows `xiaozhi-client@2.3.0` → iWiki 官方 `https://ssemarket.cn/iwiki-api/mcp`，使用独立只读访问凭证方案。**这是直接桥接 iWiki 现成远程 MCP**，不是本仓库 `software/musse-iwiki/` 的 stdio/任务业务服务真实部署；后者第一批仍只有 29 项离线测试且 S2-A 尚暂停。
- **运行方式**：每次 Windows 开机后手动进入 `$HOME\MuSSE-MCP-Local\musse-bridge` 执行 `xiaozhi start`，电脑须联网、不断电不睡眠；电脑关机后 iWiki 不可用，原有设备语音仍可用。没有腾讯云服务器/网页/数据库/自动开机服务。操作详情见 [本地启动与维护手册](IWIKI_LOCAL_MCP_RUNBOOK.md)。
- **安全与边界**：客户端首次依赖 `@discordjs/opus` 安装失败，后经 `--ignore-scripts` 成功运行 MCP。Windows 防火墙拦截 TCP 9999 入站，本机访问正常。发现并修补 `dist/backend/WebServer.js` 与 `WebServerLauncher.js` 里的 2 处配置日志泄露；假令牌复测两项均 `False`。并非完全安全审计；重新安装可覆盖本机补丁。iWiki 工具同时提供写入功能，建议仅启用六个查询工具；**实际开关最终状态及服务端只读权限拒写未独立核验**。凭证、备份、原始日志、私人空间名称/文档不得进入 Public GitHub。
- **保留未知项**：用户报告语音端到端成功，但尚无可公开逐次对应的设备 MCP 调用追踪；OLED/麦克风/功放/按键的逐线独立电气验收、LED 矩阵与外置供电尚未完成。曾经的 COM7 `DOWNLOAD` 问题按用户报告已恢复，具体根因仍未知；不再重复排障。
- **下一轮**：本地链路已可日常使用，先以现有方案运行；下一任务由用户在新对话指定。仓库交接见 [HANDOFF](HANDOFF.md) 与 [TEST_LOG](TEST_LOG.md)。以下旧章节仅作历史快照，以本节为准。


## 2026-11-03 最新覆盖：COM7 启动故障已报告恢复，转入小智联网/绑定确认

- **当前任务**：用户本人表示“已经好了。目前的模块都配置好了”。新 YD-ESP32-23 2022-V1.3 / ESP32-S3 N16R8 / FT232R COM7 此前 ROM 下载模式异常**按用户报告已恢复**，当前不再作为既定故障反复排查。恢复方式、导致下载模式的具体根因、完全裸板验证细节均**未提供**；此前故障记录保留为历史。
- **证据边界**：模块“配置好了”不等于独立逐线、显示、麦克风采集、功放播放、按钮、长时间供电全部验收。新对话需向用户确认实际表现，而非默认全部外设真机通过。
- **小智联网与账号**：已讲解设备临时热点配网（手机辅助写入 2.4GHz Wi-Fi）、设备通过网络向小智服务获取激活信息、在 `xiaozhi.me` 将设备绑定到已有的 MuSSE 智能体。**尚未收到用户确认已完成 Wi-Fi 配网、设备绑定、云端对话或完整语音闭环**；后续由实际状态决定是否需要继续指导，不应自动重新配网。
- **固件及硬件不变**：Reasonix 已报告新板五镜像 5/5 校验且曾正常启动 `78/xiaozhi-esp32 v2.5.2/bread-compact-wifi`；新板原厂 Flash 备份由用户明确选择跳过。旧 CH343/COM6 板及其备份/Hello World 是另一块板；不得混淆。没有新增烧录/清空/eFuse/正式 MuSSE 固件改动。
- **项目暂停范围**：iWiki V1 第二阶段 S2-A 工作包仍未发给 Reasonix，软件开发暂停；D-013（iWiki 唯一持久化数据源、被动查询）保持。MuSSE 与 Muse 私人 Agent 隔离，不连接私人 MCP、不云端部署。
- 本段优先于后续“启动故障待定位”“必须重新裸板复测”“上游未烧录”等历史阶段性快照；证据见 [TEST_LOG](TEST_LOG.md) 与 [HANDOFF](HANDOFF.md)。


## 2026-11-03 最新覆盖：转入新板硬件联调，COM7 下载模式故障待定位

- **当前优先级**：用户明确暂停 iWiki V1 第二阶段；此前 S2-A 工作包**尚未转交 Reasonix**。D-013（iWiki 唯一持久化数据源、被动查询）继续有效，不启动云端、网页或真实账号联调。以下硬件新进展覆盖本文件较早的“上游尚未烧录”描述；历史记录保留。
- **与旧 COM6 主板区分**：新到货、经实物照片确认的开发板为 **YD-ESP32-23 2022-V1.3 / ESP32-S3 N16R8**，USB 转串口识别为 **FT232R / COM7**；此前 CH343/COM6 的 Hello World 和原厂备份是**另一块板**。
- **新板只读识别（用户本机终端输出）**：esptool v5.6.0 成功识别 ESP32-S3 rev v0.2、16MB Quad 3.3V Flash、40MHz 晶振，列出 8MB PSRAM；PSRAM 最初仅为识别，随后固件日志报告已发现并初始化 8MB PSRAM，未做独立压力测试。
- **新板真实烧录（Reasonix 本地报告，非 ChatGPT 直接审计）**：在用户明确授权**不做原厂 Flash 备份**后，复用锁定的上游 `78/xiaozhi-esp32` v2.5.2 / `bread-compact-wifi` 已有构建；在 COM7 写入 bootloader `0x0`、分区表 `0x8000`、OTA data `0xD000`、应用 `0x20000`、assets `0x800000`，**5/5 `Hash of data verified`、退出码 0**。未整片擦除、未修改 eFuse；新板原厂固件**无备份**。
- **曾成功运行（Reasonix 日志报告）**：烧录后 App v2.5.2、8MB PSRAM / 80MHz、SKU `bread-compact-wifi`、MCP 工具注册及 `starting -> wifi_configuring` 均出现，SoftAP 配网曾启动。当时 OLED 未接导致 I²C 初始化错误，但应用继续运行。此事实不等于已完成云端绑定或语音闭环。
- **当前阻塞（用户亲自回传终端日志）**：安装 FTDI 驱动后，`python -m serial.tools.miniterm COM7 115200 --dtr 0 --rts 0` 多次显示 `boot:0x0 (DOWNLOAD(USB/UART0)) / waiting for download`；关闭 DTR/RTS 后依旧如此。用户尝试改用板上原生 USB 口独立供电，但手机未发现 Xiaozhi 热点（无热点本身不能证明固件损坏）。**当前尚未从 Flash 启动应用，优先排查 GPIO0/BOOT、自动下载电路与外设/面包板干扰，暂不重烧**。最近一次复现时外设是否彻底全部拔除并取下裸板，现有文字回传尚不能独立确认。
- **外设/供电**：INMP441、MAX98357 系列功放、8Ω/3W 扬声器、0.91 英寸四针 OLED、按钮等已到货；用户称相关模块已接好，但**接线未经独立验收，OLED/采音/播放/按键均未功能验证**。两个 LED 矩阵、电平转换板和外置电源在本次到货批次中由用户报告**尚未到货**（旧档案曾记录一块 HT16K33A 已持有，具体是否为同一批或另存需核对）；目前用电脑 USB，**无万用表**。不要把 5V 矩阵直接连接 3.3V GPIO，也不准把 USB 与外电源并联。
- **新对话的单一优先任务**：保持新板完全断电后确认外设是否已全部从主板断开、是否已离开面包板；只接一个 USB/COM，在无 DTR/RTS 影响下核实 BOOT/GPIO0 的实际启动条件。若裸板依旧进入下载模式，优先查该 PCB 的原理图/按钮与自动复位电路，再考虑借万用表；**不把 `Espressif` 芯片制造商名称和 `bread-compact-wifi` 固件板型误判为冲突**。见 [TEST_LOG](TEST_LOG.md) 与 [HANDOFF](HANDOFF.md)。

## 2026-11-03 最新：iWiki 单数据源 V1 第一批

- 用户确认 **iWiki 单数据源、被动查询**；原 Vue 网页 + CloudBase + 主动提醒方案暂缓（D-013，覆盖 D-011 的实施方向，历史保留）。
- `software/musse-iwiki/` 已完成任务/日程/目标/笔记业务逻辑、文档模板、MCP stdio 服务；**29 项离线测试通过**。
- 真实 iWiki MCP（工具名、鉴权、版本条件写入）**未验证**；未使用真实 Token/账号；远程写入默认关闭。
- 小智直连 iWiki 未证实；推荐 `xiaozhi-client` 桥接。Windows 关机后工具不可用。
- 不改变下方 M0/M1 硬件与显示状态；未新增烧录、接线或云端操作。

- **最后更新**：2026-11-02（M0 真机运行、小智 v2.5.2 本地构建及官方控制台调查后）
- **阶段**：M0 主板基本程序链路已验证，GPIO/按钮及 LED 电气仍待验证；M1 上游语音固件已在 PC 本地构建，**尚未上板运行或实现语音闭环**。
- **仓库**：[Qi0331/MuSSE](https://github.com/Qi0331/MuSSE)，Public。GitHub 仍为文档/规则/检查脚本工程，本地实验代码和小智研究副本**尚未提交**。
- **证据层级**：CH343 插拔及最初芯片只读通信由用户实测；其后的备份、烧录、串口、构建和静态分析来自用户转交的 **Reasonix CLI 本地执行报告**。ChatGPT 未直接访问 Windows 主机或二进制原件。原始设备标识及备份不得公开。

## M0 已完成（来自真实本地报告，不是仅计划）

1. **CH343/芯片**：COM6 对应 USB VID 1A86:55D3；esptool v5.6.0 读得 ESP32-S3 rev v0.2、16 MB Flash、40 MHz 晶振，识别信息列出 8 MB PSRAM（未做运行时读写测试）。
2. **安全状态**：`get-security-info` 退出码 0，Secure Boot Disabled、Flash Encryption Disabled、SPI_BOOT_CRYPT_CNT=0。其他 eFuse 限制并未逐位审计。
3. **原 Flash 本地只读备份**：`C:\Users\Lenovo\MuSSE-Private-Backups\esp32s3_factory_20261102.bin`，16,777,216 字节，SHA-256 `cd0f30ac9491da499eaf2167f07b5accf23cf6779c506110431aa766f346273e`；**不得上传 Public 仓库**。离线解析发现原应用 `led_strip`（ESP-IDF v4.4-dev）、标准 `nvs/phy_init/factory` 布局。
4. **官方 Hello World 真机闭环**：ESP-IDF v6.1；16 MB / DIO / 40 MHz；经用户逐次授权，以 esptool 定点写入 bootloader `0x0`、分区表 `0x8000`、应用 `0x10000`；各自 `Hash of data verified`、退出码 0。CH343 115200 串口报告 5 次 `Hello world!`、4 次自动软件复位后再次启动，未见 panic。**原厂 led_strip 已被覆盖（有本地备份）**。不曾整片擦除或修改 eFuse。
5. **独立 GPIO/按钮工程**：`C:\Users\Lenovo\MuSSE-Lab\gpio_button`，ESP-IDF v6.1，本地 `idf.py build` 退出码 0；30 ms 消抖、低电平有效按钮及可选输出测试已编写，**默认均禁用且未烧录/未接线**。GPIO0/板载 BOOT 关系和具体开发板 PCB 未核验。
6. **小智 v2.5.2 上游研究**：本地研究副本锁定 tag `v2.5.2`、commit `49b4380b3faa0ceadd28a3e78aaf0f311c46c57e`，`bread-compact-wifi`（`esp32s3`）在 ESP-IDF v6.1 下由 Reasonix 报告 `python scripts/build.py bread-compact-wifi --name bread-compact-wifi` 退出码 0。应用 `xiaozhi.bin` 2,577,504 字节；16 MB/DIO/80 MHz、Octal PSRAM 80 MHz、含 assets/OTA 分区。**没有烧录此上游固件、没有 PSRAM 运行时验证，也没有配网/音频实测**。详见 [UPSTREAM](UPSTREAM.md)。

## 已有与新采购硬件（采购不代表到货或实测）

- **已持有并识别**：ESP32-S3-N16R8、面包板、跳线、按钮、USB 数据线；创乐博 **I²C 16×16 矩阵**（2× HT16K33A，接口 +5V/GND/SDA/SCL，电平、电流、地址未核验；**禁止接线/上电**）。
- **尚无新的到货确认**：INMP441、MAX98357、扬声器、0.91 英寸 OLED（此前已采购、未到货）。
- **用户于 2026-11-02 提供新购商品截图**：标称 5V/3A USB 充电器、**另一块** 16×16 WS2812B 256 像素 5V RGB 矩阵、BSS138 四路 3.3V↔5V 电平转换模块，以及带 14500 电芯的 5V/3.3V 供电模块。**仅商品图/采购口头确认，型号规格、实物到货和性能均未验证。** 新 WS2812B 不等于旧 HT16K33A I²C 矩阵；BSS138 I²C 模块也不能默认适合 WS2812B 高速单线数据。见 [HARDWARE](HARDWARE.md)、[LED_MATRIX](LED_MATRIX.md)。
- **供电方向**：用户最新决定以 **USB 5V 长期有线桌面运行、暂不采用电池** 为主线；已买的 14500 供电模块不自动成为整机方案。适配器标称 5V/3A 不代表能够满足 256 RGB LED 全亮电流，也不能直接并接开发板 USB/5V 引脚。

## 下一步（新对话工作入口）

**以本地软件功能为主，暂停反复基础板测试**：利用上游已确认的 `DeviceStateMachine` 状态变化与 `Led::OnStateChanged()` 接口，独立编写 **16×16 表情帧缓冲、5 种状态表情、动画与 PC 离线单元测试/预览**；先设计与具体 LED 硬件无关的逻辑层，再分别评估 HT16K33A I²C 与 WS2812B 单线 RGB 驱动适配，不立刻选择或接线。等配件到货再做语音真机闭环。

并行待办：核验开发板 PCB/BOOT 引脚；核实两种矩阵的供电电流、电平和数据时序；确认 5V 配电/保护、调试时 USB 反向供电隔离；梳理 #1/#4/#7/#10/#11 的完成范围。阶段性汇总后再提交本地实验源码与可复现构建说明，不直接上传大型上游源码、构建二进制、Flash 备份或私密日志。

## 尚未验证与禁止越界

- 未验证：独立 GPIO/按钮真机；PSRAM 读写；小智 v2.5.2 真机启动、配网、绑定、I²S/语音；OLED；两块 LED 矩阵的安全电气、像素/地址；整机电源长期负载与温升；校园接口、后端和长期记忆。
- 不得将本地编译等同上板可运行；小智参考板 GPIO 不代表本机已确认引脚。任何新固件烧录、Flash 擦除/eFuse 修改或有风险接线均须用户另行明确授权。
- 只在完成并保留真实日志证据后更新状态；外部 Issue 评论仅为建议，不等于硬件实测结论。

## 2026-11-02 官方控制台调查（晚间增补，覆盖上文原“直接新造表情引擎”建议）

- 用户已在小智控制台 2.0 创建 `MuSSE` 智能体，但**未绑定设备**，没有实际对话；当前选择“小智 Lite”。界面中“记忆”已开启但条目数为 0；“知识库（内测）”有用户创建的空白测试知识库，智能体尚未关联知识库；“扩展能力”提供内置服务勾选与 MCP 接入点，观察时接入点显示“加载中”，**未做连接实测**。
- 官网存在云端固件编译功能，但未创建编译记录；与此前 Reasonix 报告的本地固定版本构建是两种方式。本轮没有生成新固件，也没有云端调用。
- **当前下一步调整**：先只读核实 v2.5.2 已有情绪/状态/显示接口，再在 Windows 离线完成 MuSSE 16×16 像素适配层、动画预览、单测，优先复用上游情绪语义，不重复造官方语音/云端 AI。待办、定时提醒、长期追踪在后续 M3/M4 评估云端 MCP 扩展及独立持久化方案，暂不开发。
- 完整能力边界及权限风险见 [官方平台调研](XIAOZHI_PLATFORM.md)；原上游源码、原厂 Flash、账号凭证和用户截图没有进入仓库。

## 2026-11-02 M1 显示核心源码正式入库（最新状态，覆盖上述“尚未提交本地实验代码”的旧描述）

- 最新主线成果：`software/musse-display/` 已通过独立离线审核并由 ChatGPT 提交为 GitHub 软件归档；包含 16×16 RGB888 表情引擎、动画、状态适配、事件队列、NoopSink、上游集成补丁、C++ 单元测试、预览生成器、脱敏证据及完整报告。**这是源码归档，不代表小智固件已经在 ESP32 上运行。**
- 验证：Reasonix Windows 报告 93/93 测试、CTest 2/2，ESP-IDF v6.1 固定上游隔离构建通过；ChatGPT 从归档源码在独立 Linux 环境重新 CMake 编译并运行 CTest 2/2 通过；此前独立审查报告还复现 93/93、ASan/UBSan 测试。目标设备真机 LED/语音仍未验证。
- 可审查源码入口：`software/musse-display/README.md`；上游小智 v2.5.2 的集成改动保留为 `software/musse-display/patches/0001-musse-display-integration.patch`，**没有直接导入整个上游代码库**。
- 最新软件下一步：双矩阵 HT16K33A I²C 与 WS2812B RGB 输出层仅做**离线 Mock/仿真开发**；在连接物理 LED 前解决真实 Sink 切换同步、事件洪泛渲染预算、序列号回绕等剩余问题；继续保留所有硬件接线、供电与烧录前的单独授权要求。
- 归档未包含：原厂 Flash 备份、账户 Token、硬件私密日志、上游完整工作树、固件镜像、2MB 自动生成的 HTML；预览可由 C++ 生成器再生成。

## 2026-11-03 最新状态：B+C 软件 V1 已定范围，未开始实现（以本节覆盖旧“下一步”建议）

- **已确定**：优先开发独立 MuSSE 任务/长期目标/快捷记录网页与 iWiki 个人知识库入口。电脑关机后仍须能从手机访问；云端候选优先国内腾讯云开发 CloudBase。知识库文档与结构化任务分开保存；具体云数据库类型待实际接入时确认。详见 [PRODUCT_V1.md](PRODUCT_V1.md)、[ROADMAP](ROADMAP.md)。
- **明确暂缓**：主动推送、后台定时提醒、自动播报、通知渠道；截止与逾期信息仅在打开网页或用户主动查询时显示。
- **开发方式**：直接做正式 B+C 页面和数据业务逻辑，必要时仅用极小本地测试数据，不设独立 Mock 阶段；测试以确保基本可用、数据正确与权限安全为限，避免无限修正。
- **状态边界**：本次仅敲定产品规划；没有实际开发 B+C、开通腾讯云、部署网页、创建云数据库、连接用户 iWiki Token 或执行小智 MCP。M1 表情软件已归档、音频/矩阵真机未验证的事实不变。
- **新采购**：2026-11-03 用户又购标称 **5V/5A 可充电电源**，未确认到货和持续额定输出；不能认定满足 256 颗 RGB 灯全亮，亦不自动改变既定 USB 5V 桌面方案。详情见 [HARDWARE](HARDWARE.md)。
- **外部 Issue**：用户要求暂不处理其他贡献者建议；不更新 Issue，也不因评论修改硬件实施计划。
