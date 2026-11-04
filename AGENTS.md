# MuSSE — Agent 工作约定

## 2026-11-04 S5-B 最新优先级（覆盖下面历史 S4 下一步建议）
- 用户明确要求跳过 S4-E 目标/笔记额外验收，直接开发 S5 受控语音写入，并减少零散确认；不要再推荐恢复已取消的 S2-B 测试。
- 新 S5 分支 `feat/iwiki-s5-guarded-write-design`，Draft PR #25 **以 S4 功能分支为 base**；原 PR #24 仍 Draft 未合并。S5 安全设计见 `docs/IWIKI_S5_SECURITY_DESIGN.md`，最新状态和测试以 `docs/STATUS.md`、`docs/TEST_LOG.md`、`docs/HANDOFF.md`、D-019 为准。
- S5-B 离线核心门禁、变更规划器、两份测试已提交；仅在隔离 Node 22.16 实测核心门禁 13/13 通过，真实 Markdown 规划测试和完整 `npm test` 尚未运行。不能将此表述为生产写入成功。
- **禁止**将 `src/mcp/server.ts` 旧 13 工具服务接入生产、复用模型声明作为用户确认、在没有已证实的官方原子条件写入支持时整篇覆写任务表。未接入可信确认通道和远端写适配器；不得读取或泄露 Token、真实文档 ID、私人日志。
- 官方 `iwiki` 与现有 `musse_iwiki_readonly` 两 MCP、Windows 日志脱敏补丁及防火墙、Muse 角色提示词、ESP32 固件与真实 iWiki 数据保持不变。后续仅在明确授权下进行真实写入、凭证升级、桥接配置或部署。


## 2026-11-04 S4-D 最新优先级（覆盖下方旧 S4 待审状态）

- 新对话先读 `docs/IWIKI_S4D_FINAL_HANDOFF.md`、`docs/STATUS.md`、`docs/TEST_LOG.md`、`docs/HANDOFF.md`。用户现场验收：官方 `iwiki` MCP 与新 `musse_iwiki_readonly` MCP 正常，新服务六工具可见并确认被调用；任务数量、今日、近期/逾期、普通聊天自然语言场景均正常。现有 Windows 指定离线 10/10、真实任务表统计 3/2/1/0、stdio 工具白名单写入拒绝有用户终端证据；逐次原始调用日志未独立采集。
- S4-D 的**任务/日程语音链路按用户报告通过**，不能扩大为目标/笔记已通过；两者虽有只读工具但私有文档 ID 未映射。S2-B 人工三文档验收保持取消，S5 受控写入未授权。
- iWiki 唯一持久化；Windows 原有日志脱敏补丁、防火墙 9999 入站阻断、`xiaozhi-client@2.3.0`、ESP32 固件和 Muse 现行角色提示词不改。功能分支 `feat/iwiki-s2a-readonly-contract` / PR #24 **Draft 未合并**；不得上传私密文档 ID、Token、配置、日志，不因新对话重复部署或擅自开放写入。


## 2026-11-04 当前 iWiki 阶段覆盖（优先于以下历史快照）

- 新对话先阅读 `docs/IWIKI_S4_HANDOFF.md`、`docs/STATUS.md`、`docs/HANDOFF.md` 和 `docs/IWIKI_S3_PROMPT_CURRENT.md`；以用户已配置的现行 MuSSE 人设与 iWiki 只读提示词为准，不擅自修改已生效角色介绍。
- S2-A 的真实只读任务查询和用户报告的设备语音读取成功保留。用户明确取消 S2-B 三篇虚构文档与 Windows/设备繁琐验收；目标和笔记的真实 S2-B 验收仍未完成。不要重新催促测试或虚报通过。
- S4-A 仅是等待用户审查的**下一阶段方案**（只读业务能力接入方式），不代表自动批准修改桥接或部署自研 MCP。
- S5 受控语音写入是已确认的**后续产品目标**，但没有当下写权限、真实数据写入或服务端部署授权；严格保持现有 Windows `xiaozhi-client`、固件、防火墙和脱敏补丁不变。
- 当前继续使用官方 iWiki MCP，草稿 PR #24 未合并 `main`。详见 D-015。

## 2026-11-03 最新交接覆盖：MuSSE → 小智云端 → Windows MCP → iWiki 语音查询已成功（最高优先级）

