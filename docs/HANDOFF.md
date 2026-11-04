# MuSSE 最新交接（持续更新）
## 2026-11-04 S5-F 真实写能力最终通过（最新交接）
- **已实证完成**：Windows 独立 S5 worktree `e1f30fc`，Node 本地测试 **128/128 全绿**；此前 `create_markdown_doc` 业务 `ok:true` 并读回初始正文；本轮 `probe:s5-existing-edit -- --edit-once` 只读定位唯一旧测试页并在用户本机二次输入 `EDIT` 后，**`edit_doc ok:true` 且写后 `readback:UPDATED` / `EXISTING_EDIT_VERIFIED`**。返回 `new_rev_no/old_chars/new_chars`，确认服务端有修订元数据。
- 私人测试页标题 `MuSSE S5-F 自动隔离测试 8a6fc40f`；已经成功更新，不再运行原始 marker 要求的探针，也不要创建另一篇测试页。没有任何 Token、空间 ID、私人页面 ID 或正文泄漏到仓库。
- **当前阻塞已解除**：官方工具的真实 `create_markdown_doc`、`read_doc`、`edit_doc` 基本能力均已验证。首次编辑业务 `ok:false` 的原因未查明，不能猜。S5-E 现成最佳努力（best effort）写适配器使用 `edit_doc + doc_id + content` 及成功包络、写前比对、二轮语音确认、写后核验；开发阶段可按真实响应完善测试，不要再做无谓实际试写。
- **尚未完成**：生产任务文档的单独授权/映射确认、S5 写 MCP 安全部署与语音链路端到端验证。S5 入口默认禁用，Windows 桥接和现有 S4 双 MCP、Token、ESP32 未动，PR #25 继续 Draft；不得擅自上线或改真实任务表。权威状态见 `docs/STATUS.md`，实际证据见 `docs/TEST_LOG.md` T-20261104-22。


## 2026-11-04 S5-F 已有测试文档编辑复测交接
- 最新官方 `edit_doc` 描述已确认：`content` 为完整 Markdown，`doc_id` 指定目标，三路合并、需要编辑权限。用户第一次真实 edit 返回业务 `ok:false`，后续读回未变化；不能推断缺写权限。
- 已开发 `npm run probe:s5-existing-edit -- --edit-once`，只读 list_spaces → 指定私人空间 list_docs → **完全匹配固定测试标题** `MuSSE S5-F 自动隔离测试 8a6fc40f` → read_doc 确认原始 marker → 本机输入 `EDIT` 才尝试一次 edit_doc → read_doc；服务端错误只输出分类，不打印原始值和私有 ID。
- 此脚本不会运行 `create_markdown_doc`，不会写生产任务表，拒绝目标不唯一或内容不匹配的情况。需要先通过完整离线测试再使用，禁止循环重试。PR #25 仍 Draft，原 S4 环境不动。

## 2026-11-04 S5-F 成功创建 + 编辑拒绝交接
- 用户 Windows 本机 `list_spaces` 选 3 进行一次隔离测试：`create_markdown_doc` 业务 `ok:true`，新页面 `read_doc` 校验通过；`edit_doc` 业务 `ok:false` 且 `data.error` 未披露，最终 `readback:UNCHANGED`、`outcome:EDIT_UNCONFIRMED`。不能宣称写入编辑成功，也不能将 `editCallFailed:false` 理解为成功。
- 唯一已创建测试页标题：`MuSSE S5-F 自动隔离测试 8a6fc40f`。禁止原样再次执行 `probe:s5-auto`，否则另建测试页；以后优先复用此页，先读前置 marker，仍不猜私人 page ID。
- S5 分支新增只读 `npm run inspect:s5-edit -- --live` 用于读取 `edit_doc`、`append_to_doc` 与 `list_docs/search_kb/list_doc_tree` 工具约束。基于此决定最小调整，不扩大生产授权，保持 PR Draft、不碰 S4/Token/ESP32。

## 2026-11-04 S5-F 下一步：本机只读列空间后选择
- 用户不能确认 iWiki 私人空间名称；现有提示符中先按 Ctrl+C（没有发写请求）。GitHub S5 自动探针改为先只读 `list_spaces`，仅在用户 Windows 本机显示空间名供编号选择，绝不自动选公共/团队空间；输入 0 取消，未知返回结构停止。新建只限选定的私人测试空间。见 `docs/IWIKI_S5F_DISCOVERY.md`。

## 2026-11-04 S5-F Windows 测试失败及修复交接（最新）
- 用户已经在 Windows S5 worktree 跑 `npm test`：**115 total / 113 pass / 2 fail**，没有执行真实创建或编辑；错误片段明确证明 #58 是 `new URL(...).pathname` 在 Windows 下产生错误 Node 路径，#90 是 `updateTaskRow` 无条件把 CRLF 替换为 LF，破坏无关行原样保持。
- S5 GitHub 分支已修复 #58 用 `fileURLToPath`，修复 #90 保留原文每个 CRLF/LF 分隔符，并加跨平台数据保真单测。**先确认最新全部测试通过再做真实写入**，不要无条件重复 `--create-and-write-test`。
- 若通过，用户本机运行时会交互询问确切目标空间名，创建一篇全新合成文档、读回、一次编辑、读回；只有成功响应中确认唯一 `page-...` 才允许编辑。S4 双 MCP、Token、私有映射与生产配置不动。


## 2026-11-04 S5-F 修正创建目标空间（最新）
- Windows 已用仅 `tools/list` 的 `npm run inspect:s5-create -- --live` 确认：`create_markdown_doc` 的业务说明强制提供 `space_id` 或 `space_name`（二选一），但 JSON schema 的 `required` 只有标题与正文。无需继续猜缺失原因。
- GitHub S5-F 探针已更正：执行 `npm run probe:s5-auto -- --create-and-write-test` 时在 Windows 私下输入**一个确切空间名称**；请求只多传 `space_name`，不把名称打印在脱敏结果里。仅限新建测试页、一次 edit、写后读回；已知失败不能盲重跑。
- 尚无该修正后的 Windows 真实写入证据。原 S4 桥接、私有配置、生产 Token、Muse 人设、ESP32 和 Draft PR 均不动。

## 2026-11-04 S5-F 创建业务拒绝后的最新交接
- Windows 已通过 `git -c http.version=HTTP/1.1 fetch` 将独立 S5 worktree 成功更新至 `7aa98f0`。用户仅一次真正调用 `create_markdown_doc`；MCP 通信正常但业务结果 `ok:false`，`data` 有 `error/reason/expected` 字段（值未输出）。没有成功解析唯一页面 ID，`edit_doc` 未调用、写入成功未证实。
- 当前阻塞是**官方创建工具的业务前置条件**（具体错误尚未知），不要再建议立刻重复 `--create-and-write-test`，也不要直接调高只读 Token 权限。新增仅读取 `tools/list` 的 `npm run inspect:s5-create -- --live`，查相关官方工具及空间字段元数据，等用户本机脱敏结果后再决定下一次最小实际调用。
- 不改用户 S4 桥接、Token/私有映射、Muse 角色、ESP32 或现有文档。PR #24/#25 仍 Draft。


