#include "../runtime/Runtime.h"
#include <array>
#include <atomic>
#include <cstdint>
#include <cstring>
#include <iostream>
#include <stdexcept>
using namespace kalandra::runtime;
extern "C" std::int64_t probe(Invocation *);
extern "C" std::int64_t wrong_key(Invocation *);
extern "C" std::int64_t forged(Invocation *);
static void require(bool value, const char *message) {
  if (!value)
    throw std::runtime_error(message);
}
int main() {
  try {
    for (unsigned fail = 0; fail <= 5; ++fail) {
      Invocation context;
      if (fail)
        context.failAllocationAt(fail);
      auto result = probe(&context);
      require(fail && fail <= 4 ? result == 0 && context.status() == 2
                                : result == 184 && !context.status(),
              "compiled recursive result/failure");
      require(context.callDepth() == 0, "checked call depth leaked");
      context.settle();
      require(!context.live() && context.allocations() == context.releases(),
              "compiled recursive cleanup leaked");
    }
    for (auto run : {wrong_key, forged}) {
      Invocation context;
      require(run(&context) == 0 && context.status() == 3 && context.callDepth() == 0,
              "bad recursive read reached an unchecked load");
      context.settle();
      require(!context.live(), "bad-read cleanup leaked");
    }
    {
      Invocation context;
      std::atomic<bool> cancelled{true};
      context.bindCancellation(&cancelled);
      require(probe(&context) == 0 && !context.live() && context.callDepth() == 0,
              "cancelled compiled constructor executed");
    }
    static const char key = 0;
    for (unsigned mode = 0; mode < 6; ++mode) {
      Invocation context, foreign;
      std::uint64_t payload = 42;
      auto *child = kalandra_recursive_make_v1(&context, &payload, sizeof(payload),
                                               alignof(decltype(payload)), &key, nullptr, 0);
      require(child, "raw bridge child construction");
      auto observer = context.lease(child);
      std::array<const void *, 3> dependencies{child, nullptr, child};
      if (mode == 0)
        dependencies[2] = reinterpret_cast<void *>(0x1234);
      if (mode == 1)
        dependencies[2] = foreign.allocateRecord(8);
      auto *parent = kalandra_recursive_make_v1(
          &context, &payload, sizeof(payload), alignof(decltype(payload)), &key,
          mode == 2 ? nullptr : dependencies.data(),
          mode == 3 ? Invocation::maxRecursiveDependencies + 1 : 3);
      require(mode < 4 ? !parent && context.status() == 3 && observer->referenceCount() == 2
                       : parent && !context.status() && observer->referenceCount() == 4,
              "dependency table validation or rollback failed");
      if (mode == 4)
        require(!kalandra_recursive_read_v1(&context, parent, 8, 3, &key) && context.status() == 3,
                "bad projection alignment accepted");
      if (mode == 5)
        require(!kalandra_recursive_read_v1(&context, parent, 7, 1, &key) && context.status() == 3,
                "bad projection size accepted");
      context.settle();
      foreign.settle();
      require(observer->referenceCount() == 1 && !context.live(),
              "raw bridge retained partial child edges");
    }
    std::cout << "compiled recursive record bridge passed\n";
  } catch (const std::exception &error) {
    std::cerr << error.what() << '\n';
    return 1;
  }
}
