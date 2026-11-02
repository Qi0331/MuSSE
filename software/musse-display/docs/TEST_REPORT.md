# 测试报告（事件桥最终修复）

## 1. 环境

| 项目 | 值 |
|---|---|
| 宿主 | Windows（amd64） |
| C++ 编译器 | MinGW g++ 15.2.0（x86_64-win32-seh-ucrt） |
| CMake | 4.0.3（ESP-IDF 自带工具目录） |
| Ninja | 1.12.1 |
| 标准 | C++17 |
| 构建类型 | Release |
| 测试框架 | 自包含轻量框架 + CTest |

> Windows 宿主测试，不是 Xtensa 交叉编译，也不是 ESP32 真机运行。

## 2. 命令与退出码

```powershell
& "C:\Espressif\tools\cmake\4.0.3\bin\cmake.exe" -S . -B build -G Ninja -DCMAKE_BUILD_TYPE=Release `
  -DCMAKE_CXX_COMPILER="C:/Users/Lenovo/Downloads/x86_64-15.2.0-release-win32-seh-ucrt-rt_v13-rev1/mingw64/bin/g++.exe" `
  -DCMAKE_MAKE_PROGRAM="C:/Espressif/tools/ninja/1.12.1/ninja.exe"
& "C:\Espressif\tools\cmake\4.0.3\bin\cmake.exe" --build build
& "C:\Espressif\tools\cmake\4.0.3\bin\ctest.exe" --test-dir build --output-on-failure
```

| 步骤 | 退出码 | 结果 |
|---|---:|---|
| 配置 | 0 | GNU 15.2.0；Threads 可用（pthread） |
| 构建 | 0 | 无警告（`-Wall -Wextra -Wpedantic`） |
| `musse_tests.exe` | 0 | **93 个用例，0 失败，0 断言失败** |
| `ctest` | 0 | **2/2 通过** |

## 3. 本轮新增/更新的关键测试

| 测试 | 验证点 |
|---|---|
| `event_queue_critical_events_never_dropped` | 64 条情绪洪泛 + AlertDismiss，关键事件保留 |
| `event_queue_alert_dismiss_survives_flood_repro` | 复现报告场景：Error → Dismiss → 16 情绪，恢复成功 |
| `event_queue_thinking_survives_emotion_flood` | Thinking 开/关不被情绪洪泛吞掉 |
| `event_queue_device_state_merges_to_latest` | 100 次状态变化合并为最新，merged 计数 |
| `event_queue_critical_events_apply_without_rendering` | 渲染禁用时关键事件仍被排空/应用 |
| `event_queue_multi_producer_no_loss` | 4 个 `std::thread` 生产者并发入队，无崩溃、无关键事件丢失 |
| `pipeline_set_sink_switches_safely` | Noop/Mock sink 切换：旧 sink `end()`、新 sink `begin()` |
| `event_queue_emotion_full_drops_oldest` | 普通情绪环形缓冲满时丢最旧 |
| `event_queue_fifo_preserves_order` | 跨类型序列号顺序 |

## 4. 队列同步与并发说明

- **宿主实现**：`BasicEventQueue<std::mutex>`，多生产者测试使用 4 个真实 `std::thread`。
- **固件实现**：`BasicEventQueue<FreeRtosCriticalLock>`，`portENTER_CRITICAL`/`portEXIT_CRITICAL` 短临界区；仅任务上下文，不支持 ISR。
- 临界区内只做数组复制和索引更新，不渲染、不日志、不做 I/O。
- 队列语义（关键槽位、丢最旧、序列号）由同一份模板代码实现；同步原语按平台替换。
- 宿主多线程测试覆盖索引/计数/丢弃的并发一致性；FreeRTOS 临界区的实际调度行为无法在 Windows 上完全复现，已在报告中标注。

## 5. 关键事件保底策略

- 普通事件（Emotion、AlertProgress）进入 16 槽 FIFO；满时丢最旧并计数。
- 关键事件按类型进入 4 个独立槽位：
  - 最新 DeviceState
  - 最新 Thinking 开/关
  - 最新 Alert 错误
  - AlertDismiss
- 槽位只保留最新一条（merge 计数），不会因普通事件洪泛而丢失。
- `pop()` 按全局序列号排序，序列号相同优先关键事件。
- 代价：同一类型关键事件的中间状态可能被合并（例如同一帧内多次状态变化只显示最终状态）；这是有意的“最新状态优先”策略。

## 6. 稳定性

`stability_20fps_10min_simulated`：

- 12,000 帧 × 50 ms = 600 秒逻辑时间（20 fps）。
- 循环状态、AI 情绪、Thinking 事件；每帧排空队列。
- 结果：12,000 帧全部渲染，0 sink 失败，0 初始化失败，队列最终为空，0 丢弃。
- **加速模拟，不是真实 10 分钟 wall-clock 运行。**

## 7. Sanitizer

- 本机 MinGW 发行版缺少 `libubsan`，`-fsanitize=undefined` 在链接阶段失败；ASan 同样无运行时。
- 未安装/升级工具链，**本地未执行 sanitizer**。
- 上一轮 ChatGPT 复审在 GNU C++ 14.2.0 环境报告 ASan/UBSan 通过；该结果不是本机执行，不能冒充本地证据。
- 本地以 93 个断言测试与极端整数测试覆盖边界。

## 8. 性能（Windows 宿主 Release，带 checksum）

每种表情 200,000 帧（`musse_bench.exe`）：

| 表情 | 单帧耗时 |
|---|---:|
| Idle | 0.032 µs |
| Listening | 0.050 µs |
| Thinking | 0.050 µs |
| Speaking | 0.035 µs |
| Error | 0.087 µs |

`sizeof(FrameBuffer)` = 768 字节；checksum 读取每帧像素，防止优化消除渲染。仅代表 x86_64 宿主。

## 9. 预览

- 2,065,563 字节
- SHA-256 见最终报告（重新生成后记录）
- 五种表情、上游状态/情绪模拟、RGB/单色、播放控制均已验证

## 10. 集成构建

见 `docs/INTEGRATION.md`、`evidence/`、`reports/FINAL_REPORT.md`。
