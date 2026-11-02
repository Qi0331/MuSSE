# MuSSE 研发参考文档导航

> 更新与核对：**2026-11-02**。这些是研发时可能需要查阅的资料，并不是要求新手一次性读完。
>
> **资料可信度说明**：小智固件的真实实现以 **[78/xiaozhi-esp32](https://github.com/78/xiaozhi-esp32) 对应锁定版本的源码**为准。**xiaozhi.dev 是社区文档站，不是上游官方站**，内容可能随时间更新。乐鑫官方文档用于确认芯片/驱动行为；实际接线仍须核对模块实物规格。
>
> **阶段**：M0 硬件识别；M1 首次烧录与语音闭环；M2 自定义硬件；M3 校园检索/服务；M4 长期记忆与提醒。当前处于 **M0**。

## 先读哪些（最短路径）

| 现在的任务 | 最值得优先打开的资料 |
| --- | --- |
| **M0：确认开发板** | [硬件搭建](https://xiaozhi.dev/docs/usage/hardware-guide/) · [支持板型](https://xiaozhi.dev/docs/usage/supported-boards/) · [参考 GPIO](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/config.h) · [GPIO 规范](https://docs.espressif.com/projects/esp-idf/zh_CN/v6.1/esp32s3/api-reference/peripherals/gpio.html) |
| **M1：烧录、激活和对话** | [固件下载](https://xiaozhi.dev/docs/usage/firmware-download/) · [发布页](https://github.com/78/xiaozhi-esp32/releases/tag/v2.5.2) · [首次激活](https://xiaozhi.dev/docs/usage/activation/) · [网络配置](https://xiaozhi.dev/docs/usage/network-setup/) · [FAQ](https://xiaozhi.dev/docs/usage/faq/) |
| **M2：修改屏幕、按键与灯阵** | [自定义板型](https://xiaozhi.dev/docs/development/custom-board/) · [固件代码导览](https://xiaozhi.dev/docs/esp32/programming-guide/) · [ESP-IDF 入门](https://docs.espressif.com/projects/esp-idf/zh_CN/v6.1/esp32s3/get-started/index.html) · [设备控制](https://xiaozhi.dev/docs/development/mcp/usage/) |
| **M3：知识检索与后端** | [设备/服务端分工](https://xiaozhi.dev/docs/ai-features/) · [自建服务端](https://xiaozhi.dev/docs/usage/self-hosted-server/) · [MCP 协议](https://xiaozhi.dev/docs/development/mcp/protocol/) · [WebSocket 协议](https://xiaozhi.dev/docs/development/websocket/) |
| **M4：主动提醒** | [异步语音通知](https://xiaozhi.dev/docs/development/notify/) · [自建服务端](https://xiaozhi.dev/docs/usage/self-hosted-server/)；提醒调度与可靠性需 MuSSE 单独实现 |

## 一、原版小智：权威源码与锁定版本

这里所有带 `v2.5.2` 的源码地址均固定到 tag，方便复现，不会自动跳到未来的最新版本。

| 文档或源码 | 用途 |
| --- | --- |
| [小智上游源码仓库](https://github.com/78/xiaozhi-esp32) | 源代码权威入口；不等于 MuSSE 自有工程 |
| [固定候选版本 v2.5.2](https://github.com/78/xiaozhi-esp32/releases/tag/v2.5.2) | 2026-10-11 的发布页；版本仅是候选，未烧录 |
| [候选固件下载文件（bread-compact-wifi）](https://github.com/78/xiaozhi-esp32/releases/download/v2.5.2/v2.5.2_bread-compact-wifi.zip) | 发布资产名称已核对；未下载、未检查校验值 |
| [候选面包板引脚配置 config.h](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/config.h) | 参考 GPIO，不代表已实物核验 |
| [候选板型固件构建参数 config.json](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/config.json) | OLED 128×32 等构建变体 |
| [候选板型驱动 compact_wifi_board.cc](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/compact_wifi_board.cc) | 读源码时看初始化和交互逻辑 |
| [上游自定义开发板（中文原文）](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/custom-board_zh.md) | 源码版本内的板型开发指南 |
| [上游 MCP 协议（中文原文）](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/mcp-protocol_zh.md) | 设备与工具协议细节 |
| [上游 MCP 控制用法（中文原文）](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/mcp-usage_zh.md) | 设备控制工具实践 |
| [上游 WebSocket 协议](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/websocket.md) | 通信协议原始文件 |
| [上游 MQTT + UDP（中文原文）](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/mqtt-udp_zh.md) | 音频与控制传输协议 |
| [上游 BluFi 配网（中文原文）](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/blufi_zh.md) | 原生配网实现文档 |
| [上游 Glyph Push（中文原文）](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/glyph-push_zh.md) | 字形扩展原文 |
| [上游 notify 通知设计](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/notify.md) | 语音通知协议实现说明 |
| [上游 MIT 许可证](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/LICENSE) | 复制、修改、分发上游代码需遵守 |

**注意**：`v2.5.2_bread-compact-wifi.zip` 仅为**候选**，未经实物和烧录验证。未来版本切换必须同步更新 [UPSTREAM](UPSTREAM.md)、[HARDWARE](HARDWARE.md)、[DECISIONS](DECISIONS.md) 与测试记录；不要因为文档里出现链接就自动刷入。

## 二、小智社区文档中心（完整研发相关入口）

总目录：[小智 AI 社区文档索引](https://xiaozhi.dev/docs/)。以下 **27 篇**已按 MuSSE 开发阶段分类。社区文档可能与当前锁定的上游 tag 不完全一致，遇到冲突以固定版本源码为准。

### 基础认识

- [AI 能力与设备/服务端分工](https://xiaozhi.dev/docs/ai-features/)（M0–M3）— 明确设备端、服务端与大模型各负责什么

### 硬件与入门

- [硬件搭建指南](https://xiaozhi.dev/docs/usage/hardware-guide/)（M0）— 元件清单、面包板接线参考；实物须再次核验
- [支持的开发板](https://xiaozhi.dev/docs/usage/supported-boards/)（M0）— 按真实板型和目标芯片确认适配方案
- [ESP32 低成本方案](https://xiaozhi.dev/docs/usage/esp32-budget-version/)（M0）— 理解面包板和低成本实现

### 烧录与使用

- [固件下载与烧录](https://xiaozhi.dev/docs/usage/firmware-download/)（M1）— 获取预编译版本、工具与操作方法
- [首次配网、激活与绑定](https://xiaozhi.dev/docs/usage/activation/)（M1）— 上电启动、绑定设备
- [网络配置](https://xiaozhi.dev/docs/usage/network-setup/)（M1）— Wi-Fi 配网和联网排障
- [功能使用教程](https://xiaozhi.dev/docs/usage/feature-guide/)（M1）— 基础语音对话和设备控制
- [常见问题 FAQ](https://xiaozhi.dev/docs/usage/faq/)（M0–M2）— 新手排错入口

### 开发与固件

- [ESP-IDF 开发环境与编译](https://xiaozhi.dev/docs/development/esp-idf-setup/)（M2）— 从预编译固件转向自己修改源码
- [自定义开发板指南](https://xiaozhi.dev/docs/development/custom-board/)（M2）— 新增板型、固件引脚和板级驱动
- [代码风格指南](https://xiaozhi.dev/docs/development/code-style/)（M2）— 上游风格和维护约定
- [自定义资源（Assets）](https://xiaozhi.dev/docs/development/assets-customization/)（M2）— 唤醒词、字体、表情等资源定制
- [BluFi 蓝牙配网](https://xiaozhi.dev/docs/development/blufi/)（M1–M2）— 设备配网扩展

### 设备与协议

- [MCP 协议规范](https://xiaozhi.dev/docs/development/mcp/protocol/)（M2–M3）— 设备工具注册和调用消息格式
- [MCP 物联网设备控制](https://xiaozhi.dev/docs/development/mcp/usage/)（M2–M3）— 通过 AI 工具调用控制硬件
- [WebSocket 通信协议](https://xiaozhi.dev/docs/development/websocket/)（M2–M3）— 设备和服务端的实时双向通信
- [MQTT + UDP 混合协议](https://xiaozhi.dev/docs/development/mqtt-udp/)（M2–M3）— 控制通道与音频通道的数据格式

### 显示与提醒

- [Emoji 情感显示](https://xiaozhi.dev/docs/development/emotion/)（M2）— 基础表情与情绪显示
- [动态文字 Glyph Push](https://xiaozhi.dev/docs/development/glyph-push/)（M2–M3）— 字库不包含的文字推送
- [异步语音通知（notify）](https://xiaozhi.dev/docs/development/notify/)（M4）— 通知播放；不等于完整提醒调度系统

### 后台与扩展

- [自建服务端](https://xiaozhi.dev/docs/usage/self-hosted-server/)（M3–M4）— 设备迁移至自有服务端的思路与注意事项
- [生态项目与服务端](https://xiaozhi.dev/docs/development/ecosystem/)（M3）— 寻找服务端、客户端及第三方移植方案

### ESP32 深入

- [芯片支持与存储规格](https://xiaozhi.dev/docs/esp32/technical-specs/)（M0–M2）— Flash / PSRAM 与芯片支持边界
- [固件代码导览](https://xiaozhi.dev/docs/esp32/programming-guide/)（M2）— 代码目录、状态机和常见开发方式
- [进阶扩展点](https://xiaozhi.dev/docs/esp32/advanced-features/)（M2–M4）— 唤醒词、网络、MCP 与资源定制
- [ESP32 开发问题排查](https://xiaozhi.dev/docs/esp32/troubleshooting/)（M1–M2）— 编译、烧录、音频与资源排错

## 三、乐鑫（Espressif）官方芯片与开发工具文档

| 官方资料 | 阶段与用途 |
| --- | --- |
| [ESP-IDF v6.1 ESP32-S3 快速入门](https://docs.espressif.com/projects/esp-idf/zh_CN/v6.1/esp32s3/get-started/index.html) | M1–M2：Windows 环境、编译及下载工具链 |
| [Espressif esptool（ESP32-S3）](https://docs.espressif.com/projects/esptool/en/latest/esp32s3/index.html) | M1：烧录工具使用；注意版本差异 |
| [ESP32-S3 GPIO 驱动与引脚限制](https://docs.espressif.com/projects/esp-idf/zh_CN/v6.1/esp32s3/api-reference/peripherals/gpio.html) | M0–M2：引脚复用、启动限制、输入输出 |
| [ESP32-S3 I2S 音频驱动](https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32s3/api-reference/peripherals/i2s.html) | M2：数字麦克风和功放 |
| [ESP32-S3 I2C 驱动](https://docs.espressif.com/projects/esp-idf/zh_CN/stable/esp32s3/api-reference/peripherals/i2c.html) | M2：OLED 等 I2C 外设 |

## 四、后续需要由项目组补充的资料（目前没有准确公开链接）

- **开发板与电子器件原厂手册**：ESP32-S3 开发板准确 PCB 版型，以及 **INMP441、MAX98357、OLED 控制器、LED 灯阵、扭动开关**的实际供应商规格书；拿到实物型号后再填精确链接，避免混用不同模块版本。
- **软工集市、iWiki**：接口文档、访问授权、数据使用边界目前待确认；不得把私人访问地址或访问令牌放入 Public 仓库。
- **MuSSE 后端**：待选技术栈与服务部署方式确定后，再记录实际 API、部署与安全文档。
- **硬件电路图**：只有在实物供电、引脚和驱动能力核验后，才能把接线图标注为“正式可用”。

## 五、维护规则（供组员和 Agent）

1. 新增资料记录**标题、来源、准确链接、适用阶段**；含版本依赖时记录 tag/commit。
2. 区分 **上游原始源码**、**第三方社区文档**、**乐鑫官方硬件文档**。
3. 链接存在不代表教程适合当前实物。任何接线/烧录结论须以实际板型和测试证据为准。
4. 只把真实用到且合法公开的资料提交到仓库；外部网页可能改版或失效，定期复核。
