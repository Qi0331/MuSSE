#include <cstring>
#include <string>

#include "test_framework.h"

int main(int argc, char** argv) {
    std::string only;
    bool list = false;

    for (int i = 1; i < argc; ++i) {
        if (std::strcmp(argv[i], "--case") == 0 && i + 1 < argc) {
            only = argv[++i];
        } else if (std::strcmp(argv[i], "--list") == 0) {
            list = true;
        }
    }

    if (list) {
        for (const auto& test : musse::test::registry()) {
            std::printf("%s\n", test.name);
        }
        return 0;
    }

    int run = 0;
    int failed = 0;

    for (const auto& test : musse::test::registry()) {
        if (!only.empty() && only != test.name) {
            continue;
        }
        ++run;
        musse::test::currentTest() = test.name;
        const int before = musse::test::failureCount();
        test.fn();
        if (musse::test::failureCount() == before) {
            std::printf("PASS %s\n", test.name);
        } else {
            std::printf("FAILED %s\n", test.name);
            ++failed;
        }
    }

    std::printf("\n%d test case(s), %d failed, %d assertion failure(s)\n",
                run, failed, musse::test::failureCount());
    return failed == 0 && run > 0 ? 0 : 1;
}
