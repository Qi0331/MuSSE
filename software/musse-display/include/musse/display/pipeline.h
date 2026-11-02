#pragma once

#include <cstdint>

#include "musse/display/animation_controller.h"
#include "musse/display/display_sink.h"
#include "musse/display/emotion.h"
#include "musse/display/state_adapter.h"

namespace musse::display {

/**
 * End-to-end software pipeline:
 *   state/emotion -> StateAdapter -> AnimationController -> EmotionRenderer
 *   -> DisplaySink
 *
 * Sink lifecycle:
 *   - begin() failure marks the pipeline Failed, records it, and suppresses
 *     drawFrame(). It does not retry automatically.
 *   - The owner may call retrySinkBegin() to return to NotStarted, after which
 *     the next render() attempts begin() again.
 *
 * render() is non-blocking and never touches hardware by itself.
 */
class DisplayPipeline {
public:
    enum class SinkState : std::uint8_t {
        NotStarted = 0,
        Running,
        Failed,
    };

    explicit DisplayPipeline(DisplaySink& sink);

    StateAdapter& adapter() { return adapter_; }
    AnimationController& animation() { return animation_; }
    DisplaySink& sink() { return *sink_; }

    /**
     * Replaces the output sink. Ends the previous sink if it was running and
     * resets the sink lifecycle so the new sink gets begin(). Returns false
     * when the same sink is supplied.
     */
    bool setSink(DisplaySink& sink);

    bool render(std::uint32_t nowMs);

    /** Allows a new begin() attempt after a failure. */
    bool retrySinkBegin();

    SinkState sinkState() const { return sinkState_; }
    int framesRendered() const { return framesRendered_; }
    int sinkFailures() const { return sinkFailures_; }
    int initFailures() const { return initFailures_; }

private:
    StateAdapter adapter_;
    AnimationController animation_;
    DisplaySink* sink_;  // replaceable; see setSink()
    SinkState sinkState_ = SinkState::NotStarted;
    int framesRendered_ = 0;
    int sinkFailures_ = 0;
    int initFailures_ = 0;
};

}  // namespace musse::display
