#pragma once

#include <cstddef>
#include <cstdint>

#include "musse/display/frame_buffer.h"

namespace musse::display {

/**
 * Optional logical-to-physical pixel order adapter.
 *
 * The real HT16K33A / WS2812B order is NOT encoded here: it must be verified
 * against the physical module before being used. RowMajor is the neutral
 * default for tests and previews.
 */
class PixelMapper {
public:
    virtual ~PixelMapper() = default;
    virtual int index(int x, int y) const = 0;
    virtual bool validate() const { return true; }
};

class RowMajorMapper final : public PixelMapper {
public:
    int index(int x, int y) const override { return y * FrameBuffer::kWidth + x; }
};

class ColumnMajorMapper final : public PixelMapper {
public:
    int index(int x, int y) const override { return x * FrameBuffer::kHeight + y; }
};

/**
 * Replaceable output sink.
 *
 * Implementations must not allocate or block in drawFrame: it is called from
 * the caller's render loop. Return false on failure; callers count failures
 * and keep running.
 */
class DisplaySink {
public:
    virtual ~DisplaySink() = default;

    virtual bool begin() { return true; }
    virtual bool drawFrame(const FrameBuffer& frame) = 0;
    virtual void end() {}

    /**
     * Brightness is a logical 0..255 request. Hardware sinks must clamp it to
     * their verified current budget; see docs/DESIGN.md.
     */
    virtual void setBrightness(std::uint8_t brightness) { brightness_ = brightness; }
    std::uint8_t brightness() const { return brightness_; }

protected:
    std::uint8_t brightness_ = 255;
};

/** Stores the last RGB frame. Useful for tests and offline preview. */
class RgbSink : public DisplaySink {
public:
    bool drawFrame(const FrameBuffer& frame) override;
    const FrameBuffer& lastFrame() const { return lastFrame_; }
    int frameCount() const { return frameCount_; }

private:
    FrameBuffer lastFrame_;
    int frameCount_ = 0;
};

/**
 * Converts RGB to a 1-bit-per-pixel buffer using luma thresholding.
 * Pixel order is row-major unless a mapper is supplied.
 */
class MonochromeSink : public DisplaySink {
public:
    static constexpr int kThreshold = 32;

    explicit MonochromeSink(const PixelMapper* mapper = nullptr, int threshold = kThreshold);
    bool drawFrame(const FrameBuffer& frame) override;

    bool bit(int x, int y) const;
    int frameCount() const { return frameCount_; }

private:
    const PixelMapper* mapper_;
    int threshold_;
    std::uint8_t bits_[FrameBuffer::kPixelCount / 8] = {};
    int frameCount_ = 0;
};

/** Mock sink that can simulate output failures. */
class MockSink : public DisplaySink {
public:
    bool begin() override;
    bool drawFrame(const FrameBuffer& frame) override;
    void end() override;

    void failOnFrame(int frameNumber) { failOnFrame_ = frameNumber; }
    void failAlways(bool fail) { failAlways_ = fail; }
    void failBegin(bool fail) { failBegin_ = fail; }

    int beginCount() const { return beginCount_; }
    int beginFailures() const { return beginFailures_; }
    int endCount() const { return endCount_; }
    int frameCount() const { return frameCount_; }
    int failureCount() const { return failureCount_; }
    const FrameBuffer& lastFrame() const { return lastFrame_; }

private:
    int beginCount_ = 0;
    int endCount_ = 0;
    int frameCount_ = 0;
    int failureCount_ = 0;
    int failOnFrame_ = -1;
    bool failAlways_ = false;
    bool failBegin_ = false;
    int beginFailures_ = 0;
    FrameBuffer lastFrame_;
};

}  // namespace musse::display
