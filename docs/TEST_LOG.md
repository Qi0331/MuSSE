# 实验与测试日志

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
