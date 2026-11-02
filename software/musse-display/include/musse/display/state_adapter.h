#pragma once

#include <cstdint>

#include "musse/display/emotion.h"

namespace musse::display {

/**
 * MuSSE-local mirror of the upstream device states.
 *
 * Names intentionally match xiaozhi v2.5.2 `main/device_state.h`, but this
 * enum is owned by MuSSE so the core library can be unit-tested on Windows
 * without pulling in ESP-IDF headers.
 *
 * There is no Thinking state upstream. Thinking is a separate explicit
 * business event (see setThinking) and is never inferred from Connecting.
 */
enum class DeviceState : std::uint8_t {
    Unknown = 0,
    Starting,
    WifiConfiguring,
    Idle,
    Connecting,
    Listening,
    Speaking,
    Notifying,
    Upgrading,
    Activating,
    AudioTesting,
    FatalError,
};

const char* deviceStateName(DeviceState state);

/**
 * Converts upstream AI emotion names to MuSSE expressions.
 *
 * Negative AI emotions (sad/angry/crying/...) map to Idle, NOT Error: they
 * are conversational emotions, not device failures. Unknown names return
 * false and callers must not change the current display.
 */
bool mapUpstreamEmotion(const char* name, Emotion& out);

/** True for Alert icon names that mean a device/business error. */
bool isAlertErrorEmotion(const char* name);
/** True for Alert icon names that are progress notices, not errors. */
bool isAlertProgressEmotion(const char* name);

/**
 * Resolves the expression to display with this priority:
 *   1. sticky device/business error (setError / onAlertEmotion)
 *   2. explicit Thinking event (setThinking)
 *   3. temporary AI emotion (onEmotionName, TTL)
 *   4. device state mapping
 *
 * Unknown/empty/null emotion names are ignored and never overwrite a valid
 * state. Connecting maps to Idle, never Thinking.
 */
class StateAdapter {
public:
    static constexpr std::uint32_t kDefaultEmotionTtlMs = 3000;

    explicit StateAdapter(std::uint32_t emotionTtlMs = kDefaultEmotionTtlMs);

    void onDeviceState(DeviceState state);
    DeviceState deviceState() const { return deviceState_; }

    /**
     * AI/LLM emotion. Known names become a temporary expression with TTL.
     * Returns false and leaves all state unchanged for unknown/empty/null.
     */
    bool onEmotionName(const char* name, std::uint32_t nowMs);

    /**
     * Upstream Alert() emotion (device/business status, not AI mood).
     * warning/cancel/cloud_off/error -> sticky Error.
     * download/cloud_download/link   -> progress notice, no mood override.
     * other names                    -> AI mapping.
     */
    bool onAlertEmotion(const char* name, std::uint32_t nowMs);

    /** DismissAlert() recovery: clears sticky error and temporary emotion. */
    void onAlertDismissed();

    void clearTemporaryEmotion();

    void setThinking(bool active, std::uint32_t nowMs);
    bool thinking() const { return thinking_; }

    void setError(bool active);
    /** Timed device/business error; auto-clears after durationMs. */
    void setTimedError(std::uint32_t nowMs, std::uint32_t durationMs);
    bool error() const { return error_; }

    void tick(std::uint32_t nowMs);
    Emotion resolve(std::uint32_t nowMs);

    std::uint32_t emotionTtlMs() const { return emotionTtlMs_; }

private:
    bool temporaryEmotionActive(std::uint32_t nowMs) const;

    DeviceState deviceState_ = DeviceState::Unknown;
    bool thinking_ = false;
    bool error_ = false;
    bool errorTimed_ = false;
    std::uint32_t errorUntilMs_ = 0;
    bool hasTemporaryEmotion_ = false;
    Emotion temporaryEmotion_ = Emotion::Idle;
    std::uint32_t temporaryEmotionUntilMs_ = 0;
    std::uint32_t emotionTtlMs_;
};

/** Pure device-state to expression mapping (public for tests). */
Emotion emotionForDeviceState(DeviceState state);

}  // namespace musse::display