- **已实测完成**：用户确认新 ESP32-S3 已完成小智配网、绑定既有 `MuSSE` 智能体并可正常双向语音；`xiaozhi-client v2.3.0` 在 Windows 本地连接小智接入点（WebSocket 1/1）和 iWiki 远程 MCP（服务 1/1）。用户截图展示约 27 个 iWiki 工具，`list_spaces` 真实返回 `ok:true` 与 41 个可访问空间；用户随后报告设备端语音查询成功。**不再把小智绑定、语音闭环和 iWiki 接入视作未完成任务**。
- **已完成的是第三方远程 MCP 直连桥接**：`ESP32 → 小智官方云端 → Windows xiaozhi-client → https://ssemarket.cn/iwiki-api/mcp`，不是运行本仓库 `software/musse-iwiki/src/mcp/server.ts` 的任务/日程/笔记工具；后者真实远程读写与冲突处理仍未验收（29 项仅离线测试）。
- **启动入口**：Windows PowerShell 执行 `Set-Location "$HOME\MuSSE-MCP-Local\musse-bridge"` 和 `xiaozhi start`，保持窗口运行且电脑不睡眠，浏览器 `http://localhost:9999/dashboard` 检查连接。完整操作与安全边界见 [Windows 本地 iWiki MCP 运行手册](docs/IWIKI_LOCAL_MCP_RUNBOOK.md)。
- **安全**：本机 TCP 9999 已配置 Windows 入站阻止规则，本机仍可访问；早期假 Token 测试确证 iWiki Authorization 曾进入日志，用户已在安装包的 `WebServer.js`、`WebServerLauncher.js` 修复两处，假令牌复测两项均为 False。补丁仅在本机，不得将真实配置、备份、日志或私人知识库数据入库；重新安装客户端可能覆盖补丁。iWiki 只读令牌的服务端写权限**未做负向验证**，工具启用开关最终状态待核实。
- **当前策略**：Windows 本地版本先用，不部署腾讯云；原有 MuSSE 语音工作正常，不重刷固件、不再重复以前 COM7 下载模式排障；D-013 单 iWiki 数据源与被动查询保持。若用户开启新对话，先读最新 [STATUS](docs/STATUS.md)、[HANDOFF](docs/HANDOFF.md)、[TEST_LOG](docs/TEST_LOG.md) 和运行手册，再等待用户的新任务。下面章节是历史快照。


## 2026-11-03 最新交接覆盖：COM7 启动问题已由用户报告恢复（优先于下面排障快照）

- 用户在本次硬件联调对话中明确表示“已经好了。目前的模块都配置好了”。因此此前反复出现的 `boot:0x0 (DOWNLOAD(USB/UART0))` **不再视为当前未解决的阻塞**；但**恢复时具体做了什么、根因是什么、裸板测试是否执行**均未回传，不能倒推为 GPIO0、FT232R 或某条外设线故障已确诊。
- OLED、INMP441、MAX98357 系列功放、扬声器等“已配置好”仅是用户口头完成报告；没有新的逐线核验、串口证据、显示/录放音或稳定性测试记录，仍不能标记逐项真机验收通过。
- 本轮已向用户说明小智 `v2.5.2 / bread-compact-wifi` 参考流程：手机连接设备临时配网热点、填写 2.4GHz Wi-Fi、设备联网后获取激活信息、到 `xiaozhi.me` 给现有 MuSSE 智能体绑定设备。**这是操作指导，尚未收到配网成功、官方账号绑定成功、语音闭环成功的回报。**
- 下一对话应先核对当前联网、绑定与语音状态，不应无故重走 BOOT/GPIO0 排障、Hello World、重刷、全擦或 eFuse。固件仍为 Reasonix 报告的 `v2.5.2/bread-compact-wifi` 五镜像（新板 FT232R/COM7；与 CH343/COM6 旧板区分）。
- iWiki V1 第二阶段 S2-A 工作包尚未发送，软件开发继续暂停；D-013 单数据源路线有效；不连接私人 MCP、不云部署；MuSSE 与 Muse 个人 Agent 严格隔离。以后以 `docs/STATUS.md`、`docs/TEST_LOG.md` 和 `docs/HANDOFF.md` 的最新覆盖为准。


## 2026-11-03 新对话必读更新（优先于下方 2026-11-02 快照）

- **当前任务已切到新 ESP32-S3 硬件启动排障**；iWiki V1 第二阶段明确暂停，S2-A 工作包尚未交 Reasonix。保持 D-013 产品路线，不动 iWiki 代码/私有账号，详情以 [docs/STATUS.md](docs/STATUS.md) 为准。
- 新板 `YD-ESP32-23 2022-V1.3`，FT232R/COM7（与旧 CH343/COM6 不同），小智 `v2.5.2/bread-compact-wifi` 五镜像已由 Reasonix 报告烧录 5/5 校验通过且**曾启动进配网**。用户回传当前 `boot:0x0 (DOWNLOAD(USB/UART0))`，仍未定位原因；不得直接判为烧错程序、不得无故重刷。新板原厂 Flash 用户明确选择不备份。
- OLED、INMP441、功放、扬声器及基础配件已到货，用户称已接好但功能和实际接线尚未核验；两种 LED 矩阵、电平转换及外置电源本批尚未到，无万用表、电脑 USB 供电。优先核实裸板与 GPIO0/BOOT/自动下载电路，不让外设在不安全条件下通电。
- 下方“当前事实（2026-11-02 晚间）”为历史快照，不可用其“尚未烧录/未到货”等文字覆盖上述新进展；详细证据见 [docs/TEST_LOG.md](docs/TEST_LOG.md) 与 [docs/HANDOFF.md](docs/HANDOFF.md)。

