# MuSSE 最新交接（持续更新）

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
