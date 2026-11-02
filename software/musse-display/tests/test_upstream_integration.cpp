#include <cstring>

#include "musse/display/noop_sink.h"
#include "musse/display/pipeline.h"

#include "test_framework.h"

using namespace musse::display;

MUSSE_TEST(upstream_state_idle_maps_to_idle) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Idle);
    CHECK(adapter.resolve(0) == Emotion::Idle);
}

MUSSE_TEST(upstream_state_listening_maps_to_listening) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Listening);
    CHECK(adapter.resolve(0) == Emotion::Listening);
}

MUSSE_TEST(upstream_state_speaking_maps_to_speaking) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Speaking);
    CHECK(adapter.resolve(0) == Emotion::Speaking);
}

MUSSE_TEST(upstream_state_fatal_error_maps_to_error) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::FatalError);
    CHECK(adapter.resolve(0) == Emotion::Error);
}

MUSSE_TEST(upstream_connecting_falls_back_to_idle_not_thinking) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Connecting);
    CHECK(adapter.resolve(0) == Emotion::Idle);
    CHECK(!adapter.thinking());
}

MUSSE_TEST(upstream_unknown_state_falls_back_to_idle) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Unknown);
    CHECK(adapter.resolve(0) == Emotion::Idle);
    adapter.onDeviceState(static_cast<DeviceState>(200));
    CHECK(adapter.resolve(0) == Emotion::Idle);
}

MUSSE_TEST(upstream_state_then_emotion_order) {
    StateAdapter adapter(5000);
    adapter.onDeviceState(DeviceState::Speaking);
    CHECK(adapter.onEmotionName("happy", 1000));
    CHECK(adapter.resolve(1000) == Emotion::Speaking);
}

MUSSE_TEST(upstream_emotion_then_state_clears_temporary) {
    StateAdapter adapter(5000);
    CHECK(adapter.onEmotionName("happy", 1000));
    CHECK(adapter.resolve(1000) == Emotion::Speaking);
    adapter.onDeviceState(DeviceState::Listening);
    CHECK(adapter.resolve(1000) == Emotion::Listening);
}

MUSSE_TEST(upstream_emotion_override_and_recovery) {
    StateAdapter adapter(1000);
    adapter.onDeviceState(DeviceState::Idle);
    CHECK(adapter.onEmotionName("thinking", 0));
    CHECK(adapter.resolve(0) == Emotion::Thinking);
    CHECK(adapter.resolve(1000) == Emotion::Idle);
}

MUSSE_TEST(upstream_thinking_start_and_cancel) {
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Idle);
    adapter.setThinking(true, 0);
    CHECK(adapter.resolve(0) == Emotion::Thinking);
    adapter.setThinking(false, 100);
    CHECK(adapter.resolve(100) == Emotion::Idle);
}

MUSSE_TEST(upstream_error_priority_over_emotion) {
    StateAdapter adapter(5000);
    CHECK(adapter.onEmotionName("happy", 0));
    adapter.setError(true);
    CHECK(adapter.resolve(0) == Emotion::Error);
    CHECK(adapter.resolve(4999) == Emotion::Error);
    adapter.setError(false);
    CHECK(adapter.resolve(0) == Emotion::Idle);
}

MUSSE_TEST(upstream_rapid_state_switching) {
    StateAdapter adapter;
    const DeviceState sequence[] = {
        DeviceState::Idle, DeviceState::Listening, DeviceState::Speaking,
        DeviceState::Idle, DeviceState::Connecting, DeviceState::FatalError,
        DeviceState::Idle,
    };
    for (int i = 0; i < 1000; ++i) {
        adapter.onDeviceState(sequence[i % 7]);
        const DeviceState state = sequence[i % 7];
        Emotion expected = Emotion::Idle;
        if (state == DeviceState::Listening) expected = Emotion::Listening;
        if (state == DeviceState::Speaking) expected = Emotion::Speaking;
        if (state == DeviceState::FatalError) expected = Emotion::Error;
        CHECK(adapter.resolve(static_cast<std::uint32_t>(i)) == expected);
    }
}

MUSSE_TEST(upstream_unknown_and_empty_emotion) {
    StateAdapter adapter;
    CHECK(!adapter.onEmotionName("", 0));
    CHECK(adapter.resolve(0) == Emotion::Idle);
    CHECK(!adapter.onEmotionName("not-an-emotion", 0));
    CHECK(adapter.resolve(0) == Emotion::Idle);
    CHECK(!adapter.onEmotionName(nullptr, 0));
}

MUSSE_TEST(upstream_noop_sink_counts_without_hardware) {
    NoopSink sink;
    DisplayPipeline pipeline(sink);
    pipeline.adapter().onDeviceState(DeviceState::Listening);
    for (int i = 0; i < 10; ++i) {
        CHECK(pipeline.render(static_cast<std::uint32_t>(i * 50)));
    }
    CHECK(sink.frames() == 10);
    CHECK(pipeline.framesRendered() == 10);
    CHECK(pipeline.sinkFailures() == 0);
}

MUSSE_TEST(upstream_events_do_not_render_until_render_called) {
    NoopSink sink;
    DisplayPipeline pipeline(sink);
    pipeline.adapter().onDeviceState(DeviceState::Listening);
    pipeline.adapter().setThinking(true, 0);
    CHECK(sink.frames() == 0);  // events only update state
    CHECK(pipeline.render(0));
    CHECK(sink.frames() == 1);
}

MUSSE_TEST(upstream_end_to_end_no_hardware_chain) {
    NoopSink sink;
    DisplayPipeline pipeline(sink);
    std::uint32_t now = 0;

    pipeline.adapter().onDeviceState(DeviceState::Idle);
    for (int i = 0; i < 20; ++i) { CHECK(pipeline.render(now)); now += 100; }

    pipeline.adapter().onDeviceState(DeviceState::Listening);
    for (int i = 0; i < 12; ++i) { CHECK(pipeline.render(now)); now += 100; }

    pipeline.adapter().setThinking(true, now);
    for (int i = 0; i < 15; ++i) { CHECK(pipeline.render(now)); now += 100; }

    pipeline.adapter().setThinking(false, now);
    pipeline.adapter().onDeviceState(DeviceState::Speaking);
    for (int i = 0; i < 10; ++i) { CHECK(pipeline.render(now)); now += 100; }

    pipeline.adapter().setError(true);
    for (int i = 0; i < 5; ++i) { CHECK(pipeline.render(now)); now += 100; }

    CHECK(sink.frames() == 62);
    CHECK(pipeline.framesRendered() == 62);
}
