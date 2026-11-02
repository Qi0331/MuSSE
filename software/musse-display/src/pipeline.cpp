#include "musse/display/pipeline.h"

namespace musse::display {

DisplayPipeline::DisplayPipeline(DisplaySink& sink) : sink_(&sink) {}

bool DisplayPipeline::setSink(DisplaySink& sink) {
    if (sink_ == &sink) {
        return false;
    }
    if (sinkState_ == SinkState::Running) {
        sink_->end();
    }
    sink_ = &sink;
    sinkState_ = SinkState::NotStarted;
    return true;
}

bool DisplayPipeline::render(std::uint32_t nowMs) {
    if (sinkState_ == SinkState::NotStarted) {
        if (!sink_->begin()) {
            sinkState_ = SinkState::Failed;
            ++initFailures_;
            return false;  // never call drawFrame on a failed sink
        }
        sinkState_ = SinkState::Running;
    }

    if (sinkState_ != SinkState::Running) {
        return false;  // failed sinks stay stopped until retrySinkBegin()
    }

    const Emotion emotion = adapter_.resolve(nowMs);
    animation_.setEmotion(emotion, nowMs);
    const FrameBuffer frame = animation_.frame(nowMs);

    ++framesRendered_;
    if (!sink_->drawFrame(frame)) {
        ++sinkFailures_;
        return false;
    }
    return true;
}

bool DisplayPipeline::retrySinkBegin() {
    if (sinkState_ != SinkState::Failed) {
        return false;
    }
    sinkState_ = SinkState::NotStarted;
    return true;
}

}  // namespace musse::display
