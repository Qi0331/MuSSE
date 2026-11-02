#pragma once

#include <cstddef>
#include <cstdint>

#include "musse/display/color.h"

namespace musse::display {

/**
 * Fixed 16x16 RGB888 frame buffer.
 *
 * Coordinates: origin at top-left, x to the right, y downwards.
 * Out-of-range writes are rejected (return false) and never touch memory.
 * Out-of-range reads return black.
 */
class FrameBuffer {
public:
    static constexpr int kWidth = 16;
    static constexpr int kHeight = 16;
    static constexpr std::size_t kPixelCount =
        static_cast<std::size_t>(kWidth) * static_cast<std::size_t>(kHeight);

    FrameBuffer();

    void clear(Rgb color = color::Black);

    bool setPixel(int x, int y, Rgb color);
    Rgb pixel(int x, int y) const;

    bool fillRect(int x, int y, int width, int height, Rgb color);
    bool drawRect(int x, int y, int width, int height, Rgb color);
    bool drawLine(int x0, int y0, int x1, int y1, Rgb color);
    bool fillCircle(int centerX, int centerY, int radius, Rgb color);

    Rgb* data() { return pixels_; }
    const Rgb* data() const { return pixels_; }

    bool operator==(const FrameBuffer& other) const;
    bool operator!=(const FrameBuffer& other) const { return !(*this == other); }

private:
    Rgb pixels_[kPixelCount];
};

}  // namespace musse::display
