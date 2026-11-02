# 最近工作交接

- **日期**：2026-11-02
- **本次任务**：收到 ESP32-S3 开发板正面及 LED 矩阵背面照片，并静态检查两个教程 ZIP；核对固件的真实芯片目标，继续维护分批到货路线。
- **现在有的实物**：ESP32-S3 N16R8、面包板、跳线、按钮、Type-C 线，以及标有创乐博 MAKEROBO / I2C 16x16 LED Matrix Board for Raspberry Pi 的矩阵板（+5V/GND/SDA/SCL）。
- **没到货**：INMP441、MAX98357、扬声器、0.91 英寸 OLED。
- **本次新证据**：ESP 模组丝印为 `ESP32-S3-N16R8`，有两个 USB-C/BOOT/RST；LED 矩阵背面明确有两颗 Holtek HT16K33A，原厂要求 4.5–5.5V；**仍未核验 GPIO 5V 安全性**。
- **固件审查**：上传的 `v2.5.2_bread-compact-esp32-128x32.zip` 与上游 ZIP SHA-256 匹配，但目标为普通 ESP32，**不适用 ESP32-S3**；另一 ZIP 为含 EXE 的烧录工具，尚未运行或证实官方来源。参见 [FLASH_FILES](FLASH_FILES.md)。
- **当前任务入口**：[Issue #1 主板核验](https://github.com/Qi0331/MuSSE/issues/1)、[Issue #2 USB 检测](https://github.com/Qi0331/MuSSE/issues/2)、[Issue #11 LED 电平/地址/供电验证](https://github.com/Qi0331/MuSSE/issues/11)、[Issue #4 固件准备](https://github.com/Qi0331/MuSSE/issues/4)。
- **没有做过**：任何硬件通电、USB 测试、烧录或语音功能验证；不能把代码计划视为实测结果。
- **下一位 Agent**：首先核对 [Issue #1 开发板实物型号](https://github.com/Qi0331/MuSSE/issues/1)，再做 [#2 USB 枚举](https://github.com/Qi0331/MuSSE/issues/2) 和 [#10 最小实验](https://github.com/Qi0331/MuSSE/issues/10)。LED [#11](https://github.com/Qi0331/MuSSE/issues/11) 两颗芯片已确认，继续核对 5V 上拉和供电；在通过电气检查前**不许接线**。不要将普通 ESP32 目标固件刷入 S3。
- **参考源**：[docs/REFERENCES.md](REFERENCES.md)，重要技术路径以锁定版本的上游实现为准。
- **权限边界**：Public 仓库不上传个人/校园敏感信息。涉及真实硬件刷写、敏感外部操作前需得到明确授权。

## 每次工作结束时更新的模板

- 日期 / Issue / PR：
- 实际完成了什么（证据链接）：
- 实际运行的命令及结果：
- 哪些仍未验证：
- 风险或阻塞：
- 下一步和负责人：
- STATUS / TEST_LOG / DECISIONS 是否同步：
