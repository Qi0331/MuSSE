# 实验与测试日志
## 2026-11-04 T-20261104-28 — Windows S5 真实语音写入成功（用户反馈）与 S6 设计
- 用户明确给出 Windows PowerShell 安装日志：`Updating c09f5a4..deea681 Fast-forward`，`S5_WRITE_INSTALLED_TASKS_ONLY_RESTART_XIAOZHI`；新“小七”智能体管理页面的 S5 工具列表启用，且设备语音中的任务查询、prepare、cancel 三项测试均由用户报告“工具调用成功”。之前管理面板 `musse_write_cancel` 一次使用记录是**用户手动网页测试**，不能误算为设备语音测试；后来的三项语音成功是独立的新反馈。
- 随后按两轮语音“准备任务/预览 → 下一轮确认写入”验收，用户回复“成功了”，并指出新增事项出现在 iWiki 个人空间《测试》文档。**证据性质：用户直接现场报告**，没有此轮远端原始 `edit_doc` 与 `read_doc` 响应作为 GitHub 归档，不得擅自声称已独立核验所有内部步骤。
- 用户确定正式文档组织与下一研发任务：核心表固定 ID，长期目标文件夹每目标一文档 + 未来动态目录内唯一定位，避免逐文档手动映射；迁移旧《测试》时原地重命名/移动、不得丢记录或静默重新建空表。当前此 S6 扩展**尚未写代码、未创建文档或修改 Windows 私有映射**。
- 安全事件：用户粘贴 PowerShell 原始 JSON 解析报错时，错误文本中包含完整个人 MCP 端点和 iWiki Token。**仅记录事件，不复现任何秘密**；建议立即轮换两个令牌，避免今后发送含私密值的原始日志。
- 对照原有 S5-I GitHub 全量 153/153 通过；本次是用户现场真实验收，不要求重跑旧离线测试。完整新对话交接见 `docs/IWIKI_S6_DYNAMIC_DISCOVERY_HANDOFF.md`。

