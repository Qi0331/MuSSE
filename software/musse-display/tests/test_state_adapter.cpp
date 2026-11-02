#include "musse/display/state_adapter.h"

#include "test_framework.h"

using namespace musse::display;

MUSSE_TEST(state_adapter_basic_device_states) {
    StateAdapter adapter;
    CHECK(adapter.resolve(0) == Emotion::Idle);

    adapter.onDeviceState(DeviceState::Listening);
    CHECK(adapter.resolve(0) == Emotion::Listening);

    adapter.onDeviceState(DeviceState::Speaking);
    CHECK(adapter.resolve(0) == Emotion::Speaking);

    adapter.onDeviceState(DeviceState::Notifying);
    CHECK(adapter.resolve(0) == Emotion::Speaking);

    adapter.onDeviceState(DeviceState::FatalError);
    CHECK(adapter.resolve(0) == Emotion::Error);
}

MUSSE_TEST(state_adapter_connecting_is_not_thinking) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Connecting);
    CHECK(adapter.resolve(0) == Emotion::Idle);
    CHECK(!adapter.thinking());
}

MUSSE_TEST(state_adapter_upstream_emotion_mapping) {
    StateAdapter adapter;
    CHECK(adapter.onEmotionName("happy", 0));
    CHECK(adapter.resolve(0) == Emotion::Speaking);

    CHECK(adapter.onEmotionName("thinking", 0));
    CHECK(adapter.resolve(0) == Emotion::Thinking);

    CHECK(adapter.onEmotionName("neutral", 0));
    CHECK(adapter.resolve(0) == Emotion::Idle);

    // Negative AI emotions are conversational, not device failures.
    CHECK(adapter.onEmotionName("sad", 0));
    CHECK(adapter.resolve(0) == Emotion::Idle);
    CHECK(adapter.onEmotionName("angry", 0));
    CHECK(adapter.resolve(0) == Emotion::Idle);
    CHECK(adapter.onEmotionName("crying", 0));
    CHECK(adapter.resolve(0) == Emotion::Idle);
}

MUSSE_TEST(state_adapter_unknown_emotion_does_not_override) {
    StateAdapter adapter;
    CHECK(!adapter.onEmotionName("not_a_real_emotion", 0));
    CHECK(adapter.resolve(0) == Emotion::Idle);

    adapter.onDeviceState(DeviceState::Listening);
    CHECK(!adapter.onEmotionName("bogus", 100));
    CHECK(adapter.resolve(100) == Emotion::Listening);

    adapter.onDeviceState(DeviceState::Speaking);
    CHECK(!adapter.onEmotionName("bogus", 200));
    CHECK(adapter.resolve(200) == Emotion::Speaking);
}

MUSSE_TEST(state_adapter_empty_and_null_emotion_ignored) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Listening);
    CHECK(!adapter.onEmotionName("", 0));
    CHECK(!adapter.onEmotionName(nullptr, 0));
    CHECK(adapter.resolve(0) == Emotion::Listening);
}

MUSSE_TEST(state_adapter_unknown_keeps_existing_temporary_emotion) {
    StateAdapter adapter(5000);
    CHECK(adapter.onEmotionName("happy", 0));
    CHECK(!adapter.onEmotionName("bogus", 100));
    CHECK(adapter.resolve(100) == Emotion::Speaking);  // original temp intact
}

MUSSE_TEST(state_adapter_temporary_emotion_expires) {
    StateAdapter adapter(1000);
    CHECK(adapter.onEmotionName("happy", 0));
    CHECK(adapter.resolve(999) == Emotion::Speaking);
    CHECK(adapter.resolve(1000) == Emotion::Idle);
}

MUSSE_TEST(state_adapter_state_change_clears_temporary_emotion) {
    StateAdapter adapter(5000);
    CHECK(adapter.onEmotionName("happy", 0));
    CHECK(adapter.resolve(0) == Emotion::Speaking);
    adapter.onDeviceState(DeviceState::Listening);
    CHECK(adapter.resolve(0) == Emotion::Listening);
}

MUSSE_TEST(state_adapter_explicit_thinking) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Connecting);
    adapter.setThinking(true, 100);
    CHECK(adapter.resolve(100) == Emotion::Thinking);
    adapter.setThinking(false, 200);
    CHECK(adapter.resolve(200) == Emotion::Idle);
}

MUSSE_TEST(state_adapter_thinking_overrides_server_emotion) {
    StateAdapter adapter(5000);
    CHECK(adapter.onEmotionName("happy", 0));
    adapter.setThinking(true, 10);
    CHECK(adapter.resolve(10) == Emotion::Thinking);
}

