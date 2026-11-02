#include "musse/display/display_sink.h"

#include <cstring>

namespace musse::display {

bool RgbSink::drawFrame(const FrameBuffer& frame) {
    lastFrame_ = frame;
    ++frameCount_;
    return true;
}

MonochromeSink::MonochromeSink(const PixelMapper* mapper, int threshold)
    : mapper_(mapper), threshold_(threshold) {
    std::memset(bits_, 0, sizeof(bits_));
}

bool MonochromeSink::drawFrame(const FrameBuffer& frame) {
    std::memset(bits_, 0, sizeof(bits_));
    for (int y = 0; y < FrameBuffer::kHeight; ++y) {
        for (int x = 0; x < FrameBuffer::kWidth; ++x) {
            const Rgb c = frame.pixel(x, y);
            const int luma = (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
            if (luma < threshold_) {
                continue;
            }
            const int idx = mapper_ != nullptr ? mapper_->index(x, y)
                                               : y * FrameBuffer::kWidth + x;
            if (idx < 0 || idx >= static_cast<int>(FrameBuffer::kPixelCount)) {
                return false;  // mapper produced an invalid index
            }
            bits_[idx / 8] |= static_cast<std::uint8_t>(1u << (idx % 8));
        }
    }
    ++frameCount_;
    return true;
}

bool MonochromeSink::bit(int x, int y) const {
    if (x < 0 || y < 0 || x >= FrameBuffer::kWidth || y >= FrameBuffer::kHeight) {
        return false;
    }
    const int idx = mapper_ != nullptr ? mapper_->index(x, y)
                                       : y * FrameBuffer::kWidth + x;
    if (idx < 0 || idx >= static_cast<int>(FrameBuffer::kPixelCount)) {
        return false;
    }
    return (bits_[idx / 8] & static_cast<std::uint8_t>(1u << (idx % 8))) != 0;
}

bool MockSink::begin() {
    ++beginCount_;
    if (failBegin_) {
        ++beginFailures_;
        return false;
    }
    return true;
}

bool MockSink::drawFrame(const FrameBuffer& frame) {
    ++frameCount_;
    if (failAlways_ || frameCount_ == failOnFrame_) {
        ++failureCount_;
        return false;
    }
    lastFrame_ = frame;
    return true;
}

void MockSink::end() { ++endCount_; }

}  // namespace musse::display