- **最新自动化证据**：新增自动创建探针后完整 Node CI `112/112` 通过（run `41799562069`），文档检查成功（run `41799562141`）。只说明离线模拟通过。
- **新优先入口（S5-F 自动测试）**：用户希望程序直接通过 `create_markdown_doc` 创建测试文档、再使用 `edit_doc` 更新，因此新增 `npm run probe:s5-auto -- --create-and-write-test`。它只使用原有私有连接，自动创建一篇合成隔离页，收到明确成功与唯一 ID 才读页、改一次并复读；不要求手工创建页面或提供私人 page ID。若服务端响应不符合当前解析范围，停止并报告不确定，不可反复运行。见 `docs/IWIKI_S5F_DISCOVERY.md`。


## 2026-11-04 S5-F 最新交接（优先于 S5-E）
- **S5-F GitHub CI 已核实通过**：Node 全量 `npm test` **104/104**（run `41798382817`），文档检查成功（run `41798382801`）。所有新增测试仅模拟响应，不能替代真实 edit_doc 调用。
- 用户在 Windows 已成功用独立 worktree 检出 S5 `508e908`，`npm run inspect:s5-write -- --live` 列出 27 个官方工具，确认 `edit_doc` 参数 `doc_id/content/title` 与 `append_to_doc` 参数 `doc_id/content`。只进行 `initialize/tools/list`，**未执行任何真实写入**。
- S5 仍按 D-021 的低频方案：预览、第二轮确认、提交前复读比较、普通写入一次、写后复读。不再要求原子 CAS 或独立批准 UI 才能测试；但要确认编辑语义和响应，不虚报结果、不盲重试。
- S5-F 分支新增独立单页隔离探针 `npm run probe:s5-edit -- --write-test`，**不得在用户另行明确授权一次真实写入之前运行**。需要用户自己在网页建立正文恰好为 `MUSSE_S5F_ORIGINAL` 的新测试页，私有 ID 仅在本机环境变量；原有任务总表绝不可作为探针目标。详见 `docs/IWIKI_S5F_DISCOVERY.md`。
- 生产 S5 服务仍未部署，原 S4 双 MCP/Windows 生产配置及日志补丁/防火墙、Muse 角色、ESP32 与 Draft PR #24/#25 保持不变；自动化结果以新 CI 为准。

## 2026-11-04 S5-E 接手（最新）
- **先看 `docs/IWIKI_S5E_PRACTICAL_HANDOFF.md`**，最新用户明确反对过度防御。不要继续照旧 S5-D 要求 CAS、独立批准 UI 或跨重启数据库才允许考虑个人低频写入，也不要恢复 S2-B/S4-E 验收。
- S5 PR #25 新增轻量写前二次读取/比对与写后校验、显式配置写工具的普通 iWiki 适配器、两轮语音确认、仅三工具的独立 stdio 服务器（未启用、未部署）。旧原子模式兼容仍在。
- GitHub Node 22.23.4 完整 `npm test` **98/98 通过**，仅离线模拟；真实官方写工具契约尚缺，需要 Windows 既有官方连接上一条**仅 tools/list、不写入**的脱敏检查：`npm run inspect:s5-write -- --live`。不要把任何腾讯企业 iWiki 接口推断为 SSE_MARKET 的真实 API。
- 语音确认仍由模型转发，不可声称独立真人认证；非原子方案最后读取到提交之间仍可能有网页竞态。用户接受以简洁易用优先。
- 无生产配置、真实文档、现有双 MCP、Muse 人设、ESP32、Windows 安全补丁或防火墙改动；PR #24 和 #25 均 Draft 未合并。


## 2026-11-04 最新接手：S5-D 全量 Node CI 84/84 已通过
- **优先读取 `docs/IWIKI_S5D_FINAL_HANDOFF.md`**。这是新于 S5-C 及 S4-D 的真实 GitHub 最新口径。S4-E 和 S2-B 额外人工验收已取消，不能恢复。
- S5 `feat/iwiki-s5-guarded-write-design` 独立 Draft PR #25（base S4 分支），原 Draft PR #24 未动。通过 `.github/workflows/iwiki-node-tests.yml` 在完整 GitHub 工作区 Node 22.23.4 运行 `npm test` → **84/84 success**（run 41784910123）。
- 首次 80/81 失败的旧固定日期测试已修复；安全门禁新增 `COMMITTING`/ `UNCERTAIN` 不被超时/清理误删、阻塞同文档后续准备，单行任务字段拒绝换行，并有三项新增专项测试。
- **仍然不允许称为语音写入完成或生产可用**：官方写契约原子 CAS 未验证、可信独立批准 UI 未实现、跨进程重启 `UNCERTAIN` 未能持久恢复。当前代码没有写 MCP 生产连接，旧 13 工具入口不得启用。维持 iWiki 唯一持久化、两个原有 MCP、Windows 补丁/防火墙、Muse 提示词、ESP32、云端配置不变。
- 下一步 S5-E 按交接文件推进“官方只读契约证据 + 可信批准设计 + 重启恢复安全设计”，不绕过授权做真实写入。


## 2026-11-04 最新交接：S5-C 专项离线 26/26，生产写入仍锁定
- 最新完整入口为 `docs/IWIKI_S5C_HANDOFF.md`。原 S4-D 任务与日程用户现场验收继续有效，用户已跳过额外 S4-E 验收，不再重复测试。S5 独立开发分支仍为 `feat/iwiki-s5-guarded-write-design`、Draft PR #25（base 为 S4 分支）；原 Draft PR #24 不动。
- S5 核心门禁已增加真实前后值预览、已验证结果去重缓存、异步准备容量保护、预览绑定摘要和误映射笔记格式拒绝；只读官方写工具候选发现脚本 `tools/s5-inspect-write-contract.mjs` 默认无网络，显式 `--live` 也只枚举工具不执行工具调用。
- 实际隔离 Linux Node 22.16 运行 S5 三组专项测试 **26/26**、6 文件语法检查 **6/6**，GitHub 6 文件与本机测试版本哈希一致；完整 Windows/仓库 `npm test` 未跑，不能称为完整回归。
- 未验证 iWiki 原子条件写入、官方远端写权限、可信真人逐次确认，生产写 MCP 不接入。保持双服务、现行 Muse 角色、Windows 补丁/防火墙、ESP32 和云端配置不动；不得把旧 `src/mcp/server.ts` 接到生产。
- 下一批优先拿到用户本机允许的**仅工具发现脱敏摘要**及完整仓库一次性测试；没有证据不得做真实写入。不要回传 Token、页面 ID、私有配置或日志。


