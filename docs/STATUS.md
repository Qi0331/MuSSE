# MuSSE 当前项目状态（唯一权威）

- **最后更新**：2026-11-02（依据用户最新到货清单和 LED 矩阵实物照片）
- **阶段**：M0 — 现有硬件基础验证；M1 语音功能等待配件到货
- **仓库**：[Qi0331/MuSSE](https://github.com/Qi0331/MuSSE)，`main`，Public
- **软件现状**：仅有项目文档、协作规则和仓库检查脚本；**没有已验证运行的 MuSSE 设备端代码或后端**
- **证据性质**：到货状态是成员说明，LED 板有实物照片；**不代表任何电气或软件测试通过**

## 已到货（2026-11-02）

- **ESP32-S3 N16R8** 主控（新实物照片可确认模组金属屏蔽罩标有 `ESP32-S3-N16R8`、开发板有两个 USB-C 与 BOOT/RST 按键；PCB 版本、两个 USB 口功能和 Windows 枚举仍待验证）
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

## 需要区分的三个固件工作阶段

- **独立小实验（先做）**：最小 ESP-IDF 程序，用来学习串口、输入/输出、I²C；尚未创建或烧录，不能称为小智语音固件。
- **候选小智预编译固件（配件到货后）**：上游 `v2.5.2 / bread-compact-wifi`；仍需实际板型、文件与外设核对，尚未刷写。
- **MuSSE 自定义集成固件（后续）**：在小智源码基础上有计划地接入 LED、按键和控制能力，必须有构建和回归证据。**独立 demo 和小智固件不会自动同时运行；烧录通常会替换原应用程序。**

## 尚未验证（不能声称完成的事项）

- ESP32-S3 **模组型号已从照片确认**；开发板 PCB 修订、两个 USB-C 口实际功能、Windows USB 识别、任何编译或设备烧录仍未验证。
- LED 板已有**两颗 HT16K33A 芯片型号证据**，但具体 I²C 地址、上拉电压、电源电流、像素映射和图案显示尚未验证。
- 麦克风、功放、扬声器、OLED 的接线和语音对话。
- 校园接口授权、后端、提醒功能。
- 团队成员权限或分支保护已完成配置。

## 外部教程 ZIP 的核验结论（未刷写）

- `v2.5.2_bread-compact-esp32-128x32.zip` 虽与上游 v2.5.2 发布版 ZIP 的 SHA-256 匹配，但目标是 **普通 ESP32**（`target: esp32`），**不是已确认的 ESP32-S3-N16R8**，不可用于这块板。
- `flash_download_tool_3.9.7.zip` 是含 Windows EXE/中英文手册的烧录工具归档；未运行 EXE，来源安全性尚需官方渠道核验。
- 当前正确芯片族的候选固件仍为 `v2.5.2_bread-compact-wifi.zip`（`target: esp32s3`），**未检查该附件、未烧录**。详细文件校验见 [FLASH_FILES](FLASH_FILES.md)。

## 最直接的下一步

已确认 ESP32-S3 模组标识，**下一步核验开发板的 PCB 型号、两枚 USB-C 端口用途，并完成单板 USB 枚举**（Issue #1/#2）。LED 背面芯片已识别，转向调查 I²C 电平、地址、供电和整板线路（Issue #11）。在这些电气条件未确认前**不接 LED 矩阵电源或 SDA/SCL**。

进度变化更新本文件，真实实验记录到 [TEST_LOG](TEST_LOG.md)，设计取舍记录到 [DECISIONS](DECISIONS.md)。分阶段计划见 [ROADMAP](ROADMAP.md)。
