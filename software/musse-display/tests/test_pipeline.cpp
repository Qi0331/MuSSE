#include "musse/display/pipeline.h"

#include "test_framework.h"

using namespace musse::display;

MUSSE_TEST(pipeline_renders_and_starts_sink_once) {
    MockSink sink;
    DisplayPipeline pipeline(sink);
    CHECK(pipeline.render(0));
    CHECK(sink.beginCount() == 1);
    CHECK(sink.frameCount() == 1);
    CHECK(pipeline.framesRendered() == 1);

    CHECK(pipeline.render(16));
    CHECK(sink.beginCount() == 1);
    CHECK(sink.frameCount() == 2);
}

MUSSE_TEST(pipeline_state_drives_expression) {
    MockSink sink;
    DisplayPipeline pipeline(sink);
    EmotionRenderer renderer;

    pipeline.adapter().onDeviceState(DeviceState::Listening);
    CHECK(pipeline.render(1000));
    CHECK(sink.lastFrame() == renderer.render(Emotion::Listening, 0));

    pipeline.adapter().onDeviceState(DeviceState::Speaking);
    CHECK(pipeline.render(1100));
    CHECK(sink.lastFrame() == renderer.render(Emotion::Speaking, 0));
}

MUSSE_TEST(pipeline_emotion_event_drives_expression) {
    MockSink sink;
    DisplayPipeline pipeline(sink);
    EmotionRenderer renderer;

    CHECK(pipeline.adapter().onEmotionName("thinking", 500));
    CHECK(pipeline.render(500));
    CHECK(sink.lastFrame() == renderer.render(Emotion::Thinking, 0));
}

MUSSE_TEST(pipeline_error_is_sticky_until_cleared) {
    MockSink sink;
    DisplayPipeline pipeline(sink);
    EmotionRenderer renderer;

    pipeline.adapter().setError(true);
    CHECK(pipeline.render(0));
    CHECK(sink.lastFrame() == renderer.render(Emotion::Error, 0));
    CHECK(pipeline.render(5000));
    CHECK(sink.lastFrame() == renderer.render(Emotion::Error, 5000));

    pipeline.adapter().setError(false);
    CHECK(pipeline.render(5100));
    CHECK(sink.lastFrame() == renderer.render(Emotion::Idle, 0));
}

MUSSE_TEST(pipeline_counts_sink_failures_without_crashing) {
    MockSink sink;
    sink.failAlways(true);
    DisplayPipeline pipeline(sink);
    for (int i = 0; i < 10; ++i) {
        CHECK(!pipeline.render(static_cast<std::uint32_t>(i * 16)));
    }
    CHECK(pipeline.sinkFailures() == 10);
    CHECK(pipeline.framesRendered() == 10);
}

MUSSE_TEST(pipeline_many_frames_are_stable) {
    MockSink sink;
    DisplayPipeline pipeline(sink);
    std::uint32_t now = 0;
    for (int i = 0; i < 1000; ++i) {
        CHECK(pipeline.render(now));
        now += 16;
    }
    CHECK(pipeline.framesRendered() == 1000);
    CHECK(sink.frameCount() == 1000);
    CHECK(pipeline.sinkFailures() == 0);
}

MUSSE_TEST(pipeline_unknown_emotion_maps_to_idle) {
    MockSink sink;
    DisplayPipeline pipeline(sink);
    EmotionRenderer renderer;
    CHECK(!pipeline.adapter().onEmotionName("bogus", 0));
    CHECK(pipeline.render(0));
    CHECK(sink.lastFrame() == renderer.render(Emotion::Idle, 0));
}

MUSSE_TEST(pipeline_begin_failure_stops_rendering) {
    MockSink sink;
    sink.failBegin(true);
    DisplayPipeline pipeline(sink);

    CHECK(!pipeline.render(0));
    CHECK(pipeline.sinkState() == DisplayPipeline::SinkState::Failed);
    CHECK(pipeline.initFailures() == 1);
    CHECK(sink.beginCount() == 1);
    CHECK(sink.beginFailures() == 1);
    CHECK(sink.frameCount() == 0);  // drawFrame must not be called
    CHECK(pipeline.framesRendered() == 0);

    // No automatic retry.
    CHECK(!pipeline.render(16));
    CHECK(sink.beginCount() == 1);
    CHECK(sink.frameCount() == 0);
    CHECK(pipeline.initFailures() == 1);
}

MUSSE_TEST(pipeline_begin_retry_recovers) {
    MockSink sink;
    sink.failBegin(true);
    DisplayPipeline pipeline(sink);
    CHECK(!pipeline.render(0));

    sink.failBegin(false);
    CHECK(pipeline.retrySinkBegin());
    CHECK(pipeline.render(16));
    CHECK(pipeline.sinkState() == DisplayPipeline::SinkState::Running);
    CHECK(sink.beginCount() == 2);
    CHECK(sink.frameCount() == 1);
    CHECK(pipeline.framesRendered() == 1);
    CHECK(pipeline.initFailures() == 1);
    CHECK(!pipeline.retrySinkBegin());  // only valid in Failed state
}
