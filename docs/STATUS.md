# MuSSE 当前项目状态（唯一权威）

- **最后更新**：2026-11-02（M0 真机运行闭环与小智 v2.5.2 本地构建后）
- **阶段**：M0 主板基本程序链路已验证，GPIO/按钮及 LED 电气仍待验证；M1 上游语音固件已在 PC 本地构建，**尚未上板运行或实现语音闭环**。
- **仓库**：[Qi0331/MuSSE](https://github.com/Qi0331/MuSSE)，Public。GitHub 仍为文档/规则/检查脚本工程，本地实验代码和小智研究副本**尚未提交**。
- **证据层级**：CH343 插拔及最初芯片只读通信由用户实测；其后的备份、烧录、串口、构建和静态分析来自用户转交的 **Reasonix CLI 本地执行报告**。ChatGPT 未直接访问 Windows 主机或二进制原件。原始设备标识及备份不得公开。

## M0 已完成（来自真实本地报告，不是仅计划）

1. **CH343/芯片**：COM6 对应 USB VID 1A86:55D3；esptool v5.6.0 读得 ESP32-S3 rev v0.2、16 MB Flash、40 MHz 晶振，识别信息列出 8 MB PSRAM（未做运行时读写测试）。
2. **安全状态**：`get-security-info` 退出码 0，Secure Boot Disabled、Flash Encryption Disabled、SPI_BOOT_CRYPT_CNT=0。其他 eFuse 限制并未逐位审计。
3. **原 Flash 本地只读备份**：`C:\Users\Lenovo\MuSSE-Private-Backups\esp32s3_factory_20261102.bin`，16,777,216 字节，SHA-256 `cd0f30ac9491da499eaf2167f07b5accf23cf6779c506110431aa766f346273e`；**不得上传 Public 仓库**。离线解析发现原应用 `led_strip`（ESP-IDF v4.4-dev）、标准 `nvs/phy_init/factory` 布局。
4. **官方 Hello World 真机闭环**：ESP-IDF v6.1；16 MB / DIO / 40 MHz；经用户逐次授权，以 esptool 定点写入 bootloader `0x0`、分区表 `0x8000`、应用 `0x10000`；各自 `Hash of data verified`、退出码 0。CH343 115200 串口报告 5 次 `Hello world!`、4 次自动软件复位后再次启动，未见 panic。**原厂 led_strip 已被覆盖（有本地备份）**。不曾整片擦除或修改 eFuse。
5. **独立 GPIO/按钮工程**：`C:\Users\Lenovo\MuSSE-Lab\gpio_button`，ESP-IDF v6.1，本地 `idf.py build` 退出码 0；30 ms 消抖、低电平有效按钮及可选输出测试已编写，**默认均禁用且未烧录/未接线**。GPIO0/板载 BOOT 关系和具体开发板 PCB 未核验。
6. **小智 v2.5.2 上游研究**：本地研究副本锁定 tag `v2.5.2`、commit `49b4380b3faa0ceadd28a3e78aaf0f311c46c57e`，`bread-compact-wifi`（`esp32s3`）在 ESP-IDF v6.1 下由 Reasonix 报告 `python scripts/build.py bread-compact-wifi --name bread-compact-wifi` 退出码 0。应用 `xiaozhi.bin` 2,577,504 字节；16 MB/DIO/80 MHz、Octal PSRAM 80 MHz、含 assets/OTA 分区。**没有烧录此上游固件、没有 PSRAM 运行时验证，也没有配网/音频实测**。详见 [UPSTREAM](UPSTREAM.md)。

## 已有与新采购硬件（采购不代表到货或实测）

- **已持有并识别**：ESP32-S3-N16R8、面包板、跳线、按钮、USB 数据线；创乐博 **I²C 单色矩阵**（2× HT16K33A，接口 +5V/GND/SDA/SCL，电平、电流、地址未核验；**禁止接线/上电**）。
- **尚无新的到货确认**：INMP441、MAX98357、扬声器、0.91 英寸 OLED（此前已采购、未到货）。
- **用户于 2026-11-02 提供新购商品截图**：标称 5V/3A USB 充电器、**另一块** 16×16 WS2812B 256 像素 5V RGB 矩阵、BSS138 四路 3.3V↔5V 电平转换模块，以及带 14500 电芯的 5V/3.3V 供电模块。**仅商品图/采购口头确认，型号规格、实物到货和性能均未验证。** 新 WS2812B 不等于旧 HT16K33A I²C 矩阵；BSS138 I²C 模块也不能默认适合 WS2812B 高速单线数据。见 [HARDWARE](HARDWARE.md)、[LED_MATRIX](LED_MATRIX.md)。
- **供电方向**：用户最新决定以 **USB 5V 长期有线桌面运行、暂不采用电池** 为主线；已买的 14500 供电模块不自动成为整机方案。适配器标称 5V/3A 不代表能够满足 256 RGB LED 全亮电流，也不能直接并接开发板 USB/5V 引脚。

## 下一步（新对话工作入口）

**以本地软件功能为主，暂停反复基础板测试**：利用上游已确认的 `DeviceStateMachine` 状态变化与 `Led::OnStateChanged()` 接口，独立编写 **16×16 表情帧缓冲、5 种状态表情、动画与 PC 离线单元测试/预览**；先设计与具体 LED 硬件无关的逻辑层，再分别评估 HT16K33A I²C 与 WS2812B 单线 RGB 驱动适配，不立刻选择或接线。等配件到货再做语音真机闭环。

并行待办：核验开发板 PCB/BOOT 引脚；核实两种矩阵的供电电流、电平和数据时序；确认 5V 配电/保护、调试时 USB 反向供电隔离；梳理 #1/#4/#7/#10/#11 的完成范围。阶段性汇总后再提交本地实验源码与可复现构建说明，不直接上传大型上游源码、构建二进制、Flash 备份或私密日志。

## 尚未验证与禁止越界

- 未验证：独立 GPIO/按钮真机；PSRAM 读写；小智 v2.5.2 真机启动、配网、绑定、I²S/语音；OLED；两块 LED 矩阵的安全电气、像素/地址；整机电源长期负载与温升；校园接口、后端和长期记忆。
- 不得将本地编译等同上板可运行；小智参考板 GPIO 不代表本机已确认引脚。任何新固件烧录、Flash 擦除/eFuse 修改或有风险接线均须用户另行明确授权。
- 只在完成并保留真实日志证据后更新状态；外部 Issue 评论仅为建议，不等于硬件实测结论。