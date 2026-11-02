# MuSSE

**MuSSE** 是一个基于 ESP32-S3 和小智 AI（xiaozhi-esp32）的软硬件结合式 AI 陪伴机器人项目。

> **当前状态：M0（已到货硬件识别、单板编程与 LED 矩阵安全调查）。** 截至 2026-11-02，尚无已验证运行的 MuSSE 固件、硬件接线或语音对话测试。最新事实见 [项目状态](docs/STATUS.md)。

## 项目目标

1. **基础语音交互**：复用小智的语音输入、音频播放及网络对话能力。
2. **实体交互**：已到手的按键和 16×16 LED 矩阵；OLED 等待到货，扭动开关属于后续计划。
3. **软件扩展（规划）**：经合法授权后接入校园资源检索、快捷记录、长期记忆和主动提醒。

这是自主的 MuSSE 工程仓库，**不是**小智上游的官方仓库。当前先记录硬件、技术决策与实验，不急于直接复制整个上游固件源码。

## 新成员 / 新 Agent 从哪里开始

| 对象 | 阅读顺序 |
| --- | --- |
| 新组员 | README → [STATUS](docs/STATUS.md) → [HARDWARE](docs/HARDWARE.md) → [Issues](https://github.com/Qi0331/MuSSE/issues) |
| 编程 Agent | **[AGENTS.md](AGENTS.md)** → STATUS → 指派的 Issue → 相关代码或文档 |
| 负责固件 | [UPSTREAM](docs/UPSTREAM.md) → HARDWARE → [TEST_LOG](docs/TEST_LOG.md) |
| 负责规划 | [ROADMAP](docs/ROADMAP.md) → [DECISIONS](docs/DECISIONS.md) → [HANDOFF](docs/HANDOFF.md) |

## 目前可用的实物（2026-11-02）

- **已到货**：ESP32-S3 N16R8（型号与排针仍需实物核验）、面包板、跳线、按钮、Type-C 数据线；**创乐博 MAKEROBO 16×16 I²C LED 矩阵**（照片可见 `+5V / GND / SDA / SCL`，芯片和电平未确认）。
- **尚未到货**：INMP441 麦克风、MAX98357 功放、扬声器、0.91 英寸四针 OLED。
- **尚未确认购买**：扭动开关。

**现在的实际顺序**：开发板实物核验 → Windows USB 识别 → 独立 ESP-IDF 串口/按钮实验；LED 矩阵先调查控制器和 5V/I²C 电平，安全后再接线。语音组件到货后才进入小智预编译固件语音闭环；再将硬件功能集成到自定义固件。

候选上游为小智 `v2.5.2 / bread-compact-wifi`（芯片族为 ESP32-S3）。外部教程给的 `bread-compact-esp32-128x32` 针对**普通 ESP32**，不应刷到当前 ESP32-S3-N16R8。**未刷写或测试**，不能把上游示例引脚直接认定为当前实物的接线图。

详见 [当前状态](docs/STATUS.md)、[阶段路线](docs/ROADMAP.md)、[LED 模块调查](docs/LED_MATRIX.md)。

## 文档索引

- [项目状态](docs/STATUS.md)（唯一权威进展记录）
- [硬件档案](docs/HARDWARE.md)
- [16×16 LED 矩阵调查与安全检查](docs/LED_MATRIX.md)
- [烧录工具与固件文件核验](docs/FLASH_FILES.md)
- [上游依赖](docs/UPSTREAM.md)
- [研发参考资料总导航](docs/REFERENCES.md)
- [系统架构草案](docs/ARCHITECTURE.md)
- [路线图](docs/ROADMAP.md)
- [决策记录](docs/DECISIONS.md)
- [测试记录](docs/TEST_LOG.md)
- [交接记录](docs/HANDOFF.md)
- [贡献指南](CONTRIBUTING.md)
- [安全说明](SECURITY.md)

## 参考资料

> **完整的分阶段用途、版本记录与来源说明见 [研发参考文档导航](docs/REFERENCES.md)**。无需一次性通读；先看当前阶段资料。小智上游源码是版本权威，**xiaozhi.dev 是非官方社区文档站**，乐鑫官方文档用于确认芯片和驱动行为。

### 小智项目源码与候选固件（固定到 v2.5.2）

- [小智上游仓库](https://github.com/78/xiaozhi-esp32) · [v2.5.2 发布页](https://github.com/78/xiaozhi-esp32/releases/tag/v2.5.2) · [bread-compact-wifi 候选发布包](https://github.com/78/xiaozhi-esp32/releases/download/v2.5.2/v2.5.2_bread-compact-wifi.zip)
- [参考 GPIO 配置](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/config.h) · [板型构建配置](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/config.json) · [对应板型实现](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/compact_wifi_board.cc)
- [上游自定义开发板（中文）](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/custom-board_zh.md) · [上游设备控制用法（中文）](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/mcp-usage_zh.md) · [上游协议文档](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/mcp-protocol_zh.md) · [MIT 许可证](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/LICENSE)

### 小智社区文档（按开发用途分组，共 27 篇）

社区总入口：[小智文档索引](https://xiaozhi.dev/docs/)。

**基础认识**

[AI 能力与设备/服务端分工](https://xiaozhi.dev/docs/ai-features/)

**硬件与入门**

[硬件搭建指南](https://xiaozhi.dev/docs/usage/hardware-guide/) · [支持的开发板](https://xiaozhi.dev/docs/usage/supported-boards/) · [ESP32 低成本方案](https://xiaozhi.dev/docs/usage/esp32-budget-version/)

**烧录与使用**

[固件下载与烧录](https://xiaozhi.dev/docs/usage/firmware-download/) · [首次配网、激活与绑定](https://xiaozhi.dev/docs/usage/activation/) · [网络配置](https://xiaozhi.dev/docs/usage/network-setup/) · [功能使用教程](https://xiaozhi.dev/docs/usage/feature-guide/) · [常见问题 FAQ](https://xiaozhi.dev/docs/usage/faq/)

**开发与固件**

[ESP-IDF 开发环境与编译](https://xiaozhi.dev/docs/development/esp-idf-setup/) · [自定义开发板指南](https://xiaozhi.dev/docs/development/custom-board/) · [代码风格指南](https://xiaozhi.dev/docs/development/code-style/) · [自定义资源（Assets）](https://xiaozhi.dev/docs/development/assets-customization/) · [BluFi 蓝牙配网](https://xiaozhi.dev/docs/development/blufi/)

**设备与协议**

[MCP 协议规范](https://xiaozhi.dev/docs/development/mcp/protocol/) · [MCP 物联网设备控制](https://xiaozhi.dev/docs/development/mcp/usage/) · [WebSocket 通信协议](https://xiaozhi.dev/docs/development/websocket/) · [MQTT + UDP 混合协议](https://xiaozhi.dev/docs/development/mqtt-udp/)

**显示与提醒**

[Emoji 情感显示](https://xiaozhi.dev/docs/development/emotion/) · [动态文字 Glyph Push](https://xiaozhi.dev/docs/development/glyph-push/) · [异步语音通知（notify）](https://xiaozhi.dev/docs/development/notify/)

**后台与扩展**

[自建服务端](https://xiaozhi.dev/docs/usage/self-hosted-server/) · [生态项目与服务端](https://xiaozhi.dev/docs/development/ecosystem/)

**ESP32 深入**

[芯片支持与存储规格](https://xiaozhi.dev/docs/esp32/technical-specs/) · [固件代码导览](https://xiaozhi.dev/docs/esp32/programming-guide/) · [进阶扩展点](https://xiaozhi.dev/docs/esp32/advanced-features/) · [ESP32 开发问题排查](https://xiaozhi.dev/docs/esp32/troubleshooting/)

### 乐鑫官方文档（芯片、驱动与烧录）

- [ESP-IDF v6.1 ESP32-S3 快速入门](https://docs.espressif.com/projects/esp-idf/zh_CN/v6.1/esp32s3/get-started/index.html)
- [Espressif esptool（ESP32-S3）](https://docs.espressif.com/projects/esptool/en/latest/esp32s3/index.html)
- [ESP32-S3 GPIO 驱动与引脚限制](https://docs.espressif.com/projects/esp-idf/zh_CN/v6.1/esp32s3/api-reference/peripherals/gpio.html)
- [ESP32-S3 I2S 音频驱动](https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32s3/api-reference/peripherals/i2s.html)
- [ESP32-S3 I2C 驱动](https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32s3/api-reference/peripherals/i2c.html)

### 暂待确认的资料

实际开发板及电子元件的原厂规格书、软工集市和 iWiki 的合法授权接口文档，待型号/权限确认后补充；**绝不在公开仓库发布令牌、校园内部文件或私人链接**。

## 公开仓库提醒

本仓库按团队决定保持 **Public（公开）**。**不要提交 Wi-Fi 密码、API Token、设备凭证、私人订单、未经授权的校园资料或个人信息。** Git 历史中的泄露内容并不会因为删除文件而自动消失。

本仓库自身许可证尚未确定；引入小智上游代码时须保留适用的 MIT 许可证和版权声明。