## 2026-11-04 S5-B 新分支离线安全门禁交接（最新）
- 用户要求直接 S5、加快进度，取消额外 S4-E 目标/笔记验收；S4-D 既有用户现场验收不重做。
- 当前代码在 `feat/iwiki-s5-guarded-write-design`，从 `25a9f64` 分支出来，不改原 Draft PR #24。设计见 `docs/IWIKI_S5_SECURITY_DESIGN.md`；实现见 `software/musse-iwiki/src/write/guarded-write.ts` 和 `plan-write.ts`。
- 离线安全测试 `tests/s5-guarded-write.test.ts` 在隔离 Node 22.16 上 13/13 通过（模拟原子适配器）；`tests/s5-plan-write.test.ts` 仅提交和语法检查，**还未在原仓库运行**。未跑全量 `npm test`；没有实际写 iWiki 或接入设备。
- 关键硬门槛：官方只读 `OfficialIwikiReadStore` 仍不写且版本令牌为空；旧 `IwikiMcpStore` 写入契约未验证；模型不得自行授权，必须使用真正独立的可信用户确认；没有已验证的远端原子 CAS 就不能写回整份 Markdown。
- 当前 S5 不连接 `xiaozhi-client`、不改私有 Token/文档映射、不添加生产写 MCP、不改 Muse 提示词/ESP32/防火墙/日志补丁。继续在此分支做离线开发和安全审查，部署或真实写入需要另外授权。


## 2026-11-04 最新交接：S4-D 任务/日程语音验收通过，下一阶段待用户指定

> **新对话优先阅读 [IWIKI_S4D_FINAL_HANDOFF.md](IWIKI_S4D_FINAL_HANDOFF.md)**。本文件下方的“S4 方案待审/尚未在设备接入”是历史快照，不再代表当前事实。

- 用户报告：官方 `iwiki` 与新增 `musse_iwiki_readonly` 双服务正常；新服务六工具可见且被实际调用；不报工具名的任务数量、今日安排、近期/逾期、普通聊天四项自然语言语音测试均正常。按 **用户现场验收** 登记，未独立采集逐条工具轨迹。
- 之前 Windows `10/10` 指定离线测试、真实测试任务表 `3/2/1/0` 统计、新业务 MCP `--smoke` 六工具和写入拒绝、`--install` 备份与安装已通过。原官方 MCP 继续保留；新服务与原客户端在 Windows 共存。
- 尚未实现目标/笔记真实使用闭环：`goal_query`、`note_query` 虽被发布，但私有映射目前只有任务表 ID；不重复已取消的 S2-B 三文档验收。S5 受控语音写入是未来目标，仍需另行授权、安全审查，不能直接开放。
- iWiki 唯一数据源；Muse 现行 S3-A 角色提示词不动。`xiaozhi-client@2.3.0` 本机日志补丁、TCP 9999 防火墙入站阻止规则、ESP32 固件与私有数据均保留。分支 `feat/iwiki-s2a-readonly-contract` 的 PR #24 保持 **Draft 未合并**。
- 下次操作：在新对话先给出目标/笔记最小只读接入与 S5 受控写入安全方案两类选项，不擅自执行任何真实数据操作。运行和回滚看 [Windows 运行手册](IWIKI_LOCAL_MCP_RUNBOOK.md)。


## 2026-11-04 S4-D 批量 Windows 接入操作包已备妥（待用户执行）

- 用户确认真实 `read_doc` 读取 S2-A 测试任务表成功，汇总 `total=3, todo=2, done=1, archived=0`。此前 Windows 指定 10/10 离线检查通过。
- 新脚本 `software/musse-iwiki/tools/s4d-bridge.mjs` 已在当前功能分支。建议用户停止已运行的 `xiaozhi start` 后，进入 `$HOME\MuSSE-Lab\MuSSE\software\musse-iwiki`，执行 `git pull --ff-only`，`node tools/s4d-bridge.mjs --install`，`node tools/s4d-bridge.mjs --status`。安装前会自动运行 stdio MCP 真实只读查询和写工具拒绝检查；成功后备份既有 `xiaozhi.config.json`，仅追加 `musse_iwiki_readonly` 本地 Node 服务，不在配置中填入令牌或页面 ID。
- 之后原目录 `$HOME\MuSSE-MCP-Local\musse-bridge` 执行 `xiaozhi start`，本机 dashboard 核对官方 `iwiki` 和新增 `musse_iwiki_readonly` 两服务，并确保六个业务工具可见。只对任务执行少量设备语音查询，需看到实际 `task_query` 调用证据，不能仅凭语音数字判断工具来源。目标/笔记目前未映射，调用会安全失败。
- 若接入出错：关闭 `xiaozhi start`，在原功能分支执行 `node tools/s4d-bridge.mjs --rollback`，然后重新在原目录 `xiaozhi start`。回滚只移除新增服务项，保留原官方 iWiki；自动备份含私人凭证，留在 Windows 本机不能上传。保留原有 npm 安装目录的日志脱敏补丁、防火墙 9999 入站规则，不重装客户端。
- 脚本只做过合成数据和模拟子进程的隔离检查，尚无真实 Windows `stdio` 桥接集成与 MuSSE 设备验收。S5 写入仍未授权，草稿 PR #24 不合并。

## 2026-11-04 S4-D Windows 10/10 离线测试已由用户实测通过

- 用户报告 Node `v22.23.2`，Git `2.54.0.windows.1`，本地克隆提交 `b0b0436`，三份测试文件 `tests 10 / pass 10 / fail 0`。因此可进入本机私有映射准备，但**不宣称已完成真实 iWiki 查询或 MuSSE 设备集成**。
- 代码位于 `$HOME\MuSSE-Lab\MuSSE\software\musse-iwiki`，现有生产桥接仍在 `$HOME\MuSSE-MCP-Local\musse-bridge`，互不替换。
- 下一步仅需验证私人 `xiaozhi.config.json` 文件存在，确认实际已有 iWiki 任务文档和目标/笔记文档的情况，再在 Windows 个人目录建立本机 `musse-iwiki-readonly.json` 映射。若目标或笔记不存在，先保持可选映射为空，勿要求恢复取消的 S2-B 三文档试验。
- 后续添加 `stdio` 业务服务前，必须保证 Windows 现有配置备份、补丁和防火墙规则保留；绝不提交真实 Token、文档 ID 或完整日志。PR #24 仍是 Draft。

## 2026-11-04 S4-D 准备阶段：等待 Windows 本机离线测试结果

- 仓库已完成 S4-B+C 六个查询并提交 S4-D 最小安全修正：任务/笔记数组返回 `structuredContent.data`、目标对象保持对象格式。新增私有映射文件路径读取，避免在 `xiaozhi-client v2.3.0` 的 `mcpServers` 中放含真实页面 ID 的 `env` 字段（上游转换配置有打印配置的代码）。
- **用户下一步**：按 [S4-D Windows 离线检查](IWIKI_S4D_PREFLIGHT.md) 从指定功能分支获取代码，在本机运行 Node 22.18+ 下 S4-B/C/D 三个精确测试文件，并汇报测试通过数或已脱敏错误。无需现在启动/修改现行桥接、上传私有配置或进行真实 iWiki 读取。
- 本轮 S4-D 仅处于本机检查准备状态；未经下一轮明确审查许可，不修改本机运行中 `xiaozhi.config.json`、日志补丁、防火墙规则或云端。官方 MCP 继续作为当前生产链路。PR #24 保持 Draft，S5 写入仍单独待授权。

