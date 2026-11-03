# 实验与测试日志

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
