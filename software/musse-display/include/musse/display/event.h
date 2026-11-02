#pragma once

#include <cstdint>

namespace musse::display {

enum class EventType : std::uint8_t {
    DeviceState = 1,
    Emotion = 2,
    Thinking = 3,
    AlertEmotion = 4,
    AlertDismiss = 5,
    AlertProgress = 6,
};

/**
 * Fixed-size event used by the firmware bridge and host scheduling tests.
 * text is only used for emotion events and is always NUL-terminated.
 * seq is assigned by the queue; producers may leave it zero.
 */
struct Event {
    EventType type = EventType::DeviceState;
    std::uint8_t value = 0;
    std::uint32_t timeMs = 0;
    std::uint32_t seq = 0;
    char text[32] = {};
};

constexpr int kEventTextCapacity = 32;

}  // namespace musse::display
