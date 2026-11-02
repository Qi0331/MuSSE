# MuSSE 16×16 显示核心（M1）

复用 `78/xiaozhi-esp32` v2.5.2 / `bread-compact-wifi` 的设备状态与情绪语义，
实现小智上游缺少的 16×16 点阵表情渲染、动画、状态适配和可替换输出层。

> 纯软件模块 + Windows 单元测试 + 离线预览 + 隔离固件编译验证。
> 没有烧录、没有接线、没有真机 LED 验证，也没有调用小智云端。

## 当前状态

- 93 个 Windows 单元测试通过（CTest 2/2）。
- 隔离小智固件构建成功（ESP-IDF v6.1，退出码 0）。
- 固件真实调用链：状态/情绪/Alert → `FirmwareEventQueue` → `MusseDisplayService` → `StateAdapter` → `EmotionRenderer` → `NoopSink`。
- 关键控制事件（状态/Thinking/Alert 错误/AlertDismiss）使用独立槽位，不会被普通情绪洪泛丢弃。
- 宿主使用 `std::mutex`，固件使用 FreeRTOS `portMUX` 短临界区；不使用无界自旋等待；固件临界区仍依赖 FreeRTOS portMUX 的短暂锁竞争。

## 目录

```
musse-display-m1/
├── CMakeLists.txt
├── include/musse/display/      # 公共头文件（含 noop_sink.h）
├── src/                        # 核心实现
├── tests/                      # 93 个 Windows 单元测试
├── tools/                      # 预览生成器、HTML 模板、性能基准
├── preview/                    # 离线预览生成目录（HTML 不入库）
├── patches/                    # 集成上游的最小补丁（不包含工作树）
├── evidence/                   # ELF 符号、调用链、链接映射证据
├── docs/                       # 分析、设计、集成、测试报告
└── reports/FINAL_REPORT.md
```

## 构建与测试（Windows 宿主）

```powershell
$cmake = "C:\Espressif\tools\cmake\4.0.3\bin\cmake.exe"
& $cmake -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release `
  -DCMAKE_CXX_COMPILER="C:/Users/Lenovo/Downloads/x86_64-15.2.0-release-win32-seh-ucrt-rt_v13-rev1/mingw64/bin/g++.exe" `
  -DCMAKE_MAKE_PROGRAM="C:/Espressif/tools/ninja/1.12.1/ninja.exe"
& $cmake --build build
& "C:\Espressif\tools\cmake\4.0.3\bin\ctest.exe" --test-dir build --output-on-failure
```

## 生成离线预览

```powershell
.\build\musse_preview_gen.exe tools\preview_template.html preview\preview.html
```

浏览器直接打开 `preview\preview.html`（无需网络、Node.js 或云端）。
支持 MuSSE 表情、上游设备状态（模拟）、上游情绪名称（模拟）三种输入。

## 设计要点

- 固定 16×16 RGB888，越界安全；极端整数输入使用 int64/裁剪。
- 五种表情：Idle / Listening / Thinking / Speaking / Error。
- 外部毫秒时钟驱动，非阻塞、可重复测试。
- 统一有界事件队列：普通情绪 FIFO（16，满丢最旧），关键控制事件独立槽位（状态/Thinking/Alert 错误/AlertDismiss，永不丢弃）。
- 宿主用 `std::mutex`，固件用 FreeRTOS `portMUX` 短临界区；无无界自旋。
- `StartGate` 提供失败可重试的启动语义；`SetEnabled(false)` 可暂停渲染；`SetSink()` 可切换输出。
- `Connecting` 不触发 Thinking；Thinking 只由显式事件触发。
- AI 负向情绪不当作设备错误；Alert 的 warning/cancel 等才是粘性错误。
- 输出层可替换：RGB、单色、Mock、Noop；未编码任何未核验的硬件地址或引脚。