本文件是接手本仓库的 AI 编程 Agent 的项目规则。以实际仓库、Issue 和真实测试结果为准；不得把聊天记录里未同步的设想当作已实现的功能。

## 必须按顺序阅读

1. 根目录 `README.md`：目标和入口。
2. `docs/STATUS.md`：**唯一权威的当前完成状态**与最近任务。
3. `docs/HARDWARE.md`、`docs/UPSTREAM.md`、`docs/ARCHITECTURE.md`：硬件、上游基线和系统边界。
4. `docs/REFERENCES.md`：按阶段查阅已核对的上游、社区和官方开发文档；不要仅凭链接就判断硬件已兼容。
5. `docs/DECISIONS.md`、`docs/TEST_LOG.md`、`docs/HANDOFF.md`：决策、证据与近期交接。
6. 查看 GitHub Issues / PR，确认用户实际指派的任务；没有明确任务不擅自扩展范围。

## 当前事实（2026-11-02 晚间）

- 当前以 M0 向 M1 的软件研发过渡：已完成最小 ESP-IDF Hello World 真机烧录运行；后续优先开展小智状态接口分析、硬件无关表情引擎及离线单测；按钮和 LED 电气接线仍待核验。
- 已到手：ESP32-S3 N16R8、面包板、跳线、按钮、USB 数据线及创乐博 16×16 I²C LED 矩阵（2×HT16K33A）。**INMP441、MAX98357、扬声器、OLED 尚无到货确认**。用户另购 WS2812B 16×16 RGB 矩阵、BSS138 四路电平转换、标称 5V/3A 适配器、14500 供电模块（仅商品图，未实物核验）；与已到手器材须分开记录。
- 原创乐博 I²C LED 矩阵的 SDA/SCL 是否被拉到 5V 未知，严禁未经电平核验直接接 ESP32-S3 GPIO；另购 WS2812B 使用不同驱动且可能需要远高于原模块的供电电流，仍禁止通电。见 `docs/LED_MATRIX.md`。
- 上游固定研究候选为 `78/xiaozhi-esp32` 的 `v2.5.2` / `bread-compact-wifi`；Reasonix 已报告本地编译成功，**但没有烧录或运行语音，更不是已运行的 MuSSE 固件**。
- **当前已由 Reasonix 本地报告完成**官方 Hello World 真机烧录/串口自动重启、小智 v2.5.2 参考板本地完整构建；独立 GPIO/按钮工程只有本地编译且默认关闭。仍无正式 MuSSE 集成固件、服务端、语音真机闭环；**严禁编造或扩大已完成测试范围**。原始本地源码、备份和完整日志未上传仓库。
- 仓库按团队明确决定保持 Public。

## 供电决策

- 用户选择 USB 5V 常供电桌面原型，当前**不接电池**。购买的 14500 供电模块不自动纳入正式方案。未经核验不可并联 USB 与另一 5V 支路，勿假定 5V/3A 能带动 256 RGB 全亮。
- 任何任务都要区分用户亲测、Reasonix 报告、公开原厂资料、商品页宣传与软件设计推测。

## 每次工作的闭环

1. 先阅读 STATUS、当前 Issue；复述事实、未知、范围与验收标准。
2. 只做被授权的改动；复杂技术方案、依赖升级、引脚变更、硬件购买或生产部署必须先讨论。
3. 常规改动请使用功能分支和拉取请求（Pull Request，PR）；不要直接改 `main`。初始化等经过明确授权的一次性操作例外。
4. 运行真实存在的检查：`python scripts/check_repo.py`；没有固件构建系统时不要虚构编译命令。
5. PR 写清变更内容、执行的命令与结果、无法验证的部分、风险和回滚方式。
6. 任务结束时按需**同一个 PR**更新：`docs/STATUS.md`（阶段/进度变化）、`docs/TEST_LOG.md`（真实测试）、`docs/DECISIONS.md`（新决策）、`docs/HANDOFF.md`（交接内容）。
7. 在 Issue 中留下与 PR、测试记录对应的可追溯链接；不可仅凭文档复选框宣称完成。

## 权限与安全

- 不得未经明确逐次确认就刷写真实设备、连接带风险的外围电路、发送外部消息、删除内容、消费、公开私密材料或修改仓库权限。
- 公共仓库不要包含 Wi-Fi 密码、API Token、设备私钥、校园内部资料、未脱敏订单和个人信息；检查日志、截图、Issues 和历史提交。
- 引脚接线必须由**实物丝印 + 模块规格 + 固件配置**交叉核对，不可把候选源码中的 GPIO 当作已经测通。
- 未经许可不得调用或抓取校园系统；长期记忆与提醒需要授权、访问控制和可靠性设计。
- 不要自动更新上游版本；版本变更需 Issue、决策记录与回归测试计划。

## 新 Agent 的第一条状态汇报

用 5–10 行交代：当前阶段、已证实事实、当前 Issue、风险/未知、准备做什么与验收方法。对仓库外无法核实的对话或物理测试，明确标注未知。
