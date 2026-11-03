# MuSSE 当前项目状态（唯一权威）

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
