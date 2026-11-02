#pragma once

#include <cstdint>

namespace musse::display {

struct Rgb {
    std::uint8_t r = 0;
    std::uint8_t g = 0;
    std::uint8_t b = 0;
};

constexpr bool operator==(const Rgb& a, const Rgb& b) {
    return a.r == b.r && a.g == b.g && a.b == b.b;
}

constexpr bool operator!=(const Rgb& a, const Rgb& b) {
    return !(a == b);
}

namespace color {
constexpr Rgb Black{0, 0, 0};
constexpr Rgb White{255, 255, 255};
constexpr Rgb Cyan{0, 210, 255};
constexpr Rgb Green{0, 255, 160};
constexpr Rgb Amber{255, 200, 0};
constexpr Rgb Orange{255, 120, 40};
constexpr Rgb Red{255, 0, 0};
constexpr Rgb DimRed{80, 0, 0};
}  // namespace color

}  // namespace musse::display
