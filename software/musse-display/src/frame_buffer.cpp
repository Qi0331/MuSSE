#include "musse/display/frame_buffer.h"

#include <algorithm>
#include <cstdint>
#include <cstring>

namespace musse::display {
namespace {

bool clipLine(int64_t& x0, int64_t& y0, int64_t& x1, int64_t& y1,
              int width, int height) {
    // Liang-Barsky clipping in double precision. Coordinates are 32-bit, so
    // differences (<= 2^32) are exactly representable in a 53-bit mantissa.
    double ax = static_cast<double>(x0);
    double ay = static_cast<double>(y0);
    double bx = static_cast<double>(x1);
    double by = static_cast<double>(y1);
    const double dx = bx - ax;
    const double dy = by - ay;

    double t0 = 0.0;
    double t1 = 1.0;
    constexpr double kEps = 1e-6;  // tolerate 32-bit coordinate rounding
    auto clipTest = [&](double p, double q) {
        if (p == 0.0) {
            return q >= 0.0;
        }
        const double r = q / p;
        if (p < 0.0) {
            if (r > t1 + kEps) return false;
            if (r > t0) t0 = r;
        } else {
            if (r < t0 - kEps) return false;
            if (r < t1) t1 = r;
        }
        return true;
    };

    if (!clipTest(-dx, ax)) return false;
    if (!clipTest(dx, (width - 1) - ax)) return false;
    if (!clipTest(-dy, ay)) return false;
    if (!clipTest(dy, (height - 1) - ay)) return false;
    if (t0 > t1 + 1e-9) return false;
    if (t0 > t1) {
        // Corner-touching lines can land on the same t with rounding noise.
        t0 = t1 = (t0 + t1) * 0.5;
    }

    auto clampInt = [](double value, int maxValue) -> int64_t {
        if (value <= 0.0) return 0;
        if (value >= maxValue) return maxValue;
        return static_cast<int64_t>(value + 0.5);
    };

    x0 = clampInt(ax + t0 * dx, width - 1);
    y0 = clampInt(ay + t0 * dy, height - 1);
    x1 = clampInt(ax + t1 * dx, width - 1);
    y1 = clampInt(ay + t1 * dy, height - 1);
    return true;
}

}  // namespace

FrameBuffer::FrameBuffer() { clear(); }

void FrameBuffer::clear(Rgb color) {
    for (std::size_t i = 0; i < kPixelCount; ++i) {
        pixels_[i] = color;
    }
}

bool FrameBuffer::setPixel(int x, int y, Rgb color) {
    if (x < 0 || y < 0 || x >= kWidth || y >= kHeight) {
        return false;
    }
    pixels_[static_cast<std::size_t>(y) * kWidth + static_cast<std::size_t>(x)] = color;
    return true;
}

Rgb FrameBuffer::pixel(int x, int y) const {
    if (x < 0 || y < 0 || x >= kWidth || y >= kHeight) {
        return color::Black;
    }
    return pixels_[static_cast<std::size_t>(y) * kWidth + static_cast<std::size_t>(x)];
}

bool FrameBuffer::fillRect(int x, int y, int width, int height, Rgb color) {
    if (width <= 0 || height <= 0) {
        return false;
    }

    // 64-bit arithmetic avoids signed overflow for INT_MIN/INT_MAX inputs.
    const int64_t xEnd = static_cast<int64_t>(x) + static_cast<int64_t>(width);
    const int64_t yEnd = static_cast<int64_t>(y) + static_cast<int64_t>(height);

    const int x0 = x <= 0 ? 0 : (x >= kWidth ? kWidth : x);
    const int y0 = y <= 0 ? 0 : (y >= kHeight ? kHeight : y);
    const int x1 = xEnd <= 0 ? 0 : (xEnd >= kWidth ? kWidth : static_cast<int>(xEnd));
    const int y1 = yEnd <= 0 ? 0 : (yEnd >= kHeight ? kHeight : static_cast<int>(yEnd));

    if (x0 >= x1 || y0 >= y1) {
        return false;
    }
    for (int py = y0; py < y1; ++py) {
        for (int px = x0; px < x1; ++px) {
            pixels_[static_cast<std::size_t>(py) * kWidth + static_cast<std::size_t>(px)] = color;
        }
    }
    return true;
}

bool FrameBuffer::drawRect(int x, int y, int width, int height, Rgb color) {
    if (width <= 0 || height <= 0) {
        return false;
    }

    const int64_t xLeft = x;
    const int64_t xRight = static_cast<int64_t>(x) + static_cast<int64_t>(width) - 1;
    const int64_t yTop = y;
    const int64_t yBottom = static_cast<int64_t>(y) + static_cast<int64_t>(height) - 1;

    bool drawn = false;
    auto hline = [&](int64_t fromX, int64_t toX, int64_t atY) {
        if (atY < 0 || atY >= kHeight) {
            return;
        }
        const int64_t a = std::max<int64_t>(fromX, 0);
        const int64_t b = std::min<int64_t>(toX, kWidth - 1);
        for (int64_t px = a; px <= b; ++px) {
            drawn |= setPixel(static_cast<int>(px), static_cast<int>(atY), color);
        }
    };
    auto vline = [&](int64_t fromY, int64_t toY, int64_t atX) {
        if (atX < 0 || atX >= kWidth) {
            return;
        }
        const int64_t a = std::max<int64_t>(fromY, 0);
        const int64_t b = std::min<int64_t>(toY, kHeight - 1);
        for (int64_t py = a; py <= b; ++py) {
            drawn |= setPixel(static_cast<int>(atX), static_cast<int>(py), color);
        }
    };

    hline(xLeft, xRight, yTop);
    hline(xLeft, xRight, yBottom);
    vline(yTop, yBottom, xLeft);
    vline(yTop, yBottom, xRight);
    return drawn;
}

bool FrameBuffer::drawLine(int x0, int y0, int x1, int y1, Rgb color) {
    int64_t cx0 = x0;
    int64_t cy0 = y0;
    int64_t cx1 = x1;
    int64_t cy1 = y1;

    if (!clipLine(cx0, cy0, cx1, cy1, kWidth, kHeight)) {
        return false;
    }

    int px0 = static_cast<int>(cx0);
    int py0 = static_cast<int>(cy0);
    const int px1 = static_cast<int>(cx1);
    const int py1 = static_cast<int>(cy1);

    int dx = px1 > px0 ? px1 - px0 : px0 - px1;
    int dy = py1 > py0 ? py1 - py0 : py0 - py1;
    const int sx = px0 < px1 ? 1 : -1;
    const int sy = py0 < py1 ? 1 : -1;
    int err = dx - dy;

    bool drawn = false;
    while (true) {
        drawn |= setPixel(px0, py0, color);
        if (px0 == px1 && py0 == py1) {
            break;
        }
        const int e2 = 2 * err;
        if (e2 > -dy) {
            err -= dy;
            px0 += sx;
        }
        if (e2 < dx) {
            err += dx;
            py0 += sy;
        }
    }
    return drawn;
}

bool FrameBuffer::fillCircle(int centerX, int centerY, int radius, Rgb color) {
    if (radius < 0) {
        return false;
    }

    const int64_t r2 = static_cast<int64_t>(radius) * static_cast<int64_t>(radius);
    const int64_t rawX0 = static_cast<int64_t>(centerX) - radius;
    const int64_t rawX1 = static_cast<int64_t>(centerX) + radius + 1;
    const int64_t rawY0 = static_cast<int64_t>(centerY) - radius;
    const int64_t rawY1 = static_cast<int64_t>(centerY) + radius + 1;

    const int x0 = rawX0 <= 0 ? 0 : (rawX0 >= kWidth ? kWidth : static_cast<int>(rawX0));
    const int x1 = rawX1 <= 0 ? 0 : (rawX1 >= kWidth ? kWidth : static_cast<int>(rawX1));
    const int y0 = rawY0 <= 0 ? 0 : (rawY0 >= kHeight ? kHeight : static_cast<int>(rawY0));
    const int y1 = rawY1 <= 0 ? 0 : (rawY1 >= kHeight ? kHeight : static_cast<int>(rawY1));

    bool drawn = false;
    for (int py = y0; py < y1; ++py) {
        const int64_t dy = static_cast<int64_t>(py) - centerY;
        const int64_t dy2 = dy * dy;
        if (dy2 > r2) {
            continue;
        }
        for (int px = x0; px < x1; ++px) {
            const int64_t dx = static_cast<int64_t>(px) - centerX;
            const int64_t dx2 = dx * dx;
            if (dx2 > r2) {
                continue;
            }
            // Avoid dx2 + dy2 overflow: compare against the remaining budget.
            if (dy2 > r2 - dx2) {
                continue;
            }
            drawn |= setPixel(px, py, color);
        }
    }
    return drawn;
}

bool FrameBuffer::operator==(const FrameBuffer& other) const {
    return std::memcmp(pixels_, other.pixels_, sizeof(pixels_)) == 0;
}

}  // namespace musse::display
