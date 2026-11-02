# 小智 v2.5.2 情绪与状态接口分析

- 上游：`78/xiaozhi-esp32`
- tag：`v2.5.2`
- commit：`49b4380b3faa0ceadd28a3e78aaf0f311c46c57e`
- 本地源码：`C:\Users\Lenovo\MuSSE-Lab\xiaozhi-esp32-v2.5.2`
- 分析方式：静态源码阅读；未烧录、未调用云端。

## 1. 实际情绪名称

上游 `Display::SetEmotion(const char*)` 接受字符串。名称有两个来源：

1. **服务器下发的情绪**：任意字符串。OLED/LCD 通过 `78/xiaozhi-fonts/mappings/emoji.json` 映射为 Noto Emoji 字形，未知名称回退 `neutral`。
2. **固件内部写死的名称**：`neutral`、`robot_2`、`sleepy`、`warning`、`staticstate`（不同板型另有 `link`、`cloud_download` 等 Material Symbols 名称）。

`emoji.json` 中确有 21 个名称：

```
neutral, happy, laughing, funny, sad, angry, crying, loving, embarrassed,
surprised, shocked, thinking, winking, cool, relaxed, delicious, kissy,
confident, sleepy, silly, confused
```

文件：`managed_components/78__xiaozhi-fonts/mappings/emoji.json`。
映射函数：`managed_components/78__xiaozhi-fonts/include/noto_emoji.h:34`，`noto_emoji_get_utf8(const char* name)`。

## 2. 情绪来自什么消息

- 服务器 `llm` 消息：`application.cc:671-675`
  ```cpp
  auto emotion = cJSON_GetObjectItem(root, "emotion");
  if (cJSON_IsString(emotion)) {
      Schedule([display, emotion_str = std::string(emotion->valuestring)]() {
          display->SetEmotion(emotion_str.c_str());
      });
  }
  ```
  在 `Application::ParseMessage`（`application.cc` 内）处理，通过 `Schedule()` 投递到主任务执行。
- 服务器 `alert` 消息：`application.cc:696-701` 解析 `status`/`message`/`emotion` 后调用 `Alert()`。
- 固件内部：`Application::Alert()`（`application.cc:752-758`）、状态切换（`application.cc:1016` 起）、`application.cc:439`（`robot_2`）。

## 3. `Display::SetEmotion()` 真实调用路径

```
服务器 JSON (llm / alert)
  -> Application::ParseMessage
     -> Schedule(lambda) / Alert()
        -> Display::SetEmotion(const char*)
           -> 具体 Display 子类实现
```

- 基类声明：`main/display/display.h:46`
- 基类空实现：`main/display/display.cc:34`
- OLED 实现：`main/display/oled_display.cc:395-414`
- LCD 实现：`main/display/lcd_display.cc` 中的 `SetEmotion`（LVGL 图像/字体）

## 4. OLED/LCD 如何生成图像

OLED（`oled_display.cc:395`）：

```cpp
const char* utf8 = noto_emoji_get_utf8(emotion);
const lv_font_t* font = lvgl_theme->emoji_font()->font();
if (utf8 == nullptr) {
    utf8 = material_symbols_get_utf8(emotion);
    font = lvgl_theme->large_icon_font()->font();
}
// 设置 emoji_label 的字体与文本
```

- 本质是**字体字形渲染**，不是 16×16 像素图案。
- 资源：`78/xiaozhi-fonts` 的 Noto Emoji 字体和 PNG（32/64/128 像素）。
- 表情集合/主题：`main/display/lvgl_display/emoji_collection.{h,cc}`、`lvgl_theme.cc`。
- 没有可直接复用的 16×16 单色帧或逐像素动画数据；MuSSE 的 16×16 图案属于自研范围。

## 5. 可复用的内容

| 内容 | 是否复用 | 说明 |
|---|---|---|
| 情绪名称集合（21 个） | 是 | `StateAdapter` 的名称映射表 |
| `emotion` 消息字段语义 | 是 | 以 `onEmotionName()` 接入 |
| `DeviceState` 枚举语义 | 是 | MuSSE 用同名镜像枚举，便于桥接 |
| `DeviceStateMachine` 合法转换语义 | 是（语义） | 不复制实现 |
| `Led` 抽象 / `Board::GetLed()` | 是 | 未来用 MuSSE 子类接入 |
| OLED 字体/图片渲染 | 否 | 与 16×16 点阵不兼容 |
| `SingleLed`（WS2812 GPIO48） | 否 | 与 I²C HT16K33 矩阵不兼容 |
| 动画数据 | 否 | 上游无 16×16 动画资源，MuSSE 自绘 |

## 6. `Led::OnStateChanged()` 如何使用设备状态

- 接口：`main/led/led.h:6-8`，只有一个纯虚函数 `OnStateChanged()`。
- `SingleLed::OnStateChanged()`：`main/led/single_led.cc:123-165`。
  ```cpp
  auto& app = Application::GetInstance();
  auto device_state = app.GetDeviceState();
  switch (device_state) {
      case kDeviceStateStarting: ...  // 蓝色慢闪
      case kDeviceStateIdle: TurnOff();
      case kDeviceStateConnecting: ... // 蓝色常亮
      case kDeviceStateListening: ...  // 红色，随 VAD 变亮
      case kDeviceStateSpeaking: ...   // 绿色常亮
      ...
  }
  ```
- 上游**没有** `kDeviceStateThinking`。`Connecting` 是网络连接阶段，不能代表 AI 推理。
- `Notifying`/`Speaking` 共用绿色；Listening 使用 `IsVoiceDetected()` 区分亮度。

## 7. 状态回调的执行上下文

- `DeviceStateMachine::TransitionTo()`：`main/device_state_machine.cc:113`
- `AddStateChangeListener()`：`device_state_machine.cc:138`
- `NotifyStateChange()`：`device_state_machine.cc:153`
- 监听器在**调用 `TransitionTo()` 的线程上下文**同步执行（`device_state_machine.h` 注释明确）。
- `Application::Initialize()` 注册监听器：`application.cc:97-99`，回调只设置事件位 `MAIN_EVENT_STATE_CHANGED`。
- `Application::Run()` 主事件循环处理该事件后调用 `HandleStateChangedEvent()`：`application.cc:995`；
  内部在 `application.cc:1004-1005` 调用 `Board::GetInstance().GetLed()->OnStateChanged()`。
- 因此 `OnStateChanged()` 运行在主事件循环中；在这里做 256 像素刷新会延迟语音事件处理。

## 8. 如何不阻塞语音任务

MuSSE 采用：

1. `MusseLed::OnStateChanged()` 只做一次原子状态暂存（`std::atomic<uint8_t>`），不渲染、不加锁、不分配内存。
2. 由独立任务/调用方周期性调用 `RenderOnce(now_ms)`，完成状态适配、渲染和 sink 输出。
3. 渲染器是纯函数，无 sleep、无动态分配；256 像素的绘制成本可测。
4. 输出失败只计数，不抛出、不阻塞。

## 9. 结论

- 官方提供的是**情绪名称 + 字体字形渲染**，不是 16×16 点阵表情。
- MuSSE 复用其情绪语义和 `Led` 接入点；五种 16×16 图案、动画和单色转换均为自研。
- `Thinking` 只能由显式业务事件触发；`Connecting` 映射为 `Idle`。
