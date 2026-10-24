#include "../runtime/Runtime.h"
#include <atomic>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <thread>
using namespace kalandra::runtime;
#define CHECK(x)                                                                                   \
  do {                                                                                             \
    if (!(x)) {                                                                                    \
      std::fprintf(stderr, "Allocation lease assertion %d\n", __LINE__);                           \
      std::abort();                                                                                \
    }                                                                                              \
  } while (false)
int main() {
  for (unsigned n : {0u, 1u, 1024u}) {
    Invocation source;
    auto *p = source.allocate(n);
    CHECK(p);
    if (n)
      std::memset(p, 0x5a, n);
    auto lease = source.lease(p);
    CHECK(lease && bool(*lease) && lease->bytes().size() == n);
    CHECK(lease->bytes().data() == p);
    AllocationLease moved = std::move(*lease);
    CHECK(!*lease);
    AllocationLease assigned;
    assigned = std::move(moved);
    CHECK(!moved);
    source.release(p);
    CHECK(!source.live());
    CHECK(!source.lease(p));
    source.settle();
    for (auto b : assigned.bytes())
      CHECK(b == std::byte{0x5a});
  }
  {
    Invocation a, b;
    auto *p = a.allocate(64);
    CHECK(p);
    std::memset(p, 0x2a, 64);
    CHECK(!b.lease(p));
    CHECK(!a.lease(nullptr));
    CHECK(!a.lease(reinterpret_cast<void *>(0x1000)));
    CHECK(b.retainFrom(a, p));
    auto lease = b.lease(p);
    CHECK(lease);
    a.settle();
    b.settle();
    CHECK(lease->bytes().size() == 64 && lease->bytes()[63] == std::byte{0x2a});
  }
  {
    Invocation a;
    auto *p = a.allocate(4);
    CHECK(p);
    auto lease = a.lease(p);
    CHECK(lease);
    a.fault(1);
    CHECK(!a.lease(p));
    CHECK(lease->bytes().size() == 4);
    a.settle();
    CHECK(!a.lease(p));
  }
  {
    Invocation a;
    auto *p = a.allocate(1);
    CHECK(p);
    a.expectedTaskError(1, 2, 0, 0);
    CHECK(!a.lease(p));
  }
  // The final invocation owner and a retained reader may retire on different threads.
  for (unsigned i = 0; i < 128; ++i) {
    Invocation a;
    auto *p = a.allocate(4096);
    CHECK(p);
    std::memset(p, 0x73, 4096);
    auto lease = a.lease(p);
    CHECK(lease);
    std::atomic<bool> ready{false};
    std::thread reader([value = std::move(*lease), &ready] {
      ready = true;
      for (auto b : value.bytes())
        CHECK(b == std::byte{0x73});
    });
    while (!ready.load())
      std::this_thread::yield();
    a.settle();
    reader.join();
    CHECK(!a.live());
  }
  std::puts("Allocation leases preserve immutable bytes across invocation settlement and "
            "concurrent final release");
}
