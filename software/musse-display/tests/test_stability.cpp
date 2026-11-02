#include <cstdint>

#include "musse/display/event_dispatch.h"
#include "musse/display/event_queue.h"
#include "musse/display/noop_sink.h"
#include "musse/display/pipeline.h"

#include "test_framework.h"

using namespace musse::display;

MUSSE_TEST(stability_20fps_10min_simulated) {
    // Accelerated simulation: 12,000 frames x 50 ms = 600 s of logical time.
    // This is NOT a real 10-minute wall-clock run.
    constexpr int kFrames = 12000;
    constexpr std::uint32_t kStepMs = 50;

    EventQueue queue;
    StateAdapter adapter;
    NoopSink sink;
    DisplayPipeline pipeline(sink);

    const DeviceState states[] = {
        DeviceState::Idle, DeviceState::Listening, DeviceState::Speaking,
        DeviceState::Connecting, DeviceState::FatalError,
    };
    const char* emotions[] = {"happy", "thinking", "sad", "neutral", "unknown-name"};

    std::uint32_t now = 0;
    for (int frame = 0; frame < kFrames; ++frame) {
        now += kStepMs;

        if (frame % 25 == 0) {
            Event e;
            e.type = EventType::DeviceState;
            e.value = static_cast<std::uint8_t>(states[(frame / 25) % 5]);
            queue.push(e);
        }
        if (frame % 37 == 0) {
            Event e;
            e.type = EventType::Emotion;
            e.timeMs = now;
            const char* name = emotions[(frame / 37) % 5];
            for (int i = 0; i < kEventTextCapacity - 1 && name[i] != '\0'; ++i) {
                e.text[i] = name[i];
            }
            queue.push(e);
        }
        if (frame % 211 == 0) {
            Event e;
            e.type = EventType::Thinking;
            e.value = ((frame / 211) % 2 == 0) ? 1 : 0;
            e.timeMs = now;
            queue.push(e);
        }

        Event event;
        while (queue.pop(event)) {
            applyEvent(adapter, event);
        }
        CHECK(pipeline.render(now));
    }

    CHECK(pipeline.framesRendered() == kFrames);
    CHECK(pipeline.sinkFailures() == 0);
    CHECK(pipeline.initFailures() == 0);
    CHECK(sink.frames() == kFrames);
    CHECK(queue.size() == 0);
    CHECK(queue.dropped() == 0);  // drained every frame, so no overflow
}
