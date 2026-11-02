#include "musse/display/event_dispatch.h"
#include "musse/display/event_queue.h"
#include "musse/display/pipeline.h"

#include <cstring>
#include <thread>
#include <vector>

#include "test_framework.h"

using namespace musse::display;

namespace {

Event stateEvent(DeviceState state) {
    Event e;
    e.type = EventType::DeviceState;
    e.value = static_cast<std::uint8_t>(state);
    return e;
}

Event emotionEvent(const char* name, std::uint32_t timeMs) {
    Event e;
    e.type = EventType::Emotion;
    e.timeMs = timeMs;
    std::strncpy(e.text, name, kEventTextCapacity - 1);
    return e;
}

Event thinkingEvent(bool active, std::uint32_t timeMs) {
    Event e;
    e.type = EventType::Thinking;
    e.value = active ? 1 : 0;
    e.timeMs = timeMs;
    return e;
}

Event alertEvent(EventType type, const char* name, std::uint32_t timeMs) {
    Event e;
    e.type = type;
    e.timeMs = timeMs;
    std::strncpy(e.text, name, kEventTextCapacity - 1);
    return e;
}

void drain(EventQueue& queue, StateAdapter& adapter) {
    Event event;
    while (queue.pop(event)) {
        applyEvent(adapter, event);
    }
}

}  // namespace

MUSSE_TEST(event_queue_fifo_preserves_order) {
    EventQueue queue;
    queue.push(stateEvent(DeviceState::Listening));
    queue.push(emotionEvent("happy", 1000));
    queue.push(thinkingEvent(true, 1100));

    Event out;
    CHECK(queue.pop(out));
    CHECK(out.type == EventType::DeviceState);
    CHECK(out.value == static_cast<std::uint8_t>(DeviceState::Listening));
    CHECK(queue.pop(out));
    CHECK(out.type == EventType::Emotion);
    CHECK(std::strcmp(out.text, "happy") == 0);
    CHECK(queue.pop(out));
    CHECK(out.type == EventType::Thinking);
    CHECK(!queue.pop(out));
}

MUSSE_TEST(event_queue_emotion_full_drops_oldest) {
    EventQueue queue;
    for (int i = 0; i < EventQueue::kEmotionCapacity; ++i) {
        queue.push(emotionEvent("happy", static_cast<std::uint32_t>(i)));
    }
    CHECK(queue.size() == EventQueue::kEmotionCapacity);
    CHECK(queue.dropped() == 0);

    queue.push(emotionEvent("sad", 999));
    CHECK(queue.dropped() == 1);
    CHECK(queue.size() == EventQueue::kEmotionCapacity);

    Event out;
    CHECK(queue.pop(out));
    CHECK(out.timeMs == 1);  // oldest (time 0) was dropped
}

MUSSE_TEST(event_queue_critical_events_never_dropped) {
    EventQueue queue;
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Listening);
    adapter.setError(true);  // e.g. Alert already active

    // Flood ordinary emotions beyond capacity, then queue a dismiss.
    for (int i = 0; i < 64; ++i) {
        queue.push(emotionEvent("happy", static_cast<std::uint32_t>(1000 + i)));
    }
    queue.push(alertEvent(EventType::AlertDismiss, "", 2000));

    CHECK(queue.dropped() > 0);  // ordinary events were dropped
    drain(queue, adapter);
    CHECK(!adapter.error());
    CHECK(adapter.resolve(2000) == Emotion::Listening);
}

MUSSE_TEST(event_queue_alert_dismiss_survives_flood_repro) {
    // Reproduces the reported scenario: Error -> dismiss -> 16 emotions.
    EventQueue queue;
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Listening);
    adapter.setError(true);

    queue.push(alertEvent(EventType::AlertDismiss, "", 1000));
    for (int i = 0; i < 16; ++i) {
        queue.push(emotionEvent("happy", 1000 + static_cast<std::uint32_t>(i)));
    }

    drain(queue, adapter);
    CHECK(!adapter.error());
    // The dismiss must win over the flood; remaining emotions may then show.
    CHECK(adapter.resolve(1020) == Emotion::Speaking);
    CHECK(adapter.resolve(1020) != Emotion::Error);
}

MUSSE_TEST(event_queue_thinking_survives_emotion_flood) {
    EventQueue queue;
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Idle);
    queue.push(thinkingEvent(true, 0));
    for (int i = 0; i < 64; ++i) {
        queue.push(emotionEvent("happy", 10 + static_cast<std::uint32_t>(i)));
    }
    drain(queue, adapter);
    CHECK(adapter.resolve(100) == Emotion::Thinking);

    queue.push(thinkingEvent(false, 200));
    for (int i = 0; i < 64; ++i) {
        queue.push(emotionEvent("happy", 210 + static_cast<std::uint32_t>(i)));
    }
    drain(queue, adapter);
    CHECK(adapter.resolve(300) != Emotion::Thinking);
    CHECK(adapter.resolve(300) == Emotion::Speaking);  // emotions may show
}

MUSSE_TEST(event_queue_device_state_merges_to_latest) {
    EventQueue queue;
    StateAdapter adapter;
    const DeviceState states[] = {
        DeviceState::Idle, DeviceState::Listening, DeviceState::Speaking,
        DeviceState::Connecting, DeviceState::FatalError,
    };
    for (int i = 0; i < 100; ++i) {
        queue.push(stateEvent(states[i % 5]));
    }
    CHECK(queue.merged() >= 99);
    drain(queue, adapter);
    CHECK(adapter.deviceState() == states[99 % 5]);
    CHECK(adapter.resolve(0) == Emotion::Error);  // FatalError
}