## 2026-11-04 S4-C 完成仓库代码交接，下一步 S4-D 需单独批准

- 当前分支 `feat/iwiki-s2a-readonly-contract`，草稿 PR #24，未合并。一个未部署的入口 `software/musse-iwiki/src/mcp/server-readonly.ts` 提供 S4-B 四项任务/日程 + S4-C `goal_query`、`note_query`，合计 6 项只读工具。保留既有官方 iWiki MCP 生产配置、现行 Muse 提示词和旧 `server.ts` 不变。
- 数据继续只保存在 iWiki。新工具复用 `OfficialIwikiReadStore` / 官方 `read_doc`，绝不调用写入工具。未来 S4-D 经批准后，本机私有环境需要 `MUSSE_IWIKI_PRIVATE_CONFIG_FILE`、必需 `MUSSE_IWIKI_TASK_DOC_ID`、可选 `MUSSE_IWIKI_NOTES_DOC_ID` 与 `MUSSE_IWIKI_GOAL_DOC_IDS`（JSON，例如 `{"G-001":"page-FAKE"}`，**仅假值示意，切勿入库真实值**）。目标查询需要给定已映射目标 ID，不自动枚举空间；缺映射报错，不回报不存在的空数据。
- `tests/s4b-readonly.test.ts` 已修正原“四工具总数”断言，保留对 S4-B 四项工具的覆盖；新增 `tests/s4c-readonly.test.ts` 检查六工具、禁止写入、参数边界、映射和最新笔记排序。隔离 Node 22.16 以依赖替身运行 S4-C 4/4，通过语法检查，但**没有**完整仓库全量回归、真实账户读取或设备验证。
- 下一步仅在用户明确批准后推进 S4-D Windows 桥接集成；优先在完整仓库与 Node>=22.18 做最小测试，随后才考虑真实只读集成。S5 受控写入另行授权。原 S2-B 繁琐人工验收已取消，不恢复。

## 2026-11-04 S4-B 仓库代码交接（覆盖下方 S4-A 待审记录）

- 已按用户批准的方案 B，新增 `software/musse-iwiki/src/mcp/server-readonly.ts` 和只读协议、工具白名单；只实现任务及今日/近期/逾期日程四个只读工具，不修改旧 13 工具服务、Muse 提示词或现有 Windows 桥接。
- 底层使用原 `TaskService`、`OfficialIwikiReadStore`、官方 iWiki MCP 客户端。未来经单独授权配置 `MUSSE_IWIKI_PRIVATE_CONFIG_FILE`（仅本地私有配置路径）和 `MUSSE_IWIKI_TASK_DOC_ID`（任务表页面 ID）。不得提交实际值。
- 最小测试 `software/musse-iwiki/tests/s4b-readonly.test.ts`；真实完整检出且 Node>=22.18 时运行 `node --test tests/s4b-readonly.test.ts`。本轮隔离工作区的 4/4 使用本地临时依赖替身，不代表正式仓库全量运行。
- 不修改真实账号/数据、固件、云端、Windows 配置，不合并草稿 PR #24。S4-C/D 另行授权；不恢复 S2-B 三文档人工验收。

## 2026-11-04 新对话入口：S3-A 已配置，下一步 S4-A 方案待审

**先读 [S4 专项交接](IWIKI_S4_HANDOFF.md) 和 [当前生效的完整角色提示词](IWIKI_S3_PROMPT_CURRENT.md)**。本节覆盖下面以 S2-B 手工验收为下一步的历史交接，不再要求创建三篇虚构测试文档或运行 `probe-goal-notes.mjs --live`。

- 用户已将新版 MuSSE 角色提示词配置到小智控制台，采用 `# Role: Muse`、自然口语/台湾腔/亲密但不照抄设定，且完整保留 iWiki 只读查询规则；新版实际效果未正式复核，固定问候可能还受云端/平台机制影响。
- **S2-A 成果不变**：官方 iWiki MCP、Windows 真实只读任务统计与用户确认的设备语音读取成功。**S2-B 三文档真实验收取消，未验证的目标/笔记能力不得宣称通过**；历史源码和模板不删除。
- **下一步仅讨论，不直接开发**：拟定 S4-A 的只读业务工具最小接入方案，评估是否需引入自研业务 MCP 的受限只读子集，并以 S4-B/C/D 逐步覆盖任务、日程、目标、笔记、设备语音；用户尚未批准 S4 方案。
- **S5 是明确的后续目标**：最终需要受控语音写入任务和笔记，但本轮不提供写权限、不调用写入工具，也不构成真实账号写入授权。
- 开发分支仍为 `feat/iwiki-s2a-readonly-contract`，草稿 PR #24 未合并；生产 `xiaozhi-client`（含本地脱敏修补）与防火墙、ESP32 固件、官方 iWiki MCP、个人数据和现有不上云架构均不动。

## 2026-11-03 新对话入口（当前 iWiki 任务：S2-B）

**立即读取 [iWiki S2-B 专项完整交接](IWIKI_S2B_HANDOFF.md)**，以及 [S2-B 虚构目标/笔记验收模板](../software/musse-iwiki/docs/S2B_GOAL_NOTES_ACCEPTANCE.md)。这两份是新对话的具体执行入口，优先于本文件下面历史阶段记录。

- 主仓库：`Qi0331/MuSSE`；已核对 `main` 保持 `a9ae041531c138483a1c9c2fbf3b6c2992ec0baf`；当前开发分支：`feat/iwiki-s2a-readonly-contract`，**草稿 PR #24，未合并**。
- **已完成并用户实测**：官方 iWiki MCP 27 个工具发现、六个查询接口 schema；`read_doc` 返回结构；三行虚构任务表的真实读取和日期汇总（3 总数、2 待办、1 完成、1 未来七天、1 逾期）；用户还确认 MuSSE 设备语音读取虚构任务表成功，但未提交工具级调用计数。
- **尚未执行验收**：S2-B 的目标进度/笔记三文档工具与新增离线测试只存在于草稿功能分支，还没有用户 Windows 回传。这些文件不能当成已验收成果。用户尚未按 S2-B 模板创建两篇新的专用测试文档。
- **下一步**：新对话先审核并运行 S2-B 离线测试，再让用户按模板在 iWiki 网页手工准备三个虚构文档，用户 `git pull` 并在 Windows 显式批准最多 3 次只读 `read_doc`；只收脱敏摘要。随后测试 MuSSE 语音目标/笔记查询。不要重复 S2-A。
- **严禁**：擅自合并 PR、真实写入、公开凭证、改现有 Windows 桥接/ESP32、云部署；官方远程 iWiki MCP 和仓库自研 13 工具业务 MCP 是两条不同路线。


