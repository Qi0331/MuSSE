#pragma once

#include "musse/display/event.h"
#include "musse/display/state_adapter.h"

namespace musse::display {

/**
 * Applies one event to the adapter. Shared by the firmware render task and
 * the host event-ordering tests, so the tested logic is the production logic.
 */
inline bool applyEvent(StateAdapter& adapter, const Event& event) {
    switch (event.type) {
        case EventType::DeviceState:
            adapter.onDeviceState(static_cast<DeviceState>(event.value));
            return true;
        case EventType::Emotion:
            return adapter.onEmotionName(event.text, event.timeMs);
        case EventType::Thinking:
            adapter.setThinking(event.value != 0, event.timeMs);
            return true;
        case EventType::AlertEmotion:
            return adapter.onAlertEmotion(event.text, event.timeMs);
        case EventType::AlertProgress:
            return adapter.onAlertEmotion(event.text, event.timeMs);
        case EventType::AlertDismiss:
            adapter.onAlertDismissed();
            return true;
    }
    return false;
}

}  // namespace musse::display
