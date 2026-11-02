# MuSSE 当前项目状态（唯一权威）

- **最后更新**：2026-11-02（M0 芯片只读通信与本地构建结果同步）
- **阶段**：M0 — 现有硬件基础验证；M1 语音功能等待配件到货
- **仓库**：[Qi0331/MuSSE](https://github.com/Qi0331/MuSSE)，`main`，Public
- **软件现状**：仓库内仍只有项目文档、协作规则和检查脚本；Windows 另一台电脑上已用 ESP-IDF v6.1 成功编译**本地官方 Hello World 示例副本**，**未提交源码或固件、未烧录、未验证设备端运行**；尚无 MuSSE 集成固件或后端
- **证据性质**：实物照片确认模块丝印；用户亲自完成 CH343（COM6）插拔对照，并提供 esptool 只读通信的终端输出；EIM、ESP-IDF 安装与构建结果来自本机 Reasonix CLI 执行报告，仓库维护方尚未独立复验原始日志/二进制文件。**编译成功不代表烧录或板上运行成功**。

## 已到货（2026-11-02）

- **ESP32-S3 N16R8** 主控（实物照片标有 `ESP32-S3-N16R8`，有两个 USB-C 与 BOOT/RST；CH343 插拔对照及 COM6 芯片只读通信已成功；PCB 修订、两枚 USB-C 的各自功能仍待核验）
- 面包板、足量跳线、轻触按钮、Type-C 数据线
- **16×16 LED 矩阵**：照片显示“创乐博 MAKEROBO / I2C 16x16 LED Matrix Board for Raspberry Pi”，引脚标示 `+5V / GND / SDA / SCL`；**背面芯片已确认 2 × Holtek HT16K33A（原厂要求 4.5–5.5V）；I²C 上拉电压、地址、整板耗电仍未知，暂不可接 ESP32-S3 测试**。详见 [LED 矩阵调查](LED_MATRIX.md)。

## 尚未到货（已采购的基础语音配件）

- INMP441 数字麦克风
- MAX98357 系列数字功放
- 扬声器
- 0.91 英寸四针 OLED

未展示实物与电气参数，不得视作已验证。扭动开关尚未核实为已采购件。

## 当前任务顺序

1. [#1 **M0-01** 核验 ESP32-S3 实物排针与 USB 接口](https://github.com/Qi0331/MuSSE/issues/1)
2. [#2 **M0-02** 仅主板 USB 接入 Windows，记录识别结果](https://github.com/Qi0331/MuSSE/issues/2)
3. [#10 **M0-04** 最小 ESP-IDF 实验工程：串口输出 → GPIO → 按钮](https://github.com/Qi0331/MuSSE/issues/10)（依赖 #1/#2）
4. [#11 **M0-05** LED 矩阵芯片、I²C 地址、电压及供电核对](https://github.com/Qi0331/MuSSE/issues/11)（**资料调查可并行，禁止未验电平时上电**）
5. [#3 **M0-03** 语音配件到货后核验接线兼容性](https://github.com/Qi0331/MuSSE/issues/3)
6. [#4 **M1-01** 审核小智候选预编译固件并在授权后完成首次语音闭环](https://github.com/Qi0331/MuSSE/issues/4)
7. [#5 **M0-00** 组员访问权限和分支保护策略](https://github.com/Qi0331/MuSSE/issues/5)（团队管理并行）

## M0 已取得的实际进展（2026-11-02）

- **USB/芯片识别（用户实测）**：拔掉开发板 USB 后 CH343 串口消失、插回后恢复；执行 `py -3 -m esptool --chip esp32s3 --port COM6 --baud 115200 --no-stub flash-id` 成功，读取 ESP32-S3 rev v0.2、40MHz 晶振、16MB Flash、Flash 3.3V；工具列出 8MB embedded PSRAM（**不是 PSRAM 读写测试**）。唯一设备标识未入库。
- **开发环境（Reasonix CLI 本地报告）**：EIM 0.20.1，ESP-IDF v6.1，`idf.py --version` 返回 `ESP-IDF v6.1`；ESP32-S3 GCC 15.2.0、CMake 4.0.3、Ninja 1.12.1、Python venv 3.14.3，`pip check` 无错误。
- **独立最小程序（Reasonix CLI 本地报告）**：在 Windows 本地 `MuSSE-Lab/hello_world` 复制官方 v6.1 示例、`idf.py set-target esp32s3` 和 `idf.py build` 均退出码 0；第二次构建固定为 **16MB / DIO / 40MHz**，PSRAM 未启用，Single App 默认 1MB 分区；应用 `hello_world.bin` 150720 字节。esptool `image-info` 显示应用与 bootloader 镜像头与配置一致。
- **设备端未完成**：未执行 `get-security-info`、未读取/备份原 Flash、未烧录或擦除、未获取板上串口启动日志；GPIO/按钮/LED 均未接线测试。上述示例仅在另一台电脑的本地目录，**不在 GitHub**。详见 [真实记录与证据级别](TEST_LOG.md)。

## 需要区分的三个固件工作阶段

- **独立小实验（先做）**：最小 ESP-IDF 程序，用来学习串口、输入/输出、I²C；已在 Windows 本地复制官方 Hello World 并编译，尚未烧录或运行，不能称为小智语音固件。
- **候选小智预编译固件（配件到货后）**：上游 `v2.5.2 / bread-compact-wifi`；仍需实际板型、文件与外设核对，尚未刷写。
- **MuSSE 自定义集成固件（后续）**：在小智源码基础上有计划地接入 LED、按键和控制能力，必须有构建和回归证据。**独立 demo 和小智固件不会自动同时运行；烧录通常会替换原应用程序。**

## 尚未验证（不能声称完成的事项）

- ESP32-S3 模组型号、CH343 插拔对照及 esptool 芯片通信已验证；**PCB 修订和两个 USB-C 接口的完整功能仍未知**；Hello World 构建已由 Reasonix 本地执行并报告成功，**真实设备烧录、运行与串口日志尚未验证**。
- LED 板已有**两颗 HT16K33A 芯片型号证据**，但具体 I²C 地址、上拉电压、电源电流、像素映射和图案显示尚未验证。
- 麦克风、功放、扬声器、OLED 的接线和语音对话。
- 校园接口授权、后端、提醒功能。
- 团队成员权限或分支保护已完成配置。

## 外部教程 ZIP 的核验结论（未刷写）

- `v2.5.2_bread-compact-esp32-128x32.zip` 虽与上游 v2.5.2 发布版 ZIP 的 SHA-256 匹配，但目标是 **普通 ESP32**（`target: esp32`），**不是已确认的 ESP32-S3-N16R8**，不可用于这块板。
- `flash_download_tool_3.9.7.zip` 是含 Windows EXE/中英文手册的烧录工具归档；未运行 EXE，来源安全性尚需官方渠道核验。
- 当前正确芯片族的候选固件仍为 `v2.5.2_bread-compact-wifi.zip`（`target: esp32s3`），**未检查该附件、未烧录**。详细文件校验见 [FLASH_FILES](FLASH_FILES.md)。

## 最直接的下一步

**下一步仅做只读安全状态检查**：使用 esptool v5.6.0 的 `get-security-info` 检查 Secure Boot / Flash Encryption 等可报告状态；先重新确认当前 CH343 端口，无须重新做已成功的 `flash-id`。未检查完安全限制与原 Flash 保留/备份需求前不申请首次烧录；**任何刷写、擦除或有风险的接线必须单独获得用户明确授权**。同时保留 Issue #1 的 PCB/USB 接口核验任务；LED 的 5V 电气条件未知，仍禁止接 ESP32-S3。

进度变化更新本文件，真实实验记录到 [TEST_LOG](TEST_LOG.md)，设计取舍记录到 [DECISIONS](DECISIONS.md)。分阶段计划见 [ROADMAP](ROADMAP.md)。