## 2026-11-03 S2-A 任务读统计已验收；下一阶段转 S2-B 语音查询

- 用户 Windows Node v22.23.2 的严格只读适配器与任务查询合成测试 **7/7 通过**；用户亲自运行 `probe-task-queries.mjs --live` 对专用虚构任务文档进行**一次**真实 iWiki 读取，返回 `validatedTaskTable:true`、任务数 3、未完成 2、已完成 1、逾期 1、未来七天 1、今天 0；脚本报告远程读取 1、写入 0。
- **S2-A 达标范围**：真实 `read_doc` → `OfficialIwikiReadStore` → 任务 Markdown 解析 → 本地内存只读统计。测试数据是虚构任务，不代表用户真实任务已入库。
- **下一 S2-B**：优先在已运行的 MuSSE 设备上，用现有官方 iWiki 查询工具试读这篇测试任务表并观察 MCP 工具调用计数或脱敏证据，区别“模型凭空答对”和“真实调用”。若业务问句不能被稳定解析，再评估接入本仓库 13 个业务 MCP 工具的**只读子集**，不修改原有生产桥接、不默认提供写入功能。
- 保留 Windows 本地手动启动、Token 保密、MCP 写入未授权、既有固件和云端不变；PR #24 保持草稿，尚未合并 `main`。


## 2026-11-03 S2-A 用户 read_doc 实测与下一检查

- 用户已在 Windows 独立执行 3/3 新增离线测试和一次真实官方 `read_doc` 调用，返回 `structuredContent` 不存在、`content[0].text` 中嵌套 `{ok:boolean,data:{doc_id,title,content,...}}`；正文及个人标识未公开。**`ok` 的实际值未知**，不能据探针 `success:true` 猜测。
- PR #24 草稿已准备严格只读 `OfficialIwikiReadStore`，强制显式文档 ID 映射、`ok:true` 及 ID 对齐，write/list 直接拒绝。还有 `S2A_TASK_TEST_TEMPLATE.md`（虚构数据）和 `probe-task-queries.mjs`（一次远端 read_doc、内存统计、仅输出数量）。
- 用户下一步：在自己专用的非敏感 iWiki 测试文档**手动**贴入虚构 12 列 Markdown 任务表，`git pull` 后在 `software/musse-iwiki` 运行 `node --test tests/official-iwiki-read.test.mjs tests/probe-task-queries.test.mjs`，再由用户自愿执行 `node tools/probe-task-queries.mjs --live`。只回传 `SAFE_TASK_SUMMARY_BEGIN/END` 之间的数据。
- 此步骤没有真实知识库写入授权（用户网页手动编辑自己的测试文档除外）、没有设备端业务语音验收或云端部署，现有 Xiaozhi 桥接不改。


## 2026-11-03 S2-A 用户实测续报（PR #24 功能分支）

- 用户在 Windows Node v22.23.2 上成功运行只读契约检查，获得 27 个总工具、六个查询工具的入参字段与必填项；详见 [S2-A 文档](../software/musse-iwiki/docs/S2A_READONLY_HANDOFF.md)。不需要再重复第一轮 `tools/list` 验收。
- 本分支新增 `tools/probe-read-structure.mjs` 与三项离线测试，供**用户明确选择非敏感测试文档**后执行一次 `read_doc`，只记录结构，不输出内容。尚未运行用户 Windows 的真实读取，也不准据此宣称任务业务可用。
- 下一阶段核对读取响应结构和任务数据模型。Token 只在本机现有配置使用，不能进入 GitHub；如无合适测试文档，暂停真实读取并等待用户选择。


## 2026-11-03 S2-A 只读工具契约检查草案（仅 PR 功能分支）

- 为恢复 iWiki 任务业务第二阶段而新增 `software/musse-iwiki/tools/inspect-readonly.mjs`、测试与 [安全运行说明](../software/musse-iwiki/docs/S2A_READONLY_HANDOFF.md)。本轮只开发、离线验证和准备 Windows 本机执行步骤；未访问任何私人 Token/空间/文档，也未运行真实第三方 MCP 联调。
- 下一位执行者在 Windows 下载/检出此功能分支，先执行 `node --test tests/inspect-readonly.test.mjs`；经用户选择后再用 `node tools/inspect-readonly.mjs --live` 取得**仅工具名和参数字段的脱敏摘要**。脚本不调用 `tools/call`，不会写入或读取任何 iWiki 文档正文。
- 正式业务适配仍需依据真实输入/响应契约单独实现并测试；禁止推断当前 13 个业务工具可直接上线。原有官方 iWiki MCP 语音通用查询已成功，仍不重复首次连接排障。


## 2026-11-03 最新交接：本地 iWiki MCP + MuSSE 语音查询已完成（覆盖下方所有历史阶段）

> **新对话从此节开始**。旧节所写“先检查 Wi-Fi/绑定”“COM7 下载模式待处理”“MCP 未实测”均为当时快照，不能重新作为待办。已验证链路的完整启动、隐私约束与恢复见 [IWIKI_LOCAL_MCP_RUNBOOK.md](IWIKI_LOCAL_MCP_RUNBOOK.md)。

- **设备现状**：用户确认新 ESP32-S3 `YD-ESP32-23 2022-V1.3`（FT232R/COM7，而非旧 CH343/COM6）已正常连接小智官方云端、绑定此前的 MuSSE 智能体、双向语音正常。上游固件仍为 `v2.5.2/bread-compact-wifi`；本轮没有任何新烧录/外设接线。历史 `DOWNLOAD` 问题用户报告已恢复，根因未知。
- **新增已完成的工作**：Windows 下 `xiaozhi-client@2.3.0` 经 `--ignore-scripts` 安装成功；在 `$HOME\MuSSE-MCP-Local\musse-bridge` 运行 `xiaozhi start`；小智 MCP 接入点日志连接 `1/1`；iWiki 官方远程 HTTP MCP 服务 `1/1`，实际发现约 27 个工具。本地 `list_spaces` 真实调用 `ok:true` 返回 41 个可访问空间；用户确认 MuSSE 设备通过语音查询成功。
- **下次开机**：普通 PowerShell 运行 `Set-Location "$HOME\MuSSE-MCP-Local\musse-bridge"`，随后 `xiaozhi start`，保持窗口/电脑网络运行；`http://localhost:9999/dashboard` 查状态。无需再次安装、重新配网、重新绑定或烧录。电脑离线/睡眠时仅 iWiki MCP 不可用，不影响原有普通语音。
- **技术边界**：这次是直接桥接 `https://ssemarket.cn/iwiki-api/mcp`，**并未运行**本仓库 `software/musse-iwiki/src/mcp/server.ts`。它的第一批 29 项离线测试与任务/目标/笔记业务层不能算已经远程实测；S2-A 仍暂停。没有腾讯云 Lighthouse/CloudBase/独立 Web 服务或 24/7 部署。
- **安全**：本机入站 TCP 9999 已被 Windows 防火墙阻止，本机访问正常。假 iWiki Token 曾被 npm 包配置日志完整打印，用户已修复 `dist/backend/WebServer.js`、`dist/backend/WebServerLauncher.js` 各 1 处；二次假令牌复测两项均 `False`，并非全面安全认证。安装包重装会丢失补丁。只读 Token 的写权限拒绝未独立核验，默认发现的写入工具应关闭（推荐只留 6 个查询工具）；最终 UI 开关状态仍待确认。Public 仓库只可记录脱敏结论，绝不可提交接入点、Token、私有配置、测试日志/备份、空间名称和私人知识数据。
- **新对话约束**：本地语音查询已完成；由用户选择下个开发任务。除非用户要求，不要自动迁移腾讯云、制作开机自启、增加主动提醒、写入 iWiki、扩展业务 MCP、重刷固件或重新排查旧启动故障。保持 MuSSE 与 Muse 私人 Agent 隔离。


