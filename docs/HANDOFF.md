# 最近工作交接

- **日期**：2026-11-02
- **阶段**：M0，已验证主板芯片通信和 Windows 本地 ESP-IDF 构建；**尚未烧录或在开发板上运行代码**。
- **执行协作方式**：用户的 ESP32-S3 接在另一台 Windows 电脑。ChatGPT 负责制定操作与验收，一次只提供一个可验证任务；用户将完整提示词交给安装在该电脑上的 **Reasonix CLI** 执行，再回传真实输出。禁止让 Reasonix 自动进入下一阶段；硬件刷写和危险接线须用户逐次明确批准。
- **仓库规则**：Public，不上传设备 MAC、原始 Flash dump、账号凭据或个人资料。通常只在一个开发阶段结束集中更新 GitHub；此次根据用户明确要求提前同步一次文档。
- **当前 Issue**：[M0-01 #1](https://github.com/Qi0331/MuSSE/issues/1)、[M0-02 #2](https://github.com/Qi0331/MuSSE/issues/2)、[M0-04 #10](https://github.com/Qi0331/MuSSE/issues/10)、[LED #11](https://github.com/Qi0331/MuSSE/issues/11)。

## 已有实物与风险

- ESP32-S3-N16R8 开发板（两个 USB-C、BOOT、RST）、USB 数据线、面包板、跳线、轻触按钮。
- 创乐博 MAKEROBO 16×16 I²C LED 矩阵，接口 `+5V/GND/SDA/SCL`，背面 **2 × Holtek HT16K33A**，芯片需 4.5–5.5V；SDA/SCL 上拉电压、I²C 地址、整板电流未知。**严禁直接接入 ESP32-S3，连电源也先不要接**。
- INMP441 麦克风、MAX98357 功放、扬声器、0.91 英寸 OLED 尚未到货。
- 开发板 PCB 修订、两枚 USB-C 各自用途、可用 GPIO 尚未完整核验。

## 已核对的真实进度

1. **用户直接实测**：CH343 USB 转串口在 Windows 显示 COM6，拔掉开发板 USB 后消失，重新插入恢复。
2. **用户直接实测**：`py -3 -m esptool --chip esp32s3 --port COM6 --baud 115200 --no-stub flash-id` 成功；ESP32-S3 revision v0.2，40MHz 晶振，16MB Flash，eFuse Flash 电压 3.3V，识别信息列出 8MB PSRAM；**尚未测 PSRAM 读写**。
3. **Reasonix 本地报告**：Python 3.14.3，esptool 5.6.0；EIM GUI 0.20.1 位于 `C:\Program Files\eim\eim.exe`，官方 WinGet ID `Espressif.eim`。
4. **Reasonix 本地报告**：ESP-IDF **v6.1 正式版**安装于 `C:\esp\v6.1\esp-idf`，工具根目录 `C:\Espressif\tools`；PowerShell 激活脚本 `C:\Espressif\tools\Microsoft.v6.1.PowerShell_profile.ps1`。`idf.py --version` 正确，GCC 15.2.0，CMake 4.0.3，Ninja 1.12.1；**用 PowerShell，不用 Git Bash 运行 idf.py**。
5. **Reasonix 本地报告**：官方 Hello World 副本 `C:\Users\Lenovo\MuSSE-Lab\hello_world`，`idf.py set-target esp32s3`、`idf.py build` 均成功；最终 `sdkconfig` 与镜像头为 **16MB / DIO / 40MHz**、Single App 默认 1MB、PSRAM 未启用。应用镜像 150720 字节，已校验 SHA-256。**源码/编译产物仅在该电脑本地，尚未提交到 GitHub**。
6. **未执行**：安全状态读取、原 Flash 备份、烧录、擦除、设备端 Hello World 日志、GPIO/按钮/LED 测试、语音对话。除 esptool 用户原始终端输出之外，Reasonix 结果为用户转交的执行报告，ChatGPT 未亲自访问设备复验。

详细日志与最终 SHA-256 见 [TEST_LOG](TEST_LOG.md)；权威进度见 [STATUS](STATUS.md)。

## 新对话第一项任务（严格一次一步）

**下一步仅检查设备安全状态**。在 Reasonix CLI 执行前确认只有开发板的 USB 接到 Windows，无任何外设，重新枚举 CH343 端口（上次为 COM6），无串口占用。通过 PowerShell 运行只读命令：

```powershell
py -3 -m esptool --chip esp32s3 --port COM6 --baud 115200 --no-stub get-security-info
```

若 COM 号改变，以实测端口替换。将退出码、脱敏原始输出带回；判断 Secure Boot、Flash Encryption 及 Secure Download Mode 能否确定。不得在输出缺失时猜测；遇到异常停下报告。**禁止任何烧录、擦除、eFuse 修改、原 Flash 读取或备份**（备份是独立的后续决策）。不能假定 ESP32-S3 PSRAM 已经过写读测试。

安全检查完成后，再评估本地原 Flash 备份需求；首次烧录需单独取得用户明确同意。不要将此前不兼容的 `v2.5.2_bread-compact-esp32-128x32.zip` 写入这颗 ESP32-S3。小智候选是 `v2.5.2_bread-compact-wifi.zip`，未核验也未烧录。

## 相关研发与安全边界

- 主线：M0 单板串口/按钮与 LED 安全调查 → M1 语音配件到货后候选小智固件 → M2 源码整合；不擅自改路线。
- LED 矩阵上拉可能为 5V，未经电气核验**不得直连** ESP32-S3 的 3.3V GPIO。
- 每次 Reasonix 完成任务后由用户转交报告；只给下一条单任务提示词，不要求用户自己反复粘贴命令。
- 对 GitHub 尽量阶段末一次更新；公开仓库不提交私人资料或本地 Flash 备份。