MUSSE_TEST(state_adapter_error_priority_and_recovery) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Listening);
    adapter.setThinking(true, 0);
    CHECK(adapter.resolve(0) == Emotion::Thinking);

    adapter.setError(true);
    CHECK(adapter.resolve(0) == Emotion::Error);
    CHECK(adapter.resolve(100000) == Emotion::Error);  // sticky until cleared

    adapter.setError(false);
    CHECK(adapter.resolve(0) == Emotion::Listening);  // back to device state
}

MUSSE_TEST(state_adapter_timed_error_expires) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Listening);
    adapter.setTimedError(1000, 500);
    CHECK(adapter.resolve(1000) == Emotion::Error);
    CHECK(adapter.resolve(1499) == Emotion::Error);
    CHECK(adapter.resolve(1500) == Emotion::Listening);
    CHECK(!adapter.error());
}

MUSSE_TEST(state_adapter_alert_error_names) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Listening);

    CHECK(adapter.onAlertEmotion("warning", 0));
    CHECK(adapter.resolve(0) == Emotion::Error);
    adapter.onAlertDismissed();
    CHECK(adapter.resolve(0) == Emotion::Listening);

    CHECK(adapter.onAlertEmotion("cancel", 100));
    CHECK(adapter.resolve(100) == Emotion::Error);
    adapter.onAlertDismissed();

    CHECK(adapter.onAlertEmotion("cloud_off", 200));
    CHECK(adapter.resolve(200) == Emotion::Error);
    adapter.onAlertDismissed();

    CHECK(adapter.onAlertEmotion("error", 300));
    CHECK(adapter.resolve(300) == Emotion::Error);
    adapter.onAlertDismissed();
    CHECK(adapter.resolve(300) == Emotion::Listening);
}

MUSSE_TEST(state_adapter_alert_progress_is_not_error) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Listening);
    CHECK(adapter.onAlertEmotion("cloud_download", 0));
    CHECK(adapter.resolve(0) == Emotion::Listening);
    CHECK(!adapter.error());

    CHECK(adapter.onAlertEmotion("link", 100));
    CHECK(adapter.resolve(100) == Emotion::Listening);
    CHECK(!adapter.error());
}

MUSSE_TEST(state_adapter_alert_unknown_is_ignored) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Speaking);
    CHECK(!adapter.onAlertEmotion("not-real", 0));
    CHECK(!adapter.onAlertEmotion(nullptr, 0));
    CHECK(adapter.resolve(0) == Emotion::Speaking);
}

MUSSE_TEST(state_adapter_repeated_switching) {
    StateAdapter adapter;
    for (int i = 0; i < 500; ++i) {
        adapter.onDeviceState(DeviceState::Listening);
        CHECK(adapter.resolve(static_cast<std::uint32_t>(i)) == Emotion::Listening);
        adapter.onDeviceState(DeviceState::Speaking);
        CHECK(adapter.resolve(static_cast<std::uint32_t>(i)) == Emotion::Speaking);
        adapter.setError(true);
        CHECK(adapter.resolve(static_cast<std::uint32_t>(i)) == Emotion::Error);
        adapter.setError(false);
    }
    adapter.onDeviceState(DeviceState::Idle);
    CHECK(adapter.resolve(0) == Emotion::Idle);
}

MUSSE_TEST(state_adapter_device_state_mapping_table) {
    CHECK(emotionForDeviceState(DeviceState::Unknown) == Emotion::Idle);
    CHECK(emotionForDeviceState(DeviceState::Starting) == Emotion::Idle);
    CHECK(emotionForDeviceState(DeviceState::WifiConfiguring) == Emotion::Idle);
    CHECK(emotionForDeviceState(DeviceState::Connecting) == Emotion::Idle);
    CHECK(emotionForDeviceState(DeviceState::Idle) == Emotion::Idle);
    CHECK(emotionForDeviceState(DeviceState::Listening) == Emotion::Listening);
    CHECK(emotionForDeviceState(DeviceState::Speaking) == Emotion::Speaking);
    CHECK(emotionForDeviceState(DeviceState::Notifying) == Emotion::Speaking);
    CHECK(emotionForDeviceState(DeviceState::FatalError) == Emotion::Error);
    CHECK(emotionForDeviceState(DeviceState::Upgrading) == Emotion::Idle);
    CHECK(emotionForDeviceState(DeviceState::Activating) == Emotion::Idle);
    CHECK(emotionForDeviceState(DeviceState::AudioTesting) == Emotion::Idle);
}
