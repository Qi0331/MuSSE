# 实验与测试日志

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