MUSSE_TEST(event_queue_emotion_before_state_is_superseded) {
    EventQueue queue;
    StateAdapter adapter;
    queue.push(emotionEvent("happy", 1000));
    queue.push(stateEvent(DeviceState::Listening));
    drain(queue, adapter);
    CHECK(adapter.resolve(1000) == Emotion::Listening);
}

MUSSE_TEST(event_queue_state_before_emotion_keeps_emotion) {
    EventQueue queue;
    StateAdapter adapter;
    queue.push(stateEvent(DeviceState::Listening));
    queue.push(emotionEvent("happy", 1000));
    drain(queue, adapter);
    CHECK(adapter.resolve(1000) == Emotion::Speaking);
}

MUSSE_TEST(event_queue_thinking_event_order) {
    EventQueue queue;
    StateAdapter adapter;
    queue.push(stateEvent(DeviceState::Idle));
    queue.push(thinkingEvent(true, 100));
    drain(queue, adapter);
    CHECK(adapter.resolve(100) == Emotion::Thinking);

    queue.push(thinkingEvent(false, 200));
    drain(queue, adapter);
    CHECK(adapter.resolve(200) == Emotion::Idle);
}

MUSSE_TEST(event_queue_alert_error_and_dismiss_order) {
    EventQueue queue;
    StateAdapter adapter;

    queue.push(stateEvent(DeviceState::Listening));
    queue.push(alertEvent(EventType::AlertEmotion, "warning", 1000));
    drain(queue, adapter);
    CHECK(adapter.resolve(1000) == Emotion::Error);

    // A later state does not clear a sticky device error.
    queue.push(stateEvent(DeviceState::Speaking));
    drain(queue, adapter);
    CHECK(adapter.resolve(2000) == Emotion::Error);

    queue.push(alertEvent(EventType::AlertDismiss, "", 3000));
    drain(queue, adapter);
    CHECK(adapter.resolve(3000) == Emotion::Speaking);
}

MUSSE_TEST(event_queue_rapid_switching_bounded) {
    EventQueue queue;
    StateAdapter adapter;
    const DeviceState states[] = {
        DeviceState::Idle, DeviceState::Listening, DeviceState::Speaking,
        DeviceState::Connecting, DeviceState::FatalError,
    };

    for (int i = 0; i < 1000; ++i) {
        queue.push(stateEvent(states[i % 5]));
        if (i % 7 == 0) {
            queue.push(emotionEvent(i % 2 == 0 ? "happy" : "sad", 1000 + i));
        }
    }
    CHECK(queue.size() <= EventQueue::kEmotionCapacity +
                               EventQueue::kControlSlotCount);
    CHECK(queue.dropped() > 0);  // ordinary overflow was handled
    drain(queue, adapter);
    CHECK(queue.size() == 0);
}

MUSSE_TEST(event_queue_critical_events_apply_without_rendering) {
    // Simulates SetEnabled(false): events are still drained/applied, but no
    // frame is rendered. Sticky error recovery must still work.
    EventQueue queue;
    StateAdapter adapter;
    adapter.onDeviceState(DeviceState::Listening);
    adapter.setError(true);

    queue.push(alertEvent(EventType::AlertDismiss, "", 1000));
    for (int i = 0; i < 32; ++i) {
        queue.push(emotionEvent("happy", 1000 + static_cast<std::uint32_t>(i)));
    }

    Event event;
    while (queue.pop(event)) {
        applyEvent(adapter, event);
    }
    CHECK(!adapter.error());
    CHECK(adapter.resolve(1100) != Emotion::Error);
    CHECK(adapter.resolve(1100) == Emotion::Speaking);  // queued emotions apply
}

MUSSE_TEST(event_queue_multi_producer_no_loss) {
    EventQueue queue;
    constexpr int kProducers = 4;
    constexpr int kPerProducer = 500;

    std::vector<std::thread> producers;
    producers.reserve(kProducers);
    for (int p = 0; p < kProducers; ++p) {
        producers.emplace_back([&queue, p]() {
            for (int i = 0; i < kPerProducer; ++i) {
                queue.push(emotionEvent("happy", static_cast<std::uint32_t>(i)));
            }
            // Each producer publishes one critical state; the last one wins.
            queue.push(stateEvent(p % 2 == 0 ? DeviceState::Listening
                                             : DeviceState::Speaking));
        });
    }
    for (auto& thread : producers) {
        thread.join();
    }

    CHECK(queue.pushed() == kProducers * (kPerProducer + 1));
    StateAdapter adapter;
    drain(queue, adapter);
    CHECK(queue.size() == 0);
    // Producers race, so either critical state may be the last one; the
    // important property is that no critical event was lost.
    CHECK(adapter.deviceState() == DeviceState::Listening ||
          adapter.deviceState() == DeviceState::Speaking);
}

MUSSE_TEST(pipeline_set_sink_switches_safely) {
    MockSink first;
    MockSink second;
    DisplayPipeline pipeline(first);
    CHECK(pipeline.render(0));
    CHECK(first.beginCount() == 1);
    CHECK(first.frameCount() == 1);

    CHECK(pipeline.setSink(second));
    CHECK(first.endCount() == 1);
    CHECK(pipeline.sinkState() == DisplayPipeline::SinkState::NotStarted);

    CHECK(pipeline.render(16));
    CHECK(second.beginCount() == 1);
    CHECK(second.frameCount() == 1);
    CHECK(!pipeline.setSink(second));  // already active
}
