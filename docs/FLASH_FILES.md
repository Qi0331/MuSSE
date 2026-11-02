# 外部教程烧录工具与固件包：离线核验记录

> 日期：2026-11-02。仅检查用户提供的 ZIP 内部文件与静态二进制数据；**未执行 EXE、未上电修改硬件、未进行烧录**。不在 Public 仓库上传第三方 ZIP 或可执行文件。

## 1. 烧录工具包（PC 端）

- 上传文件：`flash_download_tool_3.9.7.zip`
- ZIP 文件大小：**21,629,982 字节**
- SHA-256：`4fc5464df6aa6462da8f32fd01ff868b779215a9a123e6ffc5e8b80ee3da908d`
- 包内：`flash_download_tool_3.9.7.exe`、`doc/Flash_Download_Tool__cn.pdf`、`doc/Flash_Download_Tool__en.pdf`、`doc/release_note.txt`，以及空的子文件夹。
- 内置更新说明声称 v3.9.7 支持 ESP32-P4，v3.9.4 支持 ESP32-S3 相关安全烧录功能；**这只能确认文件自述，不能证明下载来源可信**。
- 用途：PC 上为 ESP 系列控制器刷写镜像。工具与实际固件镜像是不同东西。
- 结论：可在从**乐鑫官方渠道**核验来源和版本后考虑使用；不建议直接运行来源不明的 EXE。
- 官方参考：[Flash 下载工具使用指南（ESP32-S3）](https://docs.espressif.com/projects/esp-test-tools/zh_CN/latest/esp32s3/production_stage/tools/flash_download_tool.html)。

## 2. 小智预编译固件包（设备端）

- 上传文件：`v2.5.2_bread-compact-esp32-128x32.zip`
- ZIP 文件大小：**1,502,206 字节**
- SHA-256：`e8d8b9dc7e3a68b2c3cc71864268b31d7ac06b81ba2119c5c1c97aa2587de513`
- 归档内容：单一 `merged-binary.bin`，**3,415,609 字节**。
- 与小智 [v2.5.2 发布页](https://github.com/78/xiaozhi-esp32/releases/tag/v2.5.2) 公布的 ZIP SHA-256 完全匹配；可认定为发布页的对应归档。
- 镜像静态观察：`0x1000` 引导镜像标记，`0x8000` 分区表，`0x10000` 应用镜像；**没有执行镜像**。
- 关键上游参数：[main/boards/bread-compact-esp32/config.json](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-esp32/config.json) 明确为 `"target": "esp32"`；`128x32` 是屏幕构建选项，**不是芯片兼容性标志**。
- 实际硬件的模组照片是 `ESP32-S3-N16R8`。两者是不同目标芯片，**不得将该包刷入本开发板**。

## 3. 当前应考虑的版本

- [ESP32-S3 参考板构建配置](https://github.com/78/xiaozhi-esp32/blob/v2.5.2/main/boards/bread-compact-wifi/config.json) 明确是 `"target": "esp32s3"`；其默认构建选项为 SSD1306 128×32。
- [ESP32-S3 变体发布包](https://github.com/78/xiaozhi-esp32/releases/download/v2.5.2/v2.5.2_bread-compact-wifi.zip)：`v2.5.2_bread-compact-wifi.zip`，**尚未下载、哈希核对、校验具体实物适配或实际烧录**。
- 即使芯片族正确，麦克风、功放、OLED 和 LED 矩阵的**实际接线、电压、地址和自定义驱动**都还需要分别验证。
- **LED 矩阵不属于该预编译固件默认支持的设备功能**；不能只把 5V/I²C 接上就自动显示表情。

## 正式烧录前的检查项

- [ ] ESP32-S3 两个 USB-C 接口的实际用途和电脑设备识别
- [ ] 选择与设备芯片匹配的固件包、版本、校验值、下载地址和烧录工具
- [ ] 备份或记录要替换的现有固件/设置（如果有）
- [ ] 检查正确的镜像地址和工具参数，不把普通 ESP32 的配置照搬到 ESP32-S3
- [ ] 负责人明确同意后才实际烧录，记录到 [TEST_LOG](TEST_LOG.md)