## 2026-11-03 最新跨对话交接：启动已恢复，下一步核对小智联网与设备绑定（最高优先级）

> 本节覆盖下面 2026-11-03“COM7 下载模式异常（尚未解决）”旧快照；旧排障文字仅作历史证据，下一对话**不应默认故障仍存在**。

- **设备与固件**：新 YD-ESP32-23 2022-V1.3，ESP32-S3 N16R8，FT232R / COM7（不是旧 CH343/COM6）。Reasonix 报告烧录 `78/xiaozhi-esp32 v2.5.2/bread-compact-wifi` 五镜像 5/5 校验并曾进入配网。用户明确选择新板不备份原厂 Flash，不能假设可恢复原厂固件。
- **最新用户报告**：“已经好了。目前的模块都配置好了。”因此此前 `DOWNLOAD(USB/UART0)` 启动故障按用户报告**已恢复**；解决步骤、根因、完整裸板对照以及新日志没有回传。不要重走 BOOT 排障或无依据重刷，也不要宣称 GPIO0/FT232R 已确诊。
- **外设范围**：OLED、INMP441、MAX98357 系列功放、8Ω/3W 扬声器等已到货且用户报告配置完成；没有新的逐项接线与实测报告，不能把“配置好”等同 OLED 亮屏、录音、播放与全部按键经过验收。LED 矩阵、转换模块、外置电源沿用此前未确认到货/电气风险记录。
- **当前对话刚刚提供的指导**：手机连接设备 `Xiaozhi-XXXX` 临时热点，在本地配网页面录入 2.4GHz Wi-Fi，ESP32-S3 连网后向小智服务获取激活信息，在 `https://xiaozhi.me` 登录此前创建了 `MuSSE` 智能体的官方账号并绑定设备；绑定后验证麦克风→服务器→扬声器的语音闭环。这是参考操作流程，**尚无用户回报哪一步已成功**。
- **新对话第一步**：先确认实际 Wi-Fi 连接、激活码/激活状态、控制台设备是否绑定现有 MuSSE 智能体、首次语音是否能听到回答；根据实际卡点指导，不在不知道状态时强制重新配网、升级固件或改外设接线。账号页面截图与日志须脱敏，不收集/公开 Wi-Fi 密码或 Token。
- **继续有效的约束**：iWiki V1 第二阶段 S2-A 尚未交 Reasonix，软件开发暂停；D-013 iWiki 唯一持久化数据源与被动查询继续有效，不连接私人 MCP、不云部署；MuSSE 与 Muse 个人 Agent 严格隔离。任何刷写/高风险接线/外部敏感操作仍需单独授权。
- 真实证据和权威进度分别见 [TEST_LOG](TEST_LOG.md)、[STATUS](STATUS.md)；不得把上游操作指南或用户口述扩写成已验证的云端绑定结果。


## 2026-11-03 新对话置顶：硬件优先，COM7 新板启动模式异常（尚未解决）

> **新对话先读此节、[STATUS](STATUS.md)、[HARDWARE](HARDWARE.md)、[TEST_LOG](TEST_LOG.md) 和 [AGENTS.md](../AGENTS.md)。以下内容覆盖本文件历史“尚未烧录小智 / 配件未到货”的旧快照，历史保留。**

**工作优先级**：用户已暂停 MuSSE iWiki V1 第二阶段，之前拟定的 S2-A 最小工作包**没有发送给 Reasonix**，不得擅自启动 iWiki 账号联调、云端部署或软件功能扩张。D-013 继续有效；MuSSE 与其他个人 Agent 项目严格隔离。现在专注新到货 ESP32-S3 的硬件启动与后续音频显示联调。

**两块主板别混淆**：
- 旧板：CH343/COM6，已做 Hello World 烧录和原厂备份；不能将旧板日志或备份视作新板数据。
- 新板：照片标识 `YD-ESP32-23 2022-V1.3` / `S3-N16R8`，`COM` / `USB` 双 Type-C。Windows FT232R USB 串口驱动安装后是 COM7；用户用 esptool v5.6.0 实测 ESP32-S3 rev v0.2、16MB Quad 3.3V Flash、40MHz 晶振、8MB PSRAM 识别信息。

**新板固件已烧录，不要重复执行**：用户明确不做原厂备份；Reasonix 报告复用 `78/xiaozhi-esp32` v2.5.2 / `bread-compact-wifi` 构建，在 COM7 写入五镜像（`0x0` bootloader、`0x8000` partition、`0xD000` OTA、`0x20000` app、`0x800000` assets），5/5 校验通过、退出码 0。烧后 Reasonix 日志显示 App v2.5.2、PSRAM 初始化、MCP 工具注册、`wifi_configuring` 和 SoftAP，表明**曾成功正常启动**；当时 OLED 未接，I²C 初始化失败但应用继续运行。尚未配网绑定或语音联调。原始脱敏报告保存在本机 `MuSSE-Lab/reports/XIAOZHI_V252_FLASH_COM7_20261103.md`，不在公开 GitHub。

**当前故障**：之后用户接入 OLED/麦克风/功放/扬声器并称接线完成；所有外设的实际端子和供电**尚未独立复核**。用户反复在 COM7 115200 读取到 `boot:0x0 (DOWNLOAD(USB/UART0)) / waiting for download`，包括 `python -m serial.tools.miniterm COM7 115200 --dtr 0 --rts 0`。用户又测试只用主板标注 `USB` 口供电，未见 Wi-Fi 热点。此症状表明 ROM 未进入 Flash 正常启动，**不是“固件板型肯定烧错”的证据**。用户曾被建议拆线/检查 BOOT，但最近一次是否真正裸板脱离面包板并完全隔离全部外设没有充分证据。下一对话先确认此事实，不要假设它已被彻底验证。

**实物及供电**：INMP441、MAX98357 系列功放、8Ω/3W 扬声器、0.91 英寸 OLED、按钮/跳线/面包板已到；用户表示音频与 OLED 组件已装好。两种 LED 矩阵、电平转换和外置电源在本批均由用户报告尚未到货（历史仓库称旧 HT16K33A 板曾持有，后续核对是否不同批或另存）。目前电脑 USB 供电，无万用表；**不要接 5V LED、并联双电源或假定功放供电无风险**。

**新对话执行顺序**：
1. 确认当前测试时全部外接导线是否已从 ESP32-S3 上拔除、主板是否离开面包板，BOOT 按钮是否能回弹；无须重新安排 Hello World、原厂备份或固件重刷。
2. 在完全断电、绝缘桌面、仅单 USB 的条件下检查 BOOT/GPIO0、FT232R 自动复位控制和 `YD-ESP32-23` PCB 版次；保留脱敏启动日志。若已证实完全裸板仍进入下载模式，优先寻原理图/测 GPIO0，必要时借用万用表，不要通过直接短接 GPIO0 至 3V3 来试错。
3. 只有恢复 `SPI_FAST_FLASH_BOOT` / 小智实际启动之后，才逐个接 OLED → INMP441 → 功放/扬声器 → 按钮，确认供电后再进行 Wi-Fi 配网和小智语音闭环。LED 矩阵继续暂停。
4. 按真实证据更新状态；任何后续刷写、外设高风险供电、私有云端连接与账号操作仍按 AGENTS.md 的授权要求执行。

**重要技术澄清**：`Espressif` 是 ESP32-S3 芯片厂商，`bread-compact-wifi` 是小智 v2.5.2 的板级 GPIO/外设配置，并非互斥型号。5/5 烧录校验与曾经成功启动的日志，使“程序烧错”为当前下载模式主因的证据不足。

## 2026-11-03 追加：iWiki 单数据源 V1 第一批（审核修复版）

- 基线已更新为最新 `main`（`6331049`）；代码已推送至 `feat/iwiki-mcp-v1-batch1`，PR 与合并状态以 GitHub 为准。
- 新代码：`software/musse-iwiki/`；D-013 覆盖原 B+C 实施方向，D-010/011/012 与 M1 显示核心、5V/5A 采购记录保留。
- 已完成：任务/日程/目标/笔记逻辑、模板、29 项离线测试、MCP stdio、iWiki 协议客户端与默认只读适配、小智桥接方案。
- 未完成（需授权）：真实 iWiki `initialize/tools/list`、读写/权限/冲突；小智与 `xiaozhi-client` 联调；持续在线部署。
- 安全：真实远程写入默认关闭；Token 不进入配置文件/源码/日志；无凭证时 `UNAVAILABLE`，不回退本地。
- 本批不改变 M0/M1 硬件与显示状态。

## 本轮结论与工作方向

**M0 的最小可复现真机闭环已完成**：ESP-IDF v6.1 Hello World 由 Reasonix 报告烧录与哈希验证通过，115200 CH343 串口 5 次正常启动、4 次软件自动复位；原厂 `led_strip` 已保存 16 MiB 私有 Flash 备份。新建的 `gpio_button` 本地工程已编译，但默认 GPIO 全禁用，**未烧录也未实测按钮**。

**M1 准备有实质进展**：小智 `v2.5.2` / `bread-compact-wifi` 已在 Windows 使用 ESP-IDF v6.1 本地完整构建成功（Reasonix 报告，未独立校验本机二进制）。上游源码 commit `49b4380b3faa0ceadd28a3e78aaf0f311c46c57e`；研究报告在 `C:\Users\Lenovo\MuSSE-Lab\reports\xiaozhi-v2.5.2-analysis.md`，未上传仓库。本次 GitHub 仅同步脱敏结果和进度，不上传本地实验源码、上游 clone、镜像或原 Flash。权威状态见 [STATUS](STATUS.md)，真实记录见 [TEST_LOG](TEST_LOG.md)。

## 新对话优先任务

1. **优先开发功能而非继续堆基础板测试**。先在独立 MuSSE 模块中实现硬件无关的 `16×16` 帧缓冲、`Idle/Listening/Thinking/Speaking/Error` 表情帧/动画、状态映射、PC 离线渲染与单测。之后再评估小智 `DeviceStateMachine::AddStateChangeListener` / `Led::OnStateChanged()` / `Display::SetEmotion()` 的最小适配方式。不要立即修改锁定上游源码。
2. **两块不同矩阵不可混淆**：已持有的创乐博 I²C 16×16、2×HT16K33A（5V、地址/上拉未知），另有用户新购商品图中的 **5V WS2812B 16×16 RGB**（256 颗、单数据线、可能有高峰值电流，实物未核验）。两者底层驱动、供电、映射与效果都不同。BSS138 四路模块计划用于 **I²C** 电平转换，不能默认用于 WS2812B 高速数据。两块灯板都暂不接 ESP32、不上电。
3. **供电**：用户选择长期 USB 5V 有线桌面方案，取消当前电池双供电设计。用户提供了标称 5V/3A 适配器与 14500 电池模块的购买截图，但非已核验实物；不将 14500 模块接入 MuSSE。需按 LED + 功放峰值电流核定供电，注意 USB 调试和外部电源反灌风险。
4. **待到货**：INMP441、MAX98357、扬声器、OLED 此前均未到货；是否已到货以用户新照片/确认更新，不先验判为已拥有。

## 本地开发环境、路径与证据

- PowerShell + ESP-IDF `C:\esp\v6.1\esp-idf`；激活脚本 `C:\Espressif\tools\Microsoft.v6.1.PowerShell_profile.ps1`。Windows CH343 通常 COM6，执行前应重新确认；勿用 Git Bash/MSYS 运行 `idf.py`。
- `C:\Users\Lenovo\MuSSE-Lab\hello_world`：官方 Hello World 已真机成功。
- `C:\Users\Lenovo\MuSSE-Lab\gpio_button`：按钮/输出均默认关闭，独立编译成功，尚未烧录。
- `C:\Users\Lenovo\MuSSE-Lab\xiaozhi-esp32-v2.5.2`：上游只读研究副本，`git status` 干净；构建成功但未烧录。
- `C:\Users\Lenovo\MuSSE-Lab\musse-readonly`：Reasonix 本地阅读 GitHub 仓库副本。
- `C:\Users\Lenovo\MuSSE-Lab\reports\xiaozhi-v2.5.2-analysis.md`：本机研究报告。
- **禁止上传**：`C:\Users\Lenovo\MuSSE-Private-Backups\esp32s3_factory_20261102.bin`（完整原 Flash）以及可能带设备标识的原始串口日志。备份 16,777,216 字节、SHA-256 `cd0f30ac9491da499eaf2167f07b5accf23cf6779c506110431aa766f346273e`。
- 上游构建：`python scripts/build.py bread-compact-wifi --name bread-compact-wifi`，报告退出码 0；`xiaozhi.bin` 2,577,504 字节，SHA-256 `3c77df039b71f03de25dca21bcd49d91fe8bf591ff7fd8259685feb1d94c7e12`。
- 小智构建分区包含 bootloader 0x0、分区表 0x8000、OTA data 0xD000、应用 0x20000、assets 0x800000；**切勿将它与 Hello World 的单应用分区/0x10000 应用烧录混用**。