## 2026-11-04 T-20261104-27 — S5-I 真实可写语音服务一键安装（开发测试）
- 用户明确要求从只读预览改为直接具备写能力。新增 `src/mcp/server-s5-write.ts` 以及 `tools/s5-write-bridge.mjs`：S5 仅通过显式安装的第三条专用小智服务启动，自动验证本机原双服务与映射、写入本地纯字段契约、离线子进程启动 smoke、备份私有 JSON、注册新条目，可原状回滚。原 S4 服务、Token 与映射不变，安装阶段不访问任何远端文档、不会调用 `edit_doc`；正式写入需要后续真实独立语音确认。
- 新增 5 个完整测试（实际 Node 子进程 + 合成私人 Windows 配置/失败防护/回滚），GitHub [41824829014](https://github.com/Qi0331/MuSSE/actions/runs/41824829014) **153 tests、153 pass、0 fail、0 skipped**；仓库检查 [41824829102](https://github.com/Qi0331/MuSSE/actions/runs/41824829102) success。
- **尚未进行**：用户 Windows 最新代码快进/安装、真实小智/ESP32 语音修改、真实映射任务 Markdown 解析及写权限。已知目前只有 `taskDocId` 有效格式，`notesDocId` 缺失；任务写入将在实际“确认写入”后真的修改私人映射的 iWiki 任务页，非隔离试页。语音确认来自模型转发，并非硬件身份认证；iWiki 不支持已验证的原子 CAS，写前检查与 edit 之间有残余竞争窗口。回滚只解除新服务而不撤回已写远端内容。

## 2026-11-04 T-20261104-26 — S5-H 可注册的真实语音预览服务与回滚机制
- 新增独立 S5 预览服务入口，实际 Node 子进程启动测试确认：没有私人 `musse-iwiki-write.json` 时正常初始化，`tools/list` 只含 `musse_write_prepare` / `musse_write_cancel`，伪造 `musse_write_confirm` 返回 `S5_PREVIEW_ONLY`；服务侧读取使用只读映射，不持有编辑函数。即使环境意外设置 `MUSSE_S5_WRITE_ENABLED=1`，预览服务仍不能写。
- 用合成 Windows 桥接配置执行真实的安装/回滚函数：只追加 `musse_iwiki_s5_preview`、备份原始文件、保留官方 iWiki/S4 旧服务、回滚复原原 JSON；缺少 S4 或私有映射时不修改配置。用户尚未在真实 Windows 上执行安装。
- GitHub S5 commits `349df3e`、`8bdbc17`，完整 Node [run 41823641283](https://github.com/Qi0331/MuSSE/actions/runs/41823641283) **148/148 pass、0 fail、0 skipped**；文档检查 [41823641268](https://github.com/Qi0331/MuSSE/actions/runs/41823641268) pass。
- **边界**：这是现场语音**预览模式**入口，不是语音写入验收；第三个 MCP 仅在用户在 Windows 显式执行 `--install-preview` 后才注册，并且需重启小智。取消后不得写入。正式 S5 写入仍需单独授权和合规隔离文档。

## 2026-11-04 T-20261104-25 — S5-G Windows 本机 144/144 + 只读预检（用户实际终端证据）
- **证据来源**：用户提供 Windows PowerShell 原始终端输出。独立 S5 worktree 中 `git -c http.version=HTTP/1.1 fetch origin feat/iwiki-s5-guarded-write-design` 成功；随后 `git merge --ff-only FETCH_HEAD` 报告 `Updating e1f30fc..c09f5a4` 与 `Fast-forward`。没有从此推断线上 S4 配置发生任何变更。
- **真实本机完整测试**：`software/musse-iwiki` 执行 `npm test`，最终统计 `tests 144 / pass 144 / fail 0 / skipped 0`，包括 S5-G stdio JSON Lines、prepare/confirm/cancel、回执/写后读回及只读本地预检的合成测试。这是独立于 GitHub Actions 144/144 的 Windows 本地输出；测试未连远端写入。
- **实际只读预检**：`inspection:LOCAL_READONLY_NO_MCP_CALLS_NO_CHANGES`、`nodeSupported:true`、`officialIwiki:CONFIGURED`、`s4Readonly:REGISTERED`、`taskMapping:TASK_VALID`、`notesMapping:NOT_CONFIRMED`、`s5BridgeEntry:ABSENT`、`writeContract:NOT_CONFIRMED`、`contractFile:MISSING`、`writeFlagInThisShell:NOT_SET`、`liveVoiceValidated:false`、`productionWriteAuthorized:false`。该工具不调用 MCP、无网络、不写文件。
- **未解异常（必须实事求是）**：第一条 `git branch --show-current` 与预期分支比较触发 `WRONG_BRANCH`。后续独立命令仍继续执行，快进虽成功，但尚不确定是其他分支还是 detached HEAD；无法据此确认 worktree 处在预期本地分支。下一步仅用只读 Git 命令核实状态，禁止未经检查盲目 switch/reset/创建分支。
- **结论**：Windows 本机离线测试/只读配置预检已完成，**S5 实际小智/ESP32 语音写入尚未接入**。不重复 S5-F 实写探针，不修改真实任务总表，不擅自增加第三个 S5 MCP、创建私有写映射、开启 S5 写权限或迁云。S4 双 MCP/安全补丁/Token/ESP32 不动，两个 PR 均留 Draft。

## 2026-11-04 T-20261104-24 — S5-G Windows 只读预检工具（开发侧，非本机实跑）
- 增加 `software/musse-iwiki/tools/s5-local-preflight.mjs` 与 `npm run preflight:s5 -- --local-readonly`。无参数仅帮助；显式执行也只从 Windows 私有 JSON 读取信息，报告脱敏的原官方 iWiki/S4 注册、S5 注册状态、文档映射格式、`edit_doc/doc_id/content` 写契约格式与当前 Shell 开关；**不调用 iWiki、不注册 MCP、不写任何配置/生产文档、不输出 Token、真实 ID 或路径**。
- 新增 `tests/s5g-local-preflight.test.mjs` 三项合成私有配置测试：合法配置脱敏/保留 S4、无写契约不误判准备就绪、异常契约和 S5 注册检测、不修改输入文件。GitHub S5 commit `9b6ec4f` 全量 Node CI [41819040249](https://github.com/Qi0331/MuSSE/actions/runs/41819040249) 实际输出 **144 tests / 144 pass / 0 fail / 0 skipped**；Repository checks [41819040721](https://github.com/Qi0331/MuSSE/actions/runs/41819040721) success。
- **证据边界**：GitHub 合成测试，而非用户 Windows 已跑预检；没有新增真实语音或 iWiki 试写。后续用户授权后才进行本地一次性同步/离线测试/只读预检及隔离语音联调，不要重复 S5-F 实写。

## 2026-11-04 T-20261104-23 — S5-G 语音写入离线端到端集成（无真实远端写入）
- 先读 GitHub `da4394d`：完整 Node CI run `41816644844` **130/130 pass、0 fail**；文档检查 run `41816644660` 成功。确认 GitHub PR #24 与 PR #25 均为 Draft，S5 base 为 S4 分支。
- 提交 `8e2b320`：官方业务 `ok:true` 与 `data.doc_id` 必须对应预期页，拒绝 `ok:false`、矛盾包络、未知响应和错页回执；修复写前 `read_doc` 失败时错误进入 `UNCERTAIN` 的状态（未写入应拒绝且允许新提案）；新增十项模拟 MCP 端到端用例，覆盖工具列表、预览、明确/含糊确认、取消、重复、网页冲突、读写不确定与笔记写入。完整 CI run `41817549089` **140/140 pass**。
- 提交 `cd88bc9`：将同一独立 S5 服务的 stdio 处理提取成可注入流，不改变默认拒启用策略；新增从初始化、工具列表到跨两轮标准输入输出 `prepare → confirm` 的模拟用例。GitHub Node 完整 run [41817781723](https://github.com/Qi0331/MuSSE/actions/runs/41817781723) **141/141 pass、0 fail、0 skipped**；Repository checks run [41817781852](https://github.com/Qi0331/MuSSE/actions/runs/41817781852) 成功。
- **证据边界**：这 11 项新增测试都是模拟 iWiki 回执与内存文档，GitHub CI 在 Linux 跑 Node；没有读取 Windows 私有 Token/配置，没有运行真实 `edit_doc`，也没有 ESP32/小智真实两轮语音。用户 Windows 128/128 和 S5-F 私人隔离文档真实编辑成功仍是独立的上阶段证据，不冒充本次语音联调。
- **结论**：S5-G 离线集成通过；进入受控部署前授权评审而非生产启用。详见 `docs/IWIKI_S5G_OFFLINE_INTEGRATION.md`；S4 双 MCP、Windows 桥接、日志补丁、Token、ESP32、真实任务表和 S4/S5 Draft PR 均不更动。

## 2026-11-04 T-20261104-22 — S5-F 真实既有页编辑通过（最终实测）
- 用户 Windows 从 `b215fcb` 快进至 `e1f30fc`，`npm test` 运行 **128 tests / 128 pass / 0 fail**。该统计是用户 Windows 本地实际输出，并非 GitHub CI 冒充。
- 调用 `npm run probe:s5-existing-edit -- --edit-once`，本机输入原私人空间名称后，测试脚本通过只读 `list_spaces`、指定空间的 `list_docs`、`read_doc` 确认**唯一匹配**已存在合成文档 `MuSSE S5-F 自动隔离测试 8a6fc40f`，且正文仍是初始标记。用户在本机明确输入 `EDIT`，仅对该文档执行一次 `edit_doc({doc_id,content})`，没有再次调用 `create_markdown_doc`。
- 真实返回：`editAttempted:true`；`editCallFailed:false`；MCP `mcpError:false`；业务信封 `ok:true`，`data` 键含 `doc_id,title,new_rev_no,old_chars,new_chars`；`errorKind:NO_EXPLICIT_BUSINESS_ERROR`；写后 `readback:UPDATED`，`outcome:EXISTING_EDIT_VERIFIED`。**服务端真实编辑且读回验证成功**。
- 区分历史事实：同一文档在首次自动创建后曾收到一次 `edit_doc` 业务 `ok:false` 且 `readback:UNCHANGED`；当时 `data.error` 具体值未保留，故失败原因仍不明。成功的复测不能倒推出第一次失败原因。
- 范围：只验证该私人空间的单篇合成 Markdown 文档和当前 Token 权限；不代表生产任务总表或不同文档权限已验证，不代表 ESP32→桥接→S5 voice MCP 端到端完成。S5 仍默认关闭，S4 生产只读与 PR Draft 不变。禁止再重复写该测试页；它现已含更新后的标记。


## 2026-11-04 T-20261104-21 — 编辑文档契约确认及既有页最小复测探针
- 用户 Windows 官方 `npm run inspect:s5-edit -- --live` 真正只读核查成功，文档说明证实 `edit_doc` 是整篇 Markdown 覆盖、支持 `doc_id` 定位目标、可选 title，走三路合并保存且要求编辑权限；`append_to_doc` 同样需要编辑权限；`list_docs` 接受必填 `space_id`，返回标题、类型、更新时间，可用于寻找已有测试页。
- 未有新一次远端编辑。为避免重建新页面，新增 `s5-probe-existing-edit.mjs` 和单测：仅在 list_spaces/list_docs/read_doc 识别唯一本次创建的合成页且初始正文严格匹配后，提示本机明确输入 EDIT，至多一次 edit_doc 并读回；错误分类限定，原始响应值、页面 ID 和空间 ID 不输出。其他情况停止。
- 目前该新脚本真实服务端行为（list_docs 返回结构、定位、edit 结果）仍未核实，CI/Windows 全量通过情况亦必须另行记录；不得将离线模拟测试当作远端写成功。

## 2026-11-04 T-20261104-20 — 真实创建通过，真实编辑被拒绝
- 用户 Windows 选择 `list_spaces` 的第 3 个个人空间（仅为用户主动选择，本记录不使用私人空间 ID），发起一次合成隔离创建。生成标题 `MuSSE S5-F 自动隔离测试 8a6fc40f`，`createAttempted:true, createCallFailed:false`，`createResponseShape.envelopes[0].ok:true`。服务器返回 `doc_id` 等数据键，程序成功从响应解析唯一 ID 并对该新页面做首次 `read_doc`。
- `editAttempted:true, editCallFailed:false` 但 `editResponseShape.envelopes[0].ok:false`，`dataFields:["error"]`；`readback:"UNCHANGED"` 且 `outcome:"EDIT_UNCONFIRMED"`。真实创建和读成功，**真实更新失败，服务器的 error 值尚未采集**。
- 不重新发起自动创建测试，防止另建隔离页。新增 `s5-inspect-edit-metadata.mjs` 与离线单测、`npm run inspect:s5-edit -- --live`，只读 `tools/list`，获取编辑工具与现有文档定位工具字段说明；仍未对新页面二次编辑。

## 2026-11-04 T-20261104-19 — 按 iWiki 界面改用 list_spaces
- 用户截图展示多个团队和公共空间，以及“我的文档”导航；不能推定“我的文档”可充当 `space_name`。此前修复的 Windows 回归 116/116 已由用户本机通过，但当前终端只等待空间名，尚未调用新的创建或编辑。
- 增加自动探针的只读 `list_spaces` 预先列举可见空间、用户本机按编号选择私人空间/按 0 取消、列表无法解析时不写入；新增模拟测试核验列举及失败保护。尚无真实远端 list_spaces/create/edit 的新证据。

## 2026-11-04 T-20261104-18 — Windows 115 项回归中 2 项失败：定位并修复
- 用户在 Windows S5 独立 worktree 更新至 `e660f2b` 后执行完整 `npm test`，结果 **115 tests / 113 pass / 2 fail**；测试脚本已拦截，不曾执行新的 `create_markdown_doc` 或 `edit_doc`。已获得两个失败的完整错误片段。
- #58 `S5-C default CLI is inert and only shows help`：测试直接把 `new URL(...).pathname` 传给 `execFileSync(process.execPath,...)`，Windows 下变成 `/C:/...`，最终 Node 报 `C:\\C:\\...`。已改成 `fileURLToPath(new URL(...))`，仅修跨平台测试路径。
- #90 `updates only the target task row`：Windows checkout 的 fixture 使用 CRLF，`updateTaskRow` 原先按 `/\\r?\\n/` split 后用 `"\\n"` join，导致非目标行尾 `\\r` 被改动，违反“非目标行保持原样”。已修改生产函数保留原始分隔符，添加 CRLF 和混合换行保持性单测。这是实际代码缺陷，不能简单让测试忽略 `\\r`。
- 以上修复已提交 S5 分支，最新功能改动为 `8b8e966`。**尚需最新 Windows `npm test` 或 GitHub CI 实际通过的证据**，不得预先声称全绿。
- 原 S4 双 MCP / Windows 生产桥接和私人配置完全不动。仍未启动修正后的真正 create/edit 探针。


## 2026-11-04 T-20261104-17 — S5-F 创建空间参数定位及修复
- 用户 Windows 从 `7aa98f0` 更新至 `39877ec`，执行 `npm run inspect:s5-create -- --live` 成功，工具 `create_markdown_doc` 的说明实际指出：目标知识库空间必须用 `space_id` 或 `space_name` 指定（二选一），`parent_id` 可选，创建即发布；正文是整篇 Markdown。这里没有 `tools/call`，不属于写入。
- 确认旧探针只有 `title/content`，缺少业务层必需的目标空间；能解释第一次 `ok:false`。尚未核验是否有写权限，不能把这个原因扩大为唯一未来错误。
- GitHub 侧修复 `s5-probe-auto-create.mjs`，下一次由用户在本机交互输入精确空间名称；仅将 `space_name` 添加到自动创建参数。新增模拟测试证明缺空间时绝不会调用远端。真实 create/edit 重试前先完成最新 CI 核实；此处没有额外实际远端写入。

## 2026-11-04 T-20261104-16 — S5-F 首次真实创建尝试：业务拒绝
- **最新 GitHub CI**：独立完整 `iWiki Node tests` run `41808126130` 实测 **114/114 pass、0 fail**；`Repository checks` run `41808125886` 成功。新增仅 tools/list 的创建工具元数据检测测试 2 项，**不涉及新的远程写入**。
- 用户 Windows 独立 worktree 在 Git HTTP/1.1 fetch 成功后，从 `508e908` 快进至 `7aa98f0`，`S5F_UPDATE_SUCCESS`；原 S4 工作区未切换分支。
- 用户执行且仅报告一次 `npm run probe:s5-auto -- --create-and-write-test`，生成合成测试标题 `MuSSE S5-F 自动隔离测试 e02cd7d9`。官方 `create_markdown_doc` **确实被调用**，没有抛网络异常（`createCallFailed:false`），MCP `isError:false`。
- 但业务返回 JSON `ok:false`，其 `data` 仅被脱敏汇总为字段名 `error/reason/expected`，具体字段值尚未采集；因没有确认新 `page-...` ID，自动中止并返回 `CREATE_UNCONFIRMED`，**`editAttempted:false`**。
- 此结果无法判断是缺少目标知识库空间、Token 缺写权限或其他输入规则；也不能认定已成功创建。不得盲目重复创建，也不得冒称 `edit_doc` 已通过。
- 新增仅 `initialize/tools/list` 的创建工具元数据检查 `npm run inspect:s5-create -- --live`，不再调用写接口；等待 Windows 实际字段说明后，按真实证据选定唯一的下一次测试。此检查源码与模拟单测按 CI 结果另行确认。


- **最新 GitHub CI 实际结果**：run `41799562069`，完整 Node 测试 `112/112 pass, 0 fail`；文档 CI run `41799562141` 成功。新增 8 项自动创建/一次编辑模拟测试；真实 iWiki create/edit 均尚未执行。
## 2026-11-04 T-20261104-15 — S5-F 自动创建并编辑探针代码（尚未远端运行）
- 用户建议不必人工先创建隔离文档，直接测试官方 `create_markdown_doc` 和 `edit_doc`。增加 `tools/s5-probe-auto-create.mjs` 及 `tests/s5-probe-auto-create.test.mjs`，并注册 `npm run probe:s5-auto`。
- 未指定 `--create-and-write-test` 不会连线；指定后仅一次创建隔离测试页，若没有明确成功且唯一 `page-...` ID 则停止；仅对自动新建的测试页执行标记核验、一次 edit、写后核验。不打印私密 ID、Token、正文或远端异常，不自动重试。
- 此处新增测试为模拟远端，不构成真实创建或编辑成功。当前 Windows 仅 `tools/list` 有用户实测证据。新增代码是否通过完整 Node CI，以关联提交最新工作流为准。



## 2026-11-04 T-20261104-14 — S5-F Windows 官方工具发现（用户终端证据）
- **本次新增实际 GitHub CI**：最新 S5-F commit `c38ecad`，`iWiki Node tests` run `41798382817`：完整 `npm test` **104 tests / 104 pass / 0 fail**；`Repository checks` run `41798382801` 成功。新增 6 项隔离探针测试（前置标记、一次写入、异常不重试、脱敏、默认无动作）；远端 iWiki 写入仍为 0 次。
- 用户在 Windows PowerShell 执行 `git fetch origin feat/iwiki-s5-guarded-write-design` 与 `git worktree add --detach ... FETCH_HEAD`，独立工作树 HEAD `508e908`；原 S4 工作目录未切换分支。
- 在 S5 工作树执行 `npm run inspect:s5-write -- --live`，实际返回 `advertisedToolCount=27`、六个候选 `write_note/create_markdown_doc/create_doc/append_to_doc/edit_doc/edit_page_config`；`edit_doc` 字段 `doc_id/content/title`，必填 `content`；`append_to_doc` 字段 `doc_id/content`，必填 `content`。所有候选 `hasVersionNamedField=false`。
- 原检查脚本只发 MCP `initialize/tools/list`，不执行 `tools/call`；用户提供的文本不含 Token、私有页面 ID 或原始 JSON 配置。**没有验证编辑功能、真实写入、远端权限或成功响应**。
- 本轮开发者新增仅用于以后隔离文档联调的单次 `edit_doc` 探针及模拟单测，未执行真实写入。代码测试是否通过，以本轮 GitHub Actions 后续实际结果为准。参见 `docs/IWIKI_S5F_DISCOVERY.md`。

## 2026-11-04 T-20261104-13 — S5-E 实用普通写入适配与两轮语音协议
- GitHub Draft PR #25 新增轻量 `check-before-write` 模式、无默认写接口的官方 iWiki 普通写入适配、两轮语音确认流程及默认禁用的独立 MCP stdio 服务。现有 S4 只读服务没有改变。
- **实际 GitHub Actions 在完整仓库检出、Node.js 22.23.4 上执行 `npm test`：98/98 pass、0 fail**。最近成功 run `41792735125`；文档 `Repository checks` 同次成功。
- 新增假 iWiki MCP 测试覆盖准备不写、显式二次确认、写前网页更改被识别为冲突、写后读回、严格模式兼容、映射缺失拒绝、错误写入响应不虚报、语音取消/过期，以及新服务默认禁用。不借助真实 iWiki Token/页面或生产 WebSocket。
- **没有真实 iWiki 的工具契约/权限/远端写入测试**。非原子模式在最终读取和实际写入间存在残余竞争窗口，这是用户指定的简化取舍，不能宣称完全并发安全。对话确认不是独立可信用户身份认证。
- PR #24/#25 保持 Draft，不合并，不触碰现有 Windows/ESP32/云端/私人映射文件；最新完整交接 `docs/IWIKI_S5E_PRACTICAL_HANDOFF.md`。


## 2026-11-04 T-20261104-12 — S5-D 全量 GitHub Node CI（完整工作区）
- 新增 `.github/workflows/iwiki-node-tests.yml`，在完整 GitHub 检出的 `software/musse-iwiki` 执行 `npm test`；GitHub Actions `iWiki Node tests` **run `41784910123`，job `126424728412`，Node.js `v22.23.4`** → **84 tests / 84 pass / 0 fail**，结论 `success`。仅标准库测试；不注入密钥，不访问生产 iWiki。
- 首次运行 run `41784471528` 的 81 项结果为 **80 pass / 1 fail**，失败是旧 `tests/service.test.ts` 对即时 `note_create` 的日期断言硬编码 `2026-11-03`，在 2026-11-04 执行失败；改为调用前后实时上海日期窗口后，整个 CI 通过。
- 新增三项核心安全回归：在途提交跨 TTL 不被误删且阻止同文档新提案、`UNCERTAIN` 跨过期仍隔离同文档、任务单行字段换行显式拒绝。S5 专项由 26 增至 29 项，包含在 84/84 全包测试内。
- 既有 `Repository checks / validate-docs` 工作流只验证文档骨架，不应混称为 Node 全量测试。完整 S5-C 之前局部测试的局限由本轮全量包 CI 证据补足，但仍没有 Windows 生产运行、iWiki 真实写入或用户可信批准 UI 的测试。
- S5 分支六文件本地/GitHub 哈希比对属于此前 S5-C 证据；本轮额外提交后以 GitHub CI 对当前代码的整包通过为准。
- 未执行任何真实 iWiki `tools/call` 写入；未修改 Windows/ESP32/Muse 人设/凭证/防火墙或生产配置。查看 `docs/IWIKI_S5D_FINAL_HANDOFF.md`。


## 2026-11-04 T-20261104-11 — S5-C 离线确认门禁增强及只读写工具发现器
- **开发侧环境**：隔离 Linux Node 22.16.0（低于生产 >=22.18），本机暂存的部分依赖模块根据此前 GitHub 可见源码重建，非完整仓库检出。
- **实际运行**：`node --experimental-strip-types --test tests/s5-guarded-write.test.ts tests/s5-plan-write.test.ts tests/s5-inspect-write-contract.test.mjs` → **26/26 pass，0 fail**。六个 S5 源码与测试文件运行 `node --experimental-strip-types --check` → **6/6 pass**。
- **新增用例**：已验证回执经过新提案仍能去重；并发提案在异步读取期间严格占用容量；超长预览安全拒绝；任务确认前后值、完整笔记/创建预览；笔记文档错误映射拒写；写工具候选列表脱敏、假连接工具不执行 `tools/call`、CLI 无参数只帮助。
- **仓库完整性**：6 个 S5 源码/测试文件 GitHub blob SHA 与本机 `git hash-object` 逐一比对 **6/6 相同**。GitHub Actions `Repository checks / validate-docs` 对 PR #25 最新代码提交显示成功；该工作流只验证文档骨架，不等于 `npm test`。
- **未执行**：Windows 完整工作区 `npm test`、开发侧完整 `python scripts/check_repo.py`、远端官方 `tools/list` 真实检查（脚本仅离线模拟）、任何 `tools/call` 写请求、设备语音、部署、生产改动。S5 尚不可在真实 iWiki 写入。
- 先前初次文件暂存传输产生的两份不完整文本已修复；最终 GitHub 文件与本地测试版本哈希相同，前序暂存过程不作为验收证据。


## 2026-11-04 T-20261104-10 — S5-B 离线安全门禁开发侧测试
- **运行环境**：隔离 Linux Node.js `v22.16.0`（低于项目声明的 Windows Node `>=22.18`），独立临时工作目录；使用标准库假 `S5AtomicPort`，不连接真实 iWiki。
- **实际命令**：`node --experimental-strip-types --test .../tests/s5-guarded-write.test.ts` → **13 tests / 13 pass / 0 fail**。覆盖严格白名单、伪造确认拒绝、跨事务摘要不匹配、过期、无原子条件写门槛、无版本令牌拒写、成功后读回与同一事务重复提交、预写冲突、模糊远端结果不盲重试、读回不一致、拒绝、待处理容量限制、敏感错误脱敏和并发双提交。
- 新增 `src/write/guarded-write.ts`、`src/write/plan-write.ts`、`tests/s5-guarded-write.test.ts`、`tests/s5-plan-write.test.ts` 均通过 Node `--experimental-strip-types --check` 语法检查；`s5-plan-write.test.ts` **未在真实完整仓库执行**。
- **未执行**：完整仓库 `npm test`、`python scripts/check_repo.py`、Windows/设备验收、官方 iWiki 真实写入、真实版本冲突、可信用户确认 UI。仅证实 S5-B 离线安全门禁测试通过，不代表 S5 可生产写入。
- 没有修改 iWiki 文档、Windows 桥接/配置、Token、端口、防火墙、固件或云端提示词。


## 2026-11-04 T-20261104-09 — S4-D 自然语言设备语音最终验收（用户现场报告）

- **证据来源**：用户一次性提交验收结论，而非本代理抓取设备日志或独立重放；逐次原始调用轨迹、参数、延迟均未提交。结论注明 **用户现场报告**。
- 服务：官方 `iwiki` = 正常；新增 `musse_iwiki_readonly` = 正常（六工具可见）；用户明确报告“确认调用新增业务 MCP”。
- 自然语言验证：①任务数量 = 正常；②今日安排 = 正常；③近期及逾期任务 = 正常；④普通聊天 = 正常。这些场景测试未要求用户说工具名；不据简略结论编造各场景的确切响应内容或逐次工具名。
- 前序 Windows 终端结果：Node 22.23.2，三份指定离线检查 `10/10`；实际 `read_doc` 测试任务表 `total=3` / `todo=2` / `done=1` / `archived=0`；`--install` 前 `--smoke` 结果 `tools=6`，`write_blocked=true`；`S4D_BRIDGE_ENTRY_INSTALLED`、`ORIGINAL_IWIKI_PRESERVED`、`PRIVATE_BACKUP_CREATED`、`S4D_BRIDGE_ENTRY_PRESENT`。
- **结论**：S4-D **任务和日程的自然语言业务 MCP 语音链路按用户反馈验收通过**。**不代表**目标/笔记已真实联通（当前没有相关文档映射），不代表 S5 写入或官方 MCP 的远端服务端写权限已独立审计；未执行全量 `npm test` 或长期稳定性验证。
- 不记录私人页面 ID、Token、接入点或原始知识库数据，不修改真实 iWiki、固件、云端角色、Windows 补丁、防火墙、PR 合并状态。


## 2026-11-04 T-20261104-08 — S4-D Windows 本地业务 MCP 安装成功（用户终端证据）

- 用户在 Windows 真实目录执行 `git pull --ff-only`，成功从 `b0b0436` 快进至 `64002a9`，新增 `tools/s4d-bridge.mjs`。
- 用户执行 `node tools/s4d-bridge.mjs --install`，回报 `S4D_MCP_SMOKE_OK`、`tools=6`、`total=3`、`todo=2`、`done=1`、`write_blocked=true`、`S4D_BRIDGE_ENTRY_INSTALLED`、`ORIGINAL_IWIKI_PRESERVED`、`PRIVATE_BACKUP_CREATED`。说明本地 MCP 子进程协议与真实 iWiki 测试任务表读取通过，测试写入工具被只读白名单拒绝，脚本已写入新服务配置且备份了旧配置。
- 用户进一步执行 `node tools/s4d-bridge.mjs --status`，回报 `S4D_BRIDGE_ENTRY_PRESENT` 和 `ORIGINAL_IWIKI_PRESERVED`。**仍未获得重启后的 xiaozhi-client 两服务连接、六工具云端可见、设备语音调用证据，S4-D 不应标记全部验收完成**。
- 不保存或公开任何私有凭证、接入 URL、映射文档 ID 或原始配置内容。旧官方 iWiki 服务配置保留；若用户报告故障，应指导先停止桥接，`node tools/s4d-bridge.mjs --rollback` 后再启动。

## 2026-11-04 T-20261104-07 — 用户实际读 iWiki 成功 + S4-D 桥接脚本离线模拟

- **Windows 用户实测**：当前 `software/musse-iwiki` 工作区执行 `buildReadonlyTaskService(process.env)` 与 `service.listTasks()`；终端回传 `CONFIG_OK`、`READ_ONLY_OK`、`total=3`、`todo=2`、`done=1`、`archived=0`。说明实际 `read_doc` 访问、任务表解析和统计成功；未显示任务正文、Token 或真实页面 ID，未调用写入。
- **脚本制作和隔离验证**：新增 `tools/s4d-bridge.mjs`。在本地容器 Node v22.16.0（低于生产门槛，测试副本临时降低版本断言）、假凭证和模拟 MCP 子进程下分别运行 `--smoke`、`--install`、`--status`、`--rollback`，终端得到 `S4D_MCP_SMOKE_OK`、`tools=6`、`write_blocked=true`、`S4D_BRIDGE_ENTRY_INSTALLED`、`S4D_BRIDGE_ENTRY_REMOVED`；生产脚本未降低 Node>=22.18 检查。与正式分支脚本内容按 32 位 FNV 哈希比对一致（`613ef46d`）。仅为隔离模拟，**不代表 Windows 客户端实际接入成功**。
- **限制**：尚未验证 Windows `xiaozhi-client` 的新增服务热加载、工具同步、实际工具调用追踪、ESP32 语音或长期目标/笔记真实文档读取。不得把本阶段标记全通过，未恢复已取消的 S2-B 多文档人工验收。Windows 用户将自行运行脚本并回传脱敏摘要。

## 2026-11-04 T-20261104-06 — S4-D Windows 私有文档映射本地成功（用户回报）

- 用户在本机 PowerShell 的既有桥接目录新建 `musse-iwiki-readonly.json`，以不回显的输入方式填入其自己保存的 S2-A 测试任务表 `page-...` 文档 ID；终端显示 `MAPPING_CREATED`。
- 用户在仓库业务目录调用 `readonlyDocumentIdsFromFile` 检查映射文件，回传 `MAPPING_OK: task only`。说明文件可读取，任务表 ID 格式通过校验；**尚未进行真实 iWiki `read_doc`**，不能认定 ID 存在、读取权限有效或文档格式可解析。
- 未读取、记录或提交真实文档 ID、Token、iWiki 内容；未改动 Windows `xiaozhi.config.json`、日志补丁、防火墙、ESP32、云端或 PR 合并状态。
- 下一步已指导用户在本人 Windows 上执行仅 `read_doc` 的合计数量查询，仅回传 `CONFIG_OK`、`READ_ONLY_OK` 或 `READ_ONLY_FAILED` 及汇总计数；不得打印真实任务内容或泄露私有配置。未收到该真实查询的结果前，S4-D 保持未验收。

## 2026-11-04 T-20261104-05 — S4-D Windows 正式工作区离线测试（用户提供的终端回显）

- **证据来源**：用户在对话中逐行提供 Windows PowerShell 命令及输出；记录的是用户执行结果，不是 ChatGPT 自行在远程 Windows 运行。
- **环境**：Node `v22.23.2`；Git `2.54.0.windows.1`；Windows `C:\Users\HONOR`；分支 `feat/iwiki-s2a-readonly-contract`；短 SHA `b0b0436`。
- **原样命令**：`node --test tests/s4b-readonly.test.ts tests/s4c-readonly.test.ts tests/s4d-preflight.test.ts`。
- **用户终端结果**：`tests 10`、`pass 10`、`fail 0`、`cancelled 0`、`skipped 0`、`todo 0`；运行约 200.46 ms。
- **范围限制**：这次是完整 Git 工作区下的指定 10 项离线单测，未执行完整 `npm test`、真实 iWiki `read_doc`、桥接聚合或 ESP32 语音验收。没有新增或修改私人配置、固件或数据。
- **判断**：S4-D 进入私有映射与接入审查阶段，S4-B/C/D 三份预检测试按用户证据通过。不要将 S4-D 完整验收记为完成。

## 2026-11-04 T-20261104-04 — S4-D 接入前代码静态审查与待测项

- 对比仓库新增 MCP 协议入口与固定的上游 `xiaozhi-client v2.3.0`：上游 `src/mcp-core/transport-factory.ts` 支持 `stdio` `command/args/env`；`src/config/adapter.ts` 在服务配置转换中存在打印原始配置的路径，因此未来业务服务配置不得放置真实文档 ID、Token 等私人数据。
- 仓库代码修正：`readonly-protocol.ts` 对列表结果统一封装对象型 `structuredContent`；`document-ids.ts` 新增本机私有 JSON 映射读取，`server-readonly.ts` 默认从 Windows 用户目录读取桥接配置和映射，不自动执行任何真实连接。
- 新增 `tests/s4d-preflight.test.ts`，包含合成页面映射及 MCP 返回形状两个测试。**尚未实际运行完整仓库测试**，也未触碰真实 Windows、设备或账号。等待用户返回 Node 版本、功能分支提交哈希及三文件离线测试结果后补记；不得提前标记测试通过。

## 2026-11-04 T-20261104-03 — S4-C 六工具离线隔离测试（非真实 iWiki 验收）

- **范围**：仓库 S4-C 只读目标/笔记代码，没有触碰 Windows、用户 iWiki 数据、ESP32 或云端。测试使用合成页面 ID 和合成笔记。
- **实际环境**：隔离临时目录 `/mnt/data/musse-s4c-check`，Node v22.16.0，低于项目 Node>=22.18；原 MCP 工具定义及服务调用等依赖用隔离替身，新映射、工具白名单与笔记排序采用同构实现，替身未提交。
- **已运行**：`node --experimental-strip-types --test tests/s4c.test.ts`，**4/4 通过**：六只读工具且拒绝写入、目标/笔记分发和无效输入、显式 ID 映射安全校验、乱序笔记按时间及同分钟后缀排序。
- **已运行**：`node --experimental-strip-types --check` 对新增模块及测试语法检查通过。
- **没有执行**：正式仓库 `npm test`、`python scripts/check_repo.py`、Node>=22.18 运行、iWiki 真实读取、Windows MCP 集成、设备语音测试。不得将隔离测试误记为完整仓库回归通过，也不恢复用户已取消的 S2-B 人工验收。

## 2026-11-04 T-20261104-02 — S4-B 最小离线检查

- **范围**：新增四个任务/日程只读工具的白名单、MCP 请求派发、异常脱敏；没有真实 iWiki、Windows 桥接或设备访问。
- **环境**：隔离目录 Node v22.16.0（低于项目最低 22.18）；由于容器不能直接检出完整 GitHub 仓库，运行时为原 `tools.ts`/`types.ts` 提供临时测试替身，未提交这些替身。
- **已运行**：`node --experimental-strip-types --test tests/s4b-readonly.test.ts`，4/4 通过：只读工具列表、四种查询分发、拒写/非法参数、初始化/错误脱敏。
- **已运行**：`node --experimental-strip-types --check` 检查新增源文件和测试语法通过；`python -m json.tool package.json` 通过。
- **未运行**：完整仓库 `npm test`、`python scripts/check_repo.py`、Node>=22.18 原样测试、真实 iWiki 读取、Windows/语音验收。只报告实际检查结果，不重复 S2-A 或取消的 S2-B。

## 2026-11-04 T-20261104-01 — S3-A 配置变更与 S2-B 验收取消（用户陈述，非设备验收）

- **证据来源**：用户在对话中确认已经把 MuSSE 新角色提示词配置到小智控制台，并逐字给出当前采用的 `# Role: Muse` 版本，已归档到 [当前提示词](IWIKI_S3_PROMPT_CURRENT.md)。
- **用户反馈**：此前版本过于照搬角色介绍，缺少自然交流感；用户已选择减少模板化表达的新版本。**未回传新版语音效果对照、单次唤醒对话或 MCP 轨迹**，本条不判定人格优化已经真机验收通过。
- **范围调整**：用户明确取消 S2-B 三篇虚构文档、Windows 三文档探针和逐项设备语音验收。原 `probe-goal-notes.mjs` 与测试保留，不标记其真实验收通过。
- **后续计划**：用户确认 S5 受控语音写入为将来必做目标；S4 只读业务集成**尚处待审方案阶段**。本次未运行远端读取/写入、未调整 Windows 桥接或 ESP32 固件、未执行新的完整 Node.js 测试。
- **结论**：配置及需求变更已记录；仅为用户报告与文档归档，不构成新代码/设备端验收。

## 2026-11-03 T-20261103-14 — S2-B 设备端语音任务查询（用户反馈）

- **来源**：用户直接回复“可以。成功。继续”，对应此前要求 MuSSE 设备通过 iWiki 查询虚构任务表并回答总数、未完成、完成和逾期。
- **已确认**：用户报告设备语音查询成功；S2-A 之前的 Windows 任务解析汇总 3/2/1/1 已实测。
- **证据限制**：用户未提交本轮逐字语音回答、`search_kb/read_doc` 使用次数或脱敏 MCP 调用轨迹，因此仅记录“用户确认成功”，不能补造工具级审计或将本仓库自研业务服务标为已上线。
- **后续验收**：新增虚构目标和快捷笔记，先以 Windows 只读三文档检查目标 2 项/完成 1 项/进度 50%、笔记 2 条，再进行设备语音核对。见 [S2-B 验收手册](../software/musse-iwiki/docs/S2B_GOAL_NOTES_ACCEPTANCE.md)。


## 2026-11-03 T-20261103-13 — iWiki 真实测试任务表只读查询成功（用户 Windows 验收）

- **执行者/环境**：用户直接操作 Windows PowerShell，Node.js v22.23.2，`feat/iwiki-s2a-readonly-contract` 分支。
- **离线回归**：`node --test tests/official-iwiki-read.test.mjs tests/probe-task-queries.test.mjs` → **7 tests / 7 pass / 0 fail**。
- **实机读验证**：用户在自己的 iWiki **专用虚构任务表文档**上执行 `node tools/probe-task-queries.mjs --live`；输入正确测试文档 ID 并以 `YES` 显式确认。脱敏报告 `validatedTaskTable=true`，`remoteReadCalls=1`，`remoteWriteCalls=0`。
- **真实汇总数值**：总任务 **3**；未完成 **2**；已完成 **1**；已归档 **0**；当天到期 **0**；未来 7 天到期 **1**；逾期 **1**。完全符合预设虚构 Markdown 任务表。原始任务正文、私人 Token 及文档 ID 未加入仓库。
- **结论**：S2-A 业务只读验收通过（一次真实远程读取、程序内存解析和任务日期计算）。**仍未**进行 MuSSE 设备自然语言任务查询、业务 MCP 运行部署、正式账号数据管理、真实写入或服务端只读负向测试。不得以此报告代替 S2-B 设备语音证据。


## 2026-11-03 T-20261103-11 — 官方 iWiki 单文档 read_doc 实机响应结构

- **执行者/来源**：用户 Windows PowerShell，Node.js v22.23.2，手动选择自己新建的非敏感测试文档，在程序第二次交互中输入 `YES` 后执行**一次** `read_doc({doc_id})`。
- **离线检查**：`node --test tests/probe-read-structure.test.mjs` → 3/3 通过，0 失败。
- **用户回传的脱敏真实结果**：`success:true`；`structuredContent:"absent"`；仅一条文本内容块，经 JSON 解析字段 `ok:boolean`、`data.doc_id:string`、`data.title:string`、`data.content:string`。未回传正文、真实 ID 值或 Token。`success:true` 是本地探针的有限判断，不能证明内层 `ok === true`。
- **结论**：**实际只读文档调用与返回形状已确认**；Markdown 任务表格式、任务统计、真实语音业务调用仍待验证。

## 2026-11-03 T-20261103-12 — S2-A 业务读取适配器开发侧合成验证

- **代码**：新增 `src/store/official-iwiki-read.ts`，只允许显式文档 ID 映射的 `read_doc`，要求 `ok:true`、`data.doc_id` 匹配和 `data.content` 为字符串；任何写入/列表/未知映射直接拒绝，原始远端错误正文不向业务层冒泡。
- **测试环境**：开发侧隔离 Node.js v22.16.0，以 `--experimental-strip-types` 运行本适配器五项合成测试；5/5 通过，0 失败。注意 Node 22.16.0 默认不接受 TypeScript 扩展名，必须显式启用类型剥离；用户本机 Node.js v22.23.2 未运行此批。
- **待测**：`tests/probe-task-queries.test.mjs` 和 `tools/probe-task-queries.mjs --live` 已加入功能分支，但本轮尚未执行 Windows 实测；不得据此宣布真实待办/逾期查询可用。
- **未做**：未读取用户私人任务数据、未更改 iWiki 文档、未启动业务 MCP 服务、未开放写入、未变更原有 Windows 桥接或硬件。


## 2026-11-03 T-20261103-09 — S2-A Windows 真实查询工具发现验收

- **执行者/来源**：用户直接在 Windows PowerShell 执行并回传命令输出（不是 ChatGPT 远程执行）。
- **版本**：Node.js v22.23.2；已克隆功能分支 `feat/iwiki-s2a-readonly-contract`。
- **本机结果**：`node --test tests/inspect-readonly.test.mjs` → 3/3 通过；无参数检查器 → 只显示帮助；`node tools/inspect-readonly.mjs --live` → 返回脱敏工具摘要，工具总数 27，六个查询工具均存在，字段和必填项详见 [S2-A 文档](../software/musse-iwiki/docs/S2A_READONLY_HANDOFF.md)。
- **不等于**：实际调用 `read_doc` 成功、服务端拒绝写入、任务业务完成、语音任务查询完成。无私人文档/空间内容/令牌入库。
- **结论**：**S2-A 工具发现与 schema 输入字段验收通过**；业务读响应契约仍待核验。

## 2026-11-03 T-20261103-10 — 单文档只读形状检查器离线测试

- **测试环境**：隔离 Node.js v22.16.0，完全合成的 MCP 结果与文档字符串。
- **运行**：`node --test tests/inspect-readonly.test.mjs tests/probe-read-structure.test.mjs` → **6/6 通过**（其中新加 3 项）。默认无 `--live` 的形状检查器仅输出帮助。
- **验证**：不输出正文及任意敏感字段值；MCP 错误不输出原文；只允许显式给定 `doc_id` 或 `doc_path`，且仅调用一次 `read_doc`。
- **局限**：没有在用户 Windows 上执行真实 `read_doc`；历史 29 项 TypeScript 业务测试本轮未重新运行。


## 2026-11-03 S2-A 只读工具契约检查草案（开发验证，不是 iWiki 实机测试）

### T-20261103-08 — 查询工具摘要器离线验证

- **测试环境**：隔离 Node.js v22.16.0，运行新增 `tests/inspect-readonly.test.mjs`（使用完全虚构的 Token 和工具数据）。
- **结果**：3 tests / 3 pass / 0 fail；验证固定官方端点与鉴权头检查、报告不输出工具描述/示例/非查询工具、只调用 `listTools` 而不调用 `callTool`。
- **边界**：这是开发侧离线测试，不是用户 Windows 上的真实远程 MCP 调用。本批未重新执行历史 29 项业务测试，也未验证真实 Token 权限、文档读取、用户任务查询或长期稳定性。
- **结论**：**通过（新增离线检查器三项测试）**；S2-A 真正的工具契约与读操作验收仍待完成。细则见 [S2-A 文档](../software/musse-iwiki/docs/S2A_READONLY_HANDOFF.md)。


## 2026-11-03 最新验收：小智云端—Windows 本地桥接—iWiki 语音查询

### T-20261103-05 — Windows MCP 桥接启动、小智云端连通

- **证据**：用户回传 Windows PowerShell 原始输出、浏览器本地看板截图；敏感接入点 URL 已省略。
- **本机**：Node.js `v22.23.2`、npm `10.9.8`；`xiaozhi-client@2.3.0` 初次安装 `@discordjs/opus` 时远程预编译下载 `ETIMEDOUT`，回退构建缺少 Visual Studio C++ 工具。用户执行 `npm install -g xiaozhi-client@2.3.0 --ignore-scripts` 后安装成功、`xiaozhi --help` 正常，随后本地 `xiaozhi start` 能打开 `http://localhost:9999/dashboard`。这仅验证作为 MCP 桥接使用，跳过依赖脚本并不保证客户端自有音频功能。
- **网络**：Windows 防火墙已建立 `MuSSE MCP - Block Inbound 9999` 的 TCP 入站阻止规则（Any/True/Block）；用户报告本机 `127.0.0.1:9999` 可正常访问。服务仍监听 `0.0.0.0:9999`，应保留防火墙规则。
- **协议**：真实小智 MCP WebSocket 连接建立，日志显示端点连接 `1/1`、MCP 初始化、未加载 iWiki 时工具 `0`。本次未触碰 ESP32 固件。
- **结论**：**通过（Windows MCP 启动及小智云端接入）**。

### T-20261103-06 — 本地令牌日志泄露发现及定向修补

- **证据**：用户提供假 Token 复测前后的终端日志；不上传完整日志。
- **首次假 Token**：iWiki `Authorization` 的假令牌原样出现在 `转换配置` 日志，检查结果 `IWikiTokenLeaked=True`；小智接入点的完整假令牌 `False`（但日志仍含部分脱敏片段）。
- **修补**：用户通过受限匹配脚本修改全局 npm 安装包 `dist/backend/WebServer.js` 和 `dist/backend/WebServerLauncher.js` 各 1 处，将打印整个 `config` 对象的 `console.log` 改为不包含配置的固定消息；两份原文件均在本地备份为 `.musse-original.bak`。
- **复测**：假 Token 再次启动，日志呈现 `MCP config converted [details redacted]`；`mcp-canary-retest.log` 中 `XiaoZhiTokenLeaked=False` 且 `IWikiTokenLeaked=False`。预期的 `127.0.0.1:9` 连接拒绝不是 MCP 故障。用户恢复了真实配置前的备份。
- **局限**：仅验证所测运行路径，不构成全局安全审计；更新/重装依赖可覆盖补丁，未验证权限 Token 的服务端拒写。
- **结论**：**通过（已发现的完整令牌泄露点修补与假令牌复测）**。

### T-20261103-07 — 真实 iWiki 服务读取与 MuSSE 语音查询

- **证据**：用户提供 iWiki 工具三页截图、`list_spaces` 实际测试结果截图，并回复“成功”确认设备语音查询。
- **服务**：本地看板显示小智接入点 1 个、iWiki MCP `1/1`，约 27 个工具发现成功，含 `search_kb`、`read_doc`、`list_spaces`、`list_docs`。工具列表含写入项，UI 开关后续最终状态未单独截图验收。
- **真实读取**：用户在本地管理 UI 直接调用 `list_spaces`，返回 `ok: true`，说明有 41 个当前账号可访问的空间；公开文档不记空间 ID、名称或个人内容。
- **端到端**：用户随后确认 ESP32-S3 的 MuSSE 语音查询 iWiki 成功；未提供可公开逐条对应的设备请求/工具调用追踪。因此标记为**用户实测成功报告**，不伪称由仓库独立审计完整云端调用日志。
- **结论**：**通过（本地真实查询有截图、设备语音成功由用户确认）**。本次没有对 iWiki 执行写入，也没有测试 `software/musse-iwiki/` 第一批任务/目标业务层的远程操作。


## 2026-11-03 最新进展：启动故障恢复报告（历史故障详情仍保留）

### T-20261103-04 — COM7 启动异常恢复及模块配置状态（用户口头报告）

- **证据等级**：用户本人在对话中明确表示“已经好了。目前的模块都配置好了”；本轮未提供恢复操作过程、复位后串口启动日志、照片或逐项功能测试结果。
- **事实**：此前反复 `DOWNLOAD(USB/UART0)` 的故障，用户报告已排除，恢复正常联调；现有模块已配置。故障根因、是否执行裸板对照、实际改动的接线/按钮/USB 状态**未明确**，不得将“GPIO0 被外设拉低”当成已证实根因。
- **未验收**：OLED 显示/麦克风采音/功放与扬声器播放/按键操作/供电稳定性，均缺少本轮独立证据。没有新的固件烧录、eFuse 变更或 Flash 备份报告。
- **联网与账号**：向用户说明了小智 `v2.5.2/bread-compact-wifi` 手机热点配网、2.4GHz Wi-Fi、联网获取激活信息、`xiaozhi.me` 账号下绑定 MuSSE 智能体的参考步骤。这属于**指导**，不是已执行的测试；没有收到 Wi-Fi 成功、设备绑定成功或语音端到端闭环成功的回报。
- **结论**：启动模式故障状态按用户报告改为“**已恢复（根因未记录）**”；模块配置为“**用户报告完成，逐项验收待确认**”；网络绑定及语音闭环为“**待确认**”。后续以用户实际回传为准，不重复已有失败步骤或盲目重刷。


## 2026-11-03 新到货 ESP32-S3（COM7）首次烧录与当前故障

### T-20261103-01 — 新主板 COM7 识别与只读 Flash 信息

- **证据等级**：用户本人回传 Windows 设备管理器截图和 PowerShell 原始输出；公开归档不保存 MAC/唯一标识。
- **硬件**：新 `YD-ESP32-23 2022-V1.3`、ESP32-S3 N16R8；与此前 CH343/COM6 旧板不同。FT232R 驱动安装后呈 `USB Serial Port (COM7)`。
- **命令**：`python -m esptool --chip esp32s3 -p COM7 flash-id`（esptool v5.6.0）。
- **结果**：连接成功，ESP32-S3 rev v0.2、40MHz 晶振、16MB Quad Flash、3.3V Flash、识别信息包含 8MB PSRAM。只读过程正常结束；此项不证明 PSRAM 运行时压力稳定性。
- **结论**：**通过（串口和 Flash 识别）**。

### T-20261103-02 — 小智 v2.5.2 新板首次烧录（Reasonix 报告）

- **证据等级**：用户转交的 Reasonix CLI Windows 本地执行报告；ChatGPT 未直接读取原始二进制与原机串口日志。
- **本地源码/构建**：`C:\Users\Lenovo\MuSSE-Lab\xiaozhi-esp32-v2.5.2`；`78/xiaozhi-esp32` tag `v2.5.2`、commit `49b4380`，`BREAD_COMPACT_WIFI`；ESP-IDF v6.1.0，ESP32-S3 / DIO / 80MHz / 16MB，Octal 8MB PSRAM。复用既有构建，未重建；有记录的 4 个文件 SHA-256 被报告与旧构建记录一致。
- **写入**：COM7 / 460800，`write-flash --flash-mode dio --flash-freq 80m --flash-size 16MB`；bootloader `0x0`、partition table `0x8000`、OTA data `0xD000`、应用 `0x20000`、assets `0x800000`。五个文件均 `Hash of data verified`，退出码 0。
- **用户授权边界**：明确跳过原厂 Flash 备份；无全片擦除、eFuse 修改。**新板无原厂备份，不能承诺恢复原厂程序。**
- **烧录后启动日志（Reasonix 报告）**：应用 2.5.2、PSRAM 8MB/80MHz、SKU `bread-compact-wifi`、MCP 工具注册、`starting -> wifi_configuring`，SoftAP 配网服务启动。OLED 当时未接，日志有 `i2c transaction failed` / `Failed to initialize display`；固件继续运行。
- **本地脱敏材料（未入仓库）**：`C:\Users\Lenovo\MuSSE-Lab\reports\XIAOZHI_V252_FLASH_COM7_20261103.md`、`xiaozhi_v252_com7_boot_20261103.log`。
- **结论**：**烧录校验通过、曾从 Flash 启动小智进入配网（按 Reasonix 报告）；未验证 OLED/音频/云端绑定/语音闭环**。

### T-20261103-03 — 外设接入后 ROM 下载模式异常（仍未解决）

- **证据等级**：用户本人在对话中多次回传 PowerShell 终端原始输出。
- **前提**：用户表示 OLED、INMP441、功放和扬声器已装好、接好；实际引脚连接未经独立逐项核验。后续曾按建议检查 BOOT 和尝试断开外设，但最后一次是否已彻底脱离面包板、所有外设全部断开的状态**没有独立证据，不应写成“裸板故障已确证”**。
- **命令**：`python -m serial.tools.miniterm COM7 115200`，随后 `python -m serial.tools.miniterm COM7 115200 --dtr 0 --rts 0`；后者输出 `forcing DTR inactive` / `forcing RTS inactive`。
- **实际日志（多次）**：
  ```text
  ESP-ROM:esp32s3-20210327
  rst:0x1 (POWERON),boot:0x0 (DOWNLOAD(USB/UART0))
  waiting for download
  ```
- **附加用户观察**：仅把线改插开发板原生 `USB` 端口独立供电时，手机未搜索到 Xiaozhi 热点；未获取该次原生 USB 启动日志，因此“无热点”不直接证明 Flash 镜像损坏。
- **分析**：ROM 下载模式发生在应用执行前；常见条件为复位期间 GPIO0 被保持低电平，可能与 BOOT 按钮、外设/面包板接线、自动下载电路等有关。尚无 GPIO0 实测电压（用户无万用表）；**不能据此判定板坏、也不能判定烧错固件**。上游 `bread-compact-wifi` 是固件板型配置；`Espressif` 是芯片厂商，两者没有名称冲突。
- **结论**：**未通过正常启动 / 根因未定位**。优先在断电、外设完全隔离且只保留单 USB 的前提下核实启动条件；若确实裸板复现，查 `YD-ESP32-23` 的 BOOT/GPIO0/FT232R 自动下载电路与原理图，必要时借万用表。禁止直接把 GPIO0 短接 3V3、禁止无依据重复烧录/全擦。
- **关联状态**：最新权威进度见 [STATUS](STATUS.md)，交接见 [HANDOFF](HANDOFF.md)。

> 本文区分**用户亲自执行并回传终端输出**和**Reasonix CLI 在另一台 Windows 电脑执行后转述的报告**。后者未由仓库维护方访问原机或独立复验二进制文件。以下记录不等于板上应用运行成功，且不含 MAC、密钥等唯一标识。

## 使用方法

每次上电、USB 识别、烧录、接线或功能验证，复制下方模板新增一条。私密数据和带设备唯一标识的截图要脱敏。

### T-YYYYMMDD-01 — 测试名称（模板）

- 日期 / 测试人员：
- 开发板完整型号 / PCB 修订：
- 模块/供电/接线情况：
- 固件版本、下载链接及文件 SHA256（如相关）：
- 环境（Windows 版本、驱动、工具版本）：
- 预期：
- 实际步骤：
- 实际结果：
- 结论：通过 / 失败 / 未完成
- 脱敏日志或证据链接：
- 后续处理 / GitHub Issue：

## 已执行与已报告的测试（2026-11-02）

### T-20261102-01 — CH343 USB 串口插拔对照

- 执行者 / 证据级别：用户亲自操作并在对话中确认；原仓库已有设备管理器截图，插拔对照无独立录屏。
- 设备：ESP32-S3-N16R8；仅 USB 连接开发板，未接外设；PCB 修订/USB-C 端口功能未全部核实。
- 步骤与结果：Windows 显示 `USB-Enhanced-SERIAL CH343 (COM6)`；拔线后串口消失，插回后恢复。
- 结论：**通过 USB 串口识别与插拔对应检查**；不能仅凭此证明固件运行。
- Issue：[M0-02 #2](https://github.com/Qi0331/MuSSE/issues/2)；待完善正式验收记录。

### T-20261102-02 — ESP32-S3 芯片只读通信 / Flash ID

- 执行者 / 证据级别：**用户亲自执行**并将终端输出发到对话；此处为脱敏摘录。
- 工具：Python 3.14.3、esptool 5.6.0、COM6，波特率 115200。
- 命令：`py -3 -m esptool --chip esp32s3 --port COM6 --baud 115200 --no-stub flash-id`
- 实际输出：`Connected to ESP32-S3 on COM6`；`ESP32-S3 (QFN56) revision v0.2`；40MHz 晶振；`Detected flash size: 16MB`；Flash eFuse 类型 quad、工作电压 3.3V。工具还报告 `Embedded PSRAM 8MB (AP_3v3)`。
- 结论：**芯片通信与 Flash ID 读取成功**；PSRAM 容量是识别信息，**尚无内存读写实测**。
- 影响：工具提示 `Hard resetting via RTS pin`；未执行写入或擦除。
- Issue：[M0-02 #2](https://github.com/Qi0331/MuSSE/issues/2)。

### T-20261102-03 — Windows ESP-IDF 工具链配置

- 执行者 / 证据级别：**Reasonix CLI 本地执行报告**，未取得独立机器复测。
- EIM 0.20.1（官方 WinGet 包 `Espressif.eim`），安装位置 `C:\Program Files\eim\eim.exe`。
- ESP-IDF v6.1 正式版，目录 `C:\esp\v6.1\esp-idf`，工具目录 `C:\Espressif\tools`；使用 PowerShell 激活脚本 `C:\Espressif\tools\Microsoft.v6.1.PowerShell_profile.ps1`。
- 实际报告：`idf.py --version` 返回 `ESP-IDF v6.1`（退出码 0）；支持 `esp32s3`；Xtensa GCC 15.2.0、CMake 4.0.3、Ninja 1.12.1、Python venv 3.14.3；`python -m pip check` 无损坏依赖。
- 备注：Git Bash/MSYS 不适用于本环境中的 `idf.py`；Unicode 提示通过当前 PowerShell 会话临时 `PYTHONUTF8=1` 处理；均未刷写设备。
- 结论：**开发环境可在本机调用（按 Reasonix 报告）**；不等于固件已经运行。
- Issue：[M0-04 #10](https://github.com/Qi0331/MuSSE/issues/10)。

### T-20261102-04 — ESP-IDF 官方 Hello World 首次编译

- 执行者 / 证据级别：**Reasonix CLI 本地执行报告**。
- 工程：Windows 本地 `C:\Users\Lenovo\MuSSE-Lab\hello_world`，复制自 ESP-IDF v6.1 的 `examples/get-started/hello_world`，未纳入 Git 仓库。
- 命令：`idf.py set-target esp32s3`、`idf.py build`；均退出码 0，报告 `Project build complete`。
- 初次配置：2MB / DIO / 80MHz，默认 1MB 单应用分区；PSRAM 未启用。首次固件生成成功，**但这是本机编译，不是板上运行**。
- Issue：[M0-04 #10](https://github.com/Qi0331/MuSSE/issues/10)。

### T-20261102-05 — Flash 16MB / DIO / 40MHz 配置后重新编译

- 执行者 / 证据级别：**Reasonix CLI 本地执行报告**。
- 配置更改：在 `sdkconfig` 中将 Flash 从 2MB 改为 16MB、频率从 80MHz 改为 40MHz，保留 DIO；保留 Single App 默认 1MB 应用分区，PSRAM 未启用；修改前备份 `sdkconfig.bak-2mb-80m`。
- 执行：`idf.py build` 退出码 0；报告 `Project build complete`；`esptool image-info` 检查应用/bootloader：ESP32-S3、16MB、DIO、40MHz，checksum 与 validation hash 均有效；`build/flash_args` 与镜像头一致。
- 本地构建产物（尚未提交，文件 SHA-256 来自 Reasonix 报告）：
  - `build/hello_world.bin`：150720 字节，SHA-256 `af00395581730beb261aa57bdf9cdd944613339c3f9931729206aca79fa57a1b`
  - `build/hello_world.elf`：3177076 字节，SHA-256 `ff154e234eadfc178e5c1c506638dc84d44342a3dde638f1f74b80e124a19b6c`
  - `build/bootloader/bootloader.bin`：21120 字节，SHA-256 `b9b0086932ad1d5c4705178dd1374824e287d6ce07105993bf3dcbbf24e0b5c9`
  - `build/partition_table/partition-table.bin`：3072 字节，SHA-256 `7f00b6c042a89b15b0cac534f82ed988caf29278ff5700b0c511eb1b5bb7c820`
- 结论：**本地构建通过（按报告）**，未开展板上运行测试；尚未读取安全状态、备份 Flash、烧录或擦除。
- Issue：[M0-04 #10](https://github.com/Qi0331/MuSSE/issues/10)。

## 下一步未完成测试

1. 只读执行 esptool `get-security-info`，明确 Secure Boot / Flash Encryption 等可获取状态；**当前未执行**。
2. 决定是否及如何本地备份出厂固件；备份不得上传公共仓库。
3. 单独授权后再进行首次 Hello World 烧录、串口启动日志与按钮实验。
4. 完成开发板 PCB/USB-C 端口、GPIO、LED 5V 上拉电平和供电验证；LED 未核验前严禁接线。


## M0 后续真实执行报告（2026-11-02；本节均为用户转交的 Reasonix CLI 本地报告）

### T-20261102-06 — ESP32-S3 安全状态只读检查

- 环境：CH343 COM6、esptool v5.6.0，`--chip esp32s3 --port COM6 --baud 115200 --no-stub get-security-info`。
- 实际报告：退出码 0；`Flags: 0x00000000`、`Secure Boot: Disabled`、`Flash Encryption: Disabled`、`SPI_BOOT_CRYPT_CNT: 0x0`。
- 结论：**只读通信成功，未发现这两项机制限制首次写入**；不等于所有 eFuse 位均已单独审计。未烧录、未擦除、未改 eFuse。

### T-20261102-07 — 首次烧录前完整 Flash 本地备份与离线识别

- 工具：esptool v5.6.0，COM6，`read-flash 0 0x1000000`；本地 16 MiB 备份文件 `esp32s3_factory_20261102.bin`；**原始文件不得进入 Public 仓库**。
- 原始执行记录：`Read 16777216 bytes from 0x00000000 in 414.2 seconds`，退出码 0；文件大小 16,777,216 字节；SHA-256 `cd0f30ac9491da499eaf2167f07b5accf23cf6779c506110431aa766f346273e`。
- 仅对备份离线解析：非空白区域出现 bootloader 0x0、分区表 0x8000 和应用 0x10000；原应用项目名 `led_strip`、构建时间 2021-08-17、ESP-IDF v4.4-dev、镜像头 2MB/DIO/80MHz，分区 `nvs` 0x9000 24 KiB、`phy_init` 0xF000 4 KiB、`factory` 0x10000 1 MiB。
- 结论：备份成功（报告）、离线发现有原始示例程序；**没有声称原厂程序曾经运行成功**。

### T-20261102-08 — 首次授权 Hello World 烧录、串口运行与自动重启

- 用户已明确授权覆盖原 `led_strip`，禁止整片擦除、eFuse 修改及接外设；先复核本地备份和三个镜像哈希与旧记录一致。
- 配置：ESP-IDF v6.1；16MB/DIO/40MHz、Single App 1MiB，PSRAM 关闭。以 esptool `write-flash` 定点写入三个镜像：bootloader `0x0`（21,120 字节）、partition table `0x8000`（3,072 字节）、`hello_world.bin` `0x10000`（150,720 字节）。
- 实际写入报告：三个镜像分别出现 `Hash of data verified`，`FLASH_EXIT=0`；只发生目标写入扇区自动擦除，没有 `erase-flash`。
- 运行：通过 CH343 COM6 以 115200 波特率使用 pyserial 采集约 45 秒。观察到 `ESP-IDF v6.1 2nd stage bootloader`、`Loaded app from partition at offset 0x10000`、`Project name: hello_world`、`Hello world!` 和 10 秒倒计时；共 5 次启动、5 次 `Hello world!`、4 次 `Restarting now.`，后续 `rst:0xc (RTC_SW_CPU_RST)`，未见 panic/Guru Meditation。
- 结果：**首次烧录、真实应用运行、自动重启均通过（Reasonix 本地报告）**。原厂 `led_strip` 已覆盖，原始备份仍在本地并再次校验一致；串口复位边界存在短暂乱码，未影响后续启动。
- 本地私有日志：`MuSSE-Private-Backups/logs/flash_20261102.log` 和 `hello_world_monitor_20261102.log`；未上传。该设备未做 PSRAM 读写测试。

### T-20261102-09 — 独立 GPIO/按钮实验工程本地编译

- 工程位置：`MuSSE-Lab/gpio_button`；ESP-IDF v6.1，`idf.py set-target esp32s3`、`idf.py build` 均退出码 0。
- 实现：可选低电平有效按钮、内部上拉、10 ms 采样/约 30 ms 消抖，稳定变化打印 `BUTTON_PRESSED/RELEASED`；可选 GPIO 输出测试。**当前两个选项都关闭**，镜像不含按钮/输出测试字符串。
- 当前构建 `gpio_button.bin`：170,352 字节，SHA-256 `902b60123a083e76b20cbe47d81a168e306f63732e563139205950c1cd2c5714`。
- 结论：**本地编译通过，不等于 GPIO/按钮真机验证**；具体开发板引脚、BOOT 对应 GPIO0 尚未实物核对。本轮未烧录/未接线。

### T-20261102-10 — 上游小智 v2.5.2 `bread-compact-wifi` 本地构建

- 本地目录：`MuSSE-Lab/xiaozhi-esp32-v2.5.2`；tag `v2.5.2`、commit `49b4380b3faa0ceadd28a3e78aaf0f311c46c57e`、MIT，Reasonix 报告 `git status` 干净。
- ESP-IDF v6.1 PowerShell 环境执行 `python scripts/build.py bread-compact-wifi --name bread-compact-wifi`，退出码 0；默认板型 `esp32s3`、16MB/DIO/80MHz、Octal PSRAM 80MHz、CPU 240MHz，OTA/asset 复合分区。
- 主要镜像：`xiaozhi.bin` 2,577,504 字节，SHA-256 `3c77df039b71f03de25dca21bcd49d91fe8bf591ff7fd8259685feb1d94c7e12`；另生成 bootloader、分区表、OTA 数据、`generated_assets.bin`（561,011 字节）。
- 烧录地址由本地 `flash_args` 报告：bootloader `0x0`、partition table `0x8000`、`ota_data_initial.bin` `0xD000`、`xiaozhi.bin` `0x20000`、`generated_assets.bin` `0x800000`。
- 上游依赖：I²S 麦克风/功放、SSD1306 OLED、网络/云端配网/绑定；板型参考 GPIO 和应用状态机经过源码静态分析，见 [UPSTREAM](UPSTREAM.md)。
- 结论：**上游本地构建成功，但从未烧录、没有 PSRAM 或语音真机测试**。不要将该构建当作 MuSSE 集成固件或设备已兼容的证据。本地报告路径 `MuSSE-Lab/reports/xiaozhi-v2.5.2-analysis.md`，未上传。

### 记录边界

以上数据为用户转交的本地执行报告；除此前由用户自行提供的最初芯片通信以外，仓库维护方未直接复核该 PC 的完整原始日志/文件。Reasonix 末尾的“有未验证的改动”据其说明是执行环境的审计状态提示，非经确认的 Git 文件修改，不据此推断项目源码受污染。

### T-20261102-11 — 小智控制台 2.0 的人工界面观察（**非设备测试**）

- **证据来源**：用户 2026-11-02 发送的网页截图；未调用私有 API、未独立登录用户账户；截图本身未上传 Public 仓库。
- **可观察结果**：MuSSE 智能体“未绑定”、0 台设备；小智 Lite；记忆开关已启用但 0 条；知识库内测中创建空白测试库、0 文档且智能体选择“不使用知识库”；天气/笑话/音乐/新闻/知识库服务选中；自定义 MCP 接入点可见、状态“加载中”；云端固件编译暂无记录。
- **结论**：只确认**界面存在相关入口**，不构成设备绑定、记忆效果、知识库检索、MCP 工具连接或云编译完成的测试结果。未执行硬件操作，未产生新固件。
- **安全**：接入点实际 token 和个人页面截图未公开，详见 [平台能力调研](XIAOZHI_PLATFORM.md)。

### T-20261102-12 — M1 离线显示核心源码归档与独立测试（非设备验证）

- **输入**：用户上传 Reasonix 第三版 `musse-display-m1-review(2).zip`，包含 16×16 核心、集成补丁、脱敏证据、预览生成器与测试；原始审核记录详见 `software/musse-display/reports/FINAL_REPORT.md`。
- **本机复核**：ChatGPT 读取并整理实际源码，在 Linux 环境运行 CMake/Ninja 构建和 `ctest --output-on-failure`，返回 CTest 2/2 通过。此前独立审核复现 93/93 单测及 ASan/UBSan 检查。
- **Reasonix Windows 证据**：93 项单测、CTest 2/2，ESP-IDF v6.1 隔离构建成功，相关 ELF 符号/链接摘要记录于 `software/musse-display/evidence/`。原始 Windows 主机与目标 ELF 并未由 ChatGPT 直接访问；不能把报告等同独立复核所有固件目标产物。
- **归档**：`software/musse-display/`，仅保留源码、测试、预览工具、补丁、报告和脱敏证据；不含真实硬件驱动配置、用户私有文件或固件镜像。
- **结论**：M1 软件功能达到实验性归档标准，**未烧录、未接线、未完成语音/LED 真机验证**。
