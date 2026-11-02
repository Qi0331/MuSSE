#pragma once

#include <cstdio>
#include <string>
#include <vector>

namespace musse::test {

struct TestCase {
    const char* name;
    void (*fn)();
};

inline std::vector<TestCase>& registry() {
    static std::vector<TestCase> cases;
    return cases;
}

inline int& failureCount() {
    static int failures = 0;
    return failures;
}

inline const char*& currentTest() {
    static const char* current = "";
    return current;
}

struct Registrar {
    Registrar(const char* name, void (*fn)()) { registry().push_back({name, fn}); }
};

inline void reportFailure(const char* file, int line, const char* expression) {
    ++failureCount();
    std::printf("  FAIL [%s] %s:%d: %s\n", currentTest(), file, line, expression);
}

}  // namespace musse::test

#define MUSSE_TEST(name)                                              \
    static void name();                                               \
    static ::musse::test::Registrar musse_reg_##name(#name, name);    \
    static void name()

#define CHECK(condition)                                              \
    do {                                                              \
        if (!(condition)) {                                           \
            ::musse::test::reportFailure(__FILE__, __LINE__, #condition); \
        }                                                             \
    } while (0)

#define REQUIRE(condition)                                            \
    do {                                                              \
        if (!(condition)) {                                           \
            ::musse::test::reportFailure(__FILE__, __LINE__, #condition); \
            return;                                                   \
        }                                                             \
    } while (0)
