# 上游来源与版本固定

## 已核对的公开来源

- 上游项目：https://github.com/78/xiaozhi-esp32
- 上游许可证：MIT — https://github.com/78/xiaozhi-esp32/blob/v2.5.2/LICENSE
- 当前**候选**版本：`v2.5.2`（发布于 2026-10-11）
- 发布页：https://github.com/78/xiaozhi-esp32/releases/tag/v2.5.2
- 当前**候选**变体：`bread-compact-wifi`
- 预期固件包：`v2.5.2_bread-compact-wifi.zip`（**尚未下载、解压、核对文件或 SHA256**）
- 对应源码参考：https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/config.h

## 正式采用某版之前必须记录

| 项目 | 当前状态 |
| --- | --- |
| 真实板型与 PCB 修订 | 待核验 |
| 固件变体与发布包链接 | 候选，待确认 |
| 发布来源 / SHA256 | 未验证 |
| 实际刷入版本、工具、操作系统 | 尚未执行 |
| 成功启动、联网、播放、录音证据 | 尚无 |
| 自研修改的上游 commit 与补丁 | 尚无 |

## 依赖维护原则

- 在首次硬件闭环之前，不复制整套小智源码进仓库；不要将大体积固件二进制提交普通 Git。
- 需要二次开发时由 Issue 决定是否采用上游 Fork、受控引入源码或独立固件模块，并锁定具体 tag/commit。
- 上游发布新版本不等于自动升级；升级必须有变更评估与回归测试。
- 分发修改的上游源码/二进制时遵守适用 MIT 许可证，保留版权与许可证文件。

## 文档与源码导航

完整资料分类与使用顺序见 [研发参考文档导航](REFERENCES.md)。本文件仅记录**当前选用/候选的上游版本**；不能把社区页面的最新内容误当成 `v2.5.2` 的正式接口。

重点查看：
- [参考板 GPIO 配置](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/config.h)、[构建配置](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/config.json)、[板级代码](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/compact_wifi_board.cc)
- [上游自定义开发板中文指南](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/custom-board_zh.md)、[小智社区的接线指南](https://xiaozhi.dev/docs/usage/hardware-guide/)
- [上游 MCP 协议](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/mcp-protocol_zh.md)、[上游 MCP 控制用法](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/docs/mcp-usage_zh.md)

## 2026-11-02：外部教程的固件包核验（不适配当前主控）

团队提供 `v2.5.2_bread-compact-esp32-128x32.zip`。已对 ZIP 进行**离线列表、镜像头与 SHA-256 检查，不执行程序或刷写**：

- ZIP SHA-256：`e8d8b9dc7e3a68b2c3cc71864268b31d7ac06b81ba2119c5c1c97aa2587de513`，与[上游 v2.5.2 发布记录](https://github.com/78/xiaozhi-esp32/releases/tag/v2.5.2)一致。
- ZIP 只包含 `merged-binary.bin`（3,415,609 字节），为合并镜像；解析可见普通 ESP32 的 0x1000 引导镜像，0x8000 分区表及 0x10000 应用部分。
- **关键不匹配**：上游 [`bread-compact-esp32/config.json`](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-esp32/config.json) 的 `target: "esp32"`，不是 `esp32s3`；实际主控可见 `ESP32-S3-N16R8`。
- **不可将这个教程提供的 ESP32 固件刷到 ESP32-S3。** 不要误认为名称中的 `128x32` 表示兼容一切 OLED 或 ESP32 系列。
- 候选正确目标是 [`bread-compact-wifi/config.json`](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/config.json)，`target: "esp32s3"`，并且默认 OLED 128×32；但**仍未核验 PCB、引脚或真实音频外设，不构成可直接烧录的判断**。

另一压缩包 `flash_download_tool_3.9.7.zip` 是 Flash 下载器：归档内含同名 Windows EXE、中文/英文 PDF 使用手册和版本说明。离线检查哈希 `4fc5464df6aa6462da8f32fd01ff868b779215a9a123e6ffc5e8b80ee3da908d`。未执行 EXE，亦未证实它来源于乐鑫官网；实际烧录应优先从[乐鑫官方烧录文档](https://docs.espressif.com/projects/esp-test-tools/zh_CN/latest/esp32s3/production_stage/tools/flash_download_tool.html)取工具。文件/校验信息仅供团队定位错误安装包，不将这两个 ZIP 或 EXE 上传公共仓库。

详见 [固件/烧录文件分析](FLASH_FILES.md)。


## 2026-11-02 晚间：v2.5.2 上游已在本地构建（Reasonix 报告）

> 此节**取代**上文“预期固件包尚未下载 / 尚未构建”的早期快照。此次获取的是 **tag 对应的源码研究副本**，而非已验证的 `v2.5.2_bread-compact-wifi.zip` 官方发布二进制；**没有烧录或实际测试语音**。

- 官方源码 `https://github.com/78/xiaozhi-esp32`：tag `v2.5.2`，commit `49b4380b3faa0ceadd28a3e78aaf0f311c46c57e`，本地浅克隆 `MuSSE-Lab/xiaozhi-esp32-v2.5.2`，`git status` 干净；许可证 MIT。
- 在 ESP-IDF v6.1 环境执行 `python scripts/build.py bread-compact-wifi --name bread-compact-wifi`，Reasonix 报告退出码 0；第一次缺 `--name` 时退出码 2，指定后正常。
- 构建目标 `esp32s3`，16MB/DIO/80MHz，Octal PSRAM 80MHz，CPU 240MHz；`partitions/v2/16m.csv` 布局含 `ota_0` / `ota_1` / `assets`；`xiaozhi.bin` 2,577,504 字节、SHA-256 `3c77df039b71f03de25dca21bcd49d91fe8bf591ff7fd8259685feb1d94c7e12`。
- 本地 `flash_args`：bootloader `0x0`，分区表 `0x8000`，OTA data `0xD000`，应用 `0x20000`，assets `0x800000`；与已经运行的 Hello World **0x10000 应用偏移**完全不同，不可互相套用烧录地址。
- 面包板参考 GPIO（**不是本开发板已核验排针**）：麦克风 WS/SCK/DIN `4/5/6`；功放 BCLK/LRCK/DOUT `15/16/7`；OLED SDA/SCL `41/42`；BOOT `0`、触摸键 `47`、音量键 `40/39`；`SingleLed` WS2812 `48`；MCP 测试灯 `18`。原 16×16 HT16K33A I²C 板及新购 16×16 WS2812B RGB 板**均未作为 MuSSE 矩阵驱动在这次构建中集成**。
- 状态机制（源码分析）：`main/device_state.h`，`main/device_state_machine.{h,cc}` 的 `TransitionTo` / `AddStateChangeListener`；`Application::SetDeviceState()` 通知灯/显示；`Led::OnStateChanged()`、`Board::GetLed()`、`Display::SetEmotion(const char*)` 可作为后续桥接点。
- 建议新功能先写硬件无关帧缓冲、表情动画、离线测试与状态映射，再与上游最小侵入适配；不提前拷贝/修改上游大量源码。下次涉及新固件烧录、账号绑定和接口通信须分开授权。
- 研究完整报告仅在 Windows 本地 `MuSSE-Lab/reports/xiaozhi-v2.5.2-analysis.md`；GitHub 此次只提交脱敏摘要，未上传上游副本或任何 .bin。
