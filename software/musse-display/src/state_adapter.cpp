#include "musse/display/state_adapter.h"

#include <cstring>

namespace musse::display {

bool isAlertErrorEmotion(const char* name) {
    if (name == nullptr) {
        return false;
    }
    return std::strcmp(name, "warning") == 0 ||
           std::strcmp(name, "cancel") == 0 ||
           std::strcmp(name, "cloud_off") == 0 ||
           std::strcmp(name, "error") == 0;
}

bool isAlertProgressEmotion(const char* name) {
    if (name == nullptr) {
        return false;
    }
    return std::strcmp(name, "download") == 0 ||
           std::strcmp(name, "cloud_download") == 0 ||
           std::strcmp(name, "link") == 0;
}

const char* deviceStateName(DeviceState state) {
    switch (state) {
        case DeviceState::Unknown: return "unknown";
        case DeviceState::Starting: return "starting";
        case DeviceState::WifiConfiguring: return "wifi_configuring";
        case DeviceState::Idle: return "idle";
        case DeviceState::Connecting: return "connecting";
        case DeviceState::Listening: return "listening";
        case DeviceState::Speaking: return "speaking";
        case DeviceState::Notifying: return "notifying";
        case DeviceState::Upgrading: return "upgrading";
        case DeviceState::Activating: return "activating";
        case DeviceState::AudioTesting: return "audio_testing";
        case DeviceState::FatalError: return "fatal_error";
    }
    return "unknown";
}

bool mapUpstreamEmotion(const char* name, Emotion& out) {
    if (name == nullptr || name[0] == '\0') {
        return false;
    }

    // Names from 78/xiaozhi-fonts mappings/emoji.json (v2.5.2).
    // Negative conversational emotions are deliberately NOT mapped to Error.
    struct Entry { const char* name; Emotion emotion; };
    static constexpr Entry kEntries[] = {
        {"neutral", Emotion::Idle},
        {"relaxed", Emotion::Idle},
        {"sleepy", Emotion::Idle},
        {"happy", Emotion::Speaking},
        {"laughing", Emotion::Speaking},
        {"funny", Emotion::Speaking},
        {"loving", Emotion::Speaking},
        {"kissy", Emotion::Speaking},
        {"confident", Emotion::Speaking},
        {"cool", Emotion::Speaking},
        {"winking", Emotion::Speaking},
        {"silly", Emotion::Speaking},
        {"delicious", Emotion::Speaking},
        {"thinking", Emotion::Thinking},
        {"confused", Emotion::Thinking},
        {"surprised", Emotion::Thinking},
        {"sad", Emotion::Idle},
        {"angry", Emotion::Idle},
        {"crying", Emotion::Idle},
        {"shocked", Emotion::Idle},
        {"embarrassed", Emotion::Idle},
        // Internal, non-error icon names used by upstream board code.
        {"robot_2", Emotion::Idle},
        {"staticstate", Emotion::Idle},
    };

    for (const auto& entry : kEntries) {
        if (std::strcmp(name, entry.name) == 0) {
            out = entry.emotion;
            return true;
        }
    }
    return false;
}

Emotion emotionForDeviceState(DeviceState state) {
    switch (state) {
        case DeviceState::Listening:
            return Emotion::Listening;
        case DeviceState::Speaking:
        case DeviceState::Notifying:
            return Emotion::Speaking;
        case DeviceState::FatalError:
            return Emotion::Error;
        // Connecting is a network phase, NOT AI thinking.
        case DeviceState::Unknown:
        case DeviceState::Starting:
        case DeviceState::WifiConfiguring:
        case DeviceState::Idle:
        case DeviceState::Connecting:
        case DeviceState::Upgrading:
        case DeviceState::Activating:
        case DeviceState::AudioTesting:
        default:
            return Emotion::Idle;
    }
}

StateAdapter::StateAdapter(std::uint32_t emotionTtlMs) : emotionTtlMs_(emotionTtlMs) {}

void StateAdapter::onDeviceState(DeviceState state) {
    if (state == deviceState_) {
        return;
    }
    deviceState_ = state;
    clearTemporaryEmotion();

    // A real state transition ends any explicit thinking phase.
    if (state == DeviceState::Idle || state == DeviceState::Listening ||
        state == DeviceState::Speaking) {
        thinking_ = false;
    }
}

bool StateAdapter::onEmotionName(const char* name, std::uint32_t nowMs) {
    Emotion mapped = Emotion::Idle;
    if (!mapUpstreamEmotion(name, mapped)) {
        // Unknown/empty/null: ignore, never overwrite a valid expression.
        return false;
    }
    temporaryEmotion_ = mapped;
    hasTemporaryEmotion_ = true;
    temporaryEmotionUntilMs_ = nowMs + emotionTtlMs_;
    return true;
}

bool StateAdapter::onAlertEmotion(const char* name, std::uint32_t nowMs) {
    if (name == nullptr || name[0] == '\0') {
        return false;
    }
    if (isAlertErrorEmotion(name)) {
        setError(true);
        return true;
    }
    if (isAlertProgressEmotion(name)) {
        // Progress notification: do not turn it into a mood or an error.
        clearTemporaryEmotion();
        return true;
    }
    return onEmotionName(name, nowMs);
}

void StateAdapter::onAlertDismissed() {
    error_ = false;
    errorTimed_ = false;
    clearTemporaryEmotion();
}

void StateAdapter::clearTemporaryEmotion() {
    hasTemporaryEmotion_ = false;
    temporaryEmotion_ = Emotion::Idle;
    temporaryEmotionUntilMs_ = 0;
}

void StateAdapter::setThinking(bool active, std::uint32_t nowMs) {
    (void)nowMs;
    thinking_ = active;
    if (active) {
        // Explicit thinking takes precedence over a server emotion.
        clearTemporaryEmotion();
    }
}

void StateAdapter::setError(bool active) {
    error_ = active;
    errorTimed_ = false;
    if (active) {
        thinking_ = false;
        clearTemporaryEmotion();
    }
}

void StateAdapter::setTimedError(std::uint32_t nowMs, std::uint32_t durationMs) {
    error_ = true;
    errorTimed_ = true;
    errorUntilMs_ = nowMs + durationMs;
    thinking_ = false;
    clearTemporaryEmotion();
}

void StateAdapter::tick(std::uint32_t nowMs) {
    if (hasTemporaryEmotion_ && !temporaryEmotionActive(nowMs)) {
        clearTemporaryEmotion();
    }
}

bool StateAdapter::temporaryEmotionActive(std::uint32_t nowMs) const {
    if (!hasTemporaryEmotion_) {
        return false;
    }
    return static_cast<std::int32_t>(nowMs - temporaryEmotionUntilMs_) < 0;
}

Emotion StateAdapter::resolve(std::uint32_t nowMs) {
    tick(nowMs);
    if (error_ && errorTimed_ &&
        static_cast<std::int32_t>(nowMs - errorUntilMs_) >= 0) {
        error_ = false;
        errorTimed_ = false;
    }
    if (error_) {
        return Emotion::Error;
    }
    if (thinking_) {
        return Emotion::Thinking;
    }
    if (temporaryEmotionActive(nowMs)) {
        return temporaryEmotion_;
    }
    return emotionForDeviceState(deviceState_);
}

}  // namespace musse::display