## 已识别上游软件接口（Reasonix 源码审查报告）

- 状态：`main/device_state.h`、`main/device_state_machine.{h,cc}`；`AddStateChangeListener(callback)` 可观察状态切换；`Application::SetDeviceState()` 触发 UI/LED 变化。
- 显示：`Display::SetEmotion(const char*)`；灯光：`Led::OnStateChanged()`；`Board::GetLed()` 按板型提供灯驱动。
- 建议先做独立硬件无关表情逻辑，不在未确认两块矩阵驱动与供电前把 HT16K33A 或 WS2812B 写死为唯一实现；保留 5 个核心状态表情。

## 协作与权限

用户将完整提示词交 Reasonix CLI，在另一台 Windows 电脑执行并回传报告；ChatGPT 制定方案、验收并记录。相关只读查询与本地编译可批量推进，不必每个命令停一次；**烧录、擦除、危险接线、远程对外发布和敏感信息必须按授权执行**。常规代码/文档经功能分支与 PR 合入；尽量阶段末集中更新。无用户明确要求不得擅自刷入小智、接电池或外设。

当前问题入口：[Issue #1](https://github.com/Qi0331/MuSSE/issues/1)、[#4](https://github.com/Qi0331/MuSSE/issues/4)、[#10](https://github.com/Qi0331/MuSSE/issues/10)、[#11](https://github.com/Qi0331/MuSSE/issues/11)。社区外部评论涉及 GPIO、WS2812 与 HT16K33A 的安全事项，仅作调研线索。

## 2026-11-02 追加交接：官方平台与 M1 执行方案调整（以本节为最新）

- 用户已登录小智官方控制台 2.0，创建 `MuSSE` 智能体（未绑定，0 台设备）。截图观察：小智 Lite、记忆已开但 0 条、天气/笑话/音乐/新闻/知识库服务勾选、知识库内测空白测试库 0 文档且智能体未使用、MCP 接入点可见但状态“加载中”、云端编译历史为空。所有这些仅属于**用户界面观察**，没有发出真实 MCP、记忆或设备测试。详见 [XIAOZHI_PLATFORM.md](XIAOZHI_PLATFORM.md)。
- 重新评价源码复用：小智 v2.5.2 已有音频/AI/情绪/显示接口，后续 MuSSE 不应从零复制语音/对话系统。优先核对上游 SetEmotion 与状态机事件，独立开发必要的 16×16 像素转换、动画与可替换 Sink，保持 HT16K33A/WS2812B 底层分离。
- **最新 Reasonix 工作包**：单次批量完成上游接口真实调用路径核验、Windows 本地 C++ 实现/单测、真实 C++ 帧驱动的离线预览、隔离副本的最小侵入集成可行性与编译验证、脱敏交付报告；不得烧录/接线/云端提交。不要覆盖原研究副本，也不要自行推送 GitHub（本次文档同步由 ChatGPT 另行完成）。
- M3/M4 待办、主动提醒、个人长期记忆追踪延后；MCP 只作为候选接入能力，不能把“页面有接入点”当成调度、数据库或消息主动推送已存在。后续优先考虑复用现有提醒事项管理流程，先证明权限与接口可用。
- 本段不改变原有 M0 真机实测证据：Hello World 与小智本地构建是两种不同阶段；小智未上板、语音/PSRAM/LED 仍未验证。

## 2026-11-02 最新交接：M1 源码已归档（覆盖此前“代码仍只在本地”的记录）

- **正式软件入口**：`software/musse-display/`；以其 `README.md`、`docs/INTEGRATION.md`、`reports/FINAL_REPORT.md` 为当前 M1 软件细节依据。
- **软件已完成**：16×16 RGB888 五种表情、动画、状态/情绪桥接、含关键事件保留的有限队列、NoopSink、C++ 单测共 93 项、离线预览 C++ 生成器；隔离上游 `v2.5.2/bread-compact-wifi` 编译级验证（Reasonix 报告）。补丁归档但**未刷写 ESP32**，本仓库不含整个小智上游副本。
- **当前风险**：运行时切换 Sink 同步、长期事件序列号回绕、持续事件洪泛负载、实际 FreeRTOS 任务栈/性能、LED 电平/供电/像素排列和语音闭环均尚未经过真机验证。
- **下一轮 Reasonix 工作包**：只在 Windows 本地批量开发 HT16K33A、WS2812B 的抽象输出适配、Mock 总线/数据流测试、亮度与电流保守估算、双矩阵 C++ 预览、上游隔离编译，并修复上述稳定性风险；默认仍保留 NoopSink，禁止烧录、接线或上传私密信息。完成后打包脱敏 ZIP 给 ChatGPT 审核和 GitHub 归档。
- **云端工作**：小智智能体记忆/MCP/知识库只做过控制台观察；日常待办、定时提醒、长期追踪延至后续阶段，不能声称已有持续提醒服务。

## 2026-11-03 当前交接覆盖项：B+C 软件优先

- 本轮已明确的**当前开发优先级**是 [PRODUCT_V1.md](PRODUCT_V1.md) 的网页待办 + 长期目标 + 快捷笔记 + iWiki 接入，不再将 LED M2 适配/未到货语音硬件作为软件 V1 开工前置条件。
- 页面应能在用户 Windows 电脑关闭后通过手机访问：优先国产托管，当前候选腾讯云开发 CloudBase；暂未开通、部署或选择具体数据库类型。iWiki 官方远程 MCP `https://ssemarket.cn/iwiki-api/mcp` 可作为知识库适配入口，实际权限与接口未实测，Token 不能传到前端或公开仓库。
- **用户明确本期不做主动提醒**：只展示截止/逾期，暂不实施推送、定时任务、消息队列和自动播报。
- **执行要求**：Reasonix 直接开发正式可运行的业务页面和持久化接口；无须独立 Mock 阶段，外部服务未开通时仅做最小可替换的本地测试；完成后仅处理真实功能、安全和数据问题，避免无限测试或重构。
- 用户新购标称 **5V/5A 可充电电源**，当前仅“已购买、未核验”，不代表到货或足够整机供电，也不自动改变桌面有线供电决定。见 [HARDWARE](HARDWARE.md)。
- **此前外部 Issue 技术建议暂缓**：本轮不评论、不关闭/修改 Issue，也不因评论立即增改硬件或固件代码。
- M1 的 93 项单元测试、NoopSink/表情引擎软件归档继续有效；小智语音、双矩阵、GPIO/按钮及电源真机未验证。当前文档更新不等于新软件已开发。
