# MuSSE

**MuSSE** 是一个基于 ESP32-S3 和小智 AI（xiaozhi-esp32）的软硬件结合式 AI 陪伴机器人项目。

> **当前状态请以 [docs/STATUS.md](docs/STATUS.md) 为准。** 当前已有真实 Hello World 烧录运行记录；语音和矩阵仍未验证。

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

## 最新进展（2026-11-02 晚间）

**M0 实际设备进度**：ESP32-S3-N16R8 已通过 ESP-IDF v6.1 Hello World 的本地编译、授权烧录、串口运行和自动重启验证；原 Flash 已本地安全备份。GPIO/按钮实验工程已本地构建，尚未上板。**小智 v2.5.2 / bread-compact-wifi 已本地构建成功，但从未烧录或验证语音。** 以上以用户转交 Reasonix CLI 报告为依据，未直接核验另一台 Windows 主机的二进制文件。权威详情：[STATUS](docs/STATUS.md) / [TEST_LOG](docs/TEST_LOG.md) / [HANDOFF](docs/HANDOFF.md)。

**新硬件变化**：除了现有创乐博 2×HT16K33A 的 **I²C 16×16 LED 矩阵**，用户还购买了一款单独的 **5V WS2812B 16×16 RGB 矩阵**、四路双向电平转换模块、标称 5V/3A USB 适配器和 14500 电池供电模块（均依据商品截图，实物/电气未核验）。**I²C 矩阵和 WS2812B 不能套用同一套驱动，电平转换器也需匹配具体信号接口。** 当前供电策略为 **USB 5V 长期有线桌面运行，不采用电池**。未经核验禁止给 LED 矩阵接线或上电。

## 实物与采购状态

已到货的主板、按钮、创乐博 I²C LED 矩阵及尚未到货的音频/OLED 清单，见 [HARDWARE](docs/HARDWARE.md)。新买的 5V WS2812B RGB 矩阵与旧 I²C 模块属不同硬件，实际到货和电气均未核实；有关购买后续请看 [LED_MATRIX](docs/LED_MATRIX.md)。

## 文档索引

- [项目状态](docs/STATUS.md)（唯一权威进展记录）
- [软件产品 V1：待办、长期目标与 iWiki 知识库](docs/PRODUCT_V1.md)（2026-11-03 已确定的 B+C 开发范围）
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
