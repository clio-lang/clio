#include "Metal.h"
#include <array>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <new>
using namespace kalandra;
using namespace kalandra::runtime;
namespace m = kalandra::runtime::metal;
#define CHECK(x)                                                                                   \
  do {                                                                                             \
    if (!(x)) {                                                                                    \
      std::fprintf(stderr, "Typed Metal storage assertion %d: %s\n", __LINE__, #x);                \
      std::abort();                                                                                \
    }                                                                                              \
  } while (false)
void empty(m::Runtime &runtime) {
  auto s = runtime.stats();
  CHECK(!s.bytes && !s.hostBackings && !s.deviceBackings && !s.metalBuffers && !s.inFlight &&
        !s.stagingBuffers && !s.argumentBytes && !s.argumentPacks);
}
m::Buffer observe(TaskCore &core, TaskHandle child) {
  Invocation context;
  alignas(m::Buffer) std::byte slot[sizeof(m::Buffer)];
  CHECK(core.observe(child, m::Runtime::bufferLayout(), context, slot));
  auto *value = std::launder(reinterpret_cast<m::Buffer *>(slot));
  auto result = *value;
  value->~Buffer();
  return result;
}
template <NumericType Type> void roundtrip(m::Runtime &runtime) {
  using T = NumericValue<Type>;
  std::optional<m::Buffer> host;
  std::array<std::byte, 3 * sizeof(T)> pattern{};
  for (std::size_t i = 0; i < pattern.size(); ++i)
    pattern[i] = std::byte((i * 83 + 31) & 255);
  {
    Invocation source;
    auto *data = static_cast<T *>(source.allocate(5 * sizeof(T)));
    CHECK(data);
    std::memcpy(data + 1, pattern.data(), pattern.size());
    CpuTensor<Type, 1> descriptor{data, data, 1, {3}, {1}};
    auto imported = runtime.fromCpu(source, descriptor.view());
    CHECK(imported);
    host = *imported;
    CHECK(storageNumericType(host->format()) == Type && host->bytes() == pattern.size());
    CHECK(host->hostBytes()->data() == reinterpret_cast<const std::byte *>(data + 1));
    CHECK(runtime.stats().bytes == 5 * sizeof(T));
    source.settle();
    CHECK(!source.live());
  }
  Invocation output;
  auto other = Type == NumericType::Float32 ? NumericType::UInt32 : NumericType::Float32;
  CHECK((!runtime.toCpuTyped<NumericType::Float64, 1>(output, *host)));
  if (other == NumericType::Float32)
    CHECK(!runtime.toCpu<1>(output, *host));
  else
    CHECK((!runtime.toCpuTyped<NumericType::UInt32, 1>(output, *host)));
  CHECK(!output.live());
  for (unsigned workers : {1u, 2u, 4u}) {
    TaskLimits limits;
    limits.workers = workers;
    auto core = TaskCore::create(limits);
    CHECK(core);
    auto group = core->openRoot();
    auto up = runtime.upload(*core, group, *host, *runtime.device());
    CHECK(up && core->drain());
    auto device = observe(*core, up);
    CHECK((!runtime.toCpuTyped<Type, 1>(output, device)) && !output.live());
    auto down = runtime.download(*core, group, device);
    CHECK(down && core->drain());
    auto result = observe(*core, down);
    auto copied = runtime.toCpuTyped<Type, 1>(output, result);
    CHECK(copied && !std::memcmp(copied->aligned, pattern.data(), pattern.size()));
    CHECK(copied->sizes[0] == 3 && copied->strides[0] == 1 && copied->offset == 0);
    CHECK(core->close(group) && core->drain() && core->release(group));
    output.release(copied->allocated);
    result = {};
    device = {};
    auto stats = core->stats();
    CHECK(!stats.records && !stats.groups && !stats.retainedBytes && !stats.retainedOwners);
  }
  Invocation failed;
  failed.failAllocationAt(1);
  CHECK((!runtime.toCpuTyped<Type, 1>(failed, *host)) && !failed.live() && failed.status() == 2);
  host.reset();
  empty(runtime);
  Invocation zero;
  CpuTensor<Type, 1> descriptor{reinterpret_cast<T *>(1), reinterpret_cast<T *>(3), 0, {0}, {-1}};
  auto imported = runtime.fromCpu(zero, descriptor.view());
  CHECK(imported);
  auto copied = runtime.toCpuTyped<Type, 1>(zero, *imported);
  CHECK(copied);
  CHECK(copied->sizes[0] == 0 && copied->strides[0] == 1);
  zero.release(copied->allocated);
  imported = {};
  empty(runtime);
}
int main() {
  auto made = m::Runtime::create();
  CHECK(made);
  auto runtime = std::move(*made);
  CHECK(&m::Runtime::scalarLayout() == numericScalarLayout(NumericType::Float32));
  roundtrip<NumericType::Float32>(*runtime);
  roundtrip<NumericType::UInt32>(*runtime);
  roundtrip<NumericType::UInt8>(*runtime);
  // CPU-only formats are explicitly rejected by the current Metal storage bridge.
  Invocation source;
  auto *data = static_cast<double *>(source.allocate(8));
  CHECK(data);
  CpuTensor<NumericType::Float64, 1> fp64{data, data, 0, {1}, {1}};
  CHECK(!runtime->fromCpu(source, fp64.view()));
  auto raw = fp64.view();
  raw.element = NumericType::Int64;
  CHECK(!runtime->fromCpu(source, raw));
  raw.element = static_cast<NumericType>(255);
  CHECK(!runtime->fromCpu(source, raw));
  source.release(data);
  empty(*runtime);
  // Invalid untagged empty views must not sneak through the empty-tensor path.
  std::array<std::int64_t, 1> size{0}, stride{1};
  CpuTensorView untagged;
  untagged.sizes = size;
  untagged.strides = stride;
  CHECK(!runtime->fromCpu(source, untagged));
  empty(*runtime);
  std::puts("Typed CPU/Metal storage: float32/uint32/uint8 bit-preserving transfers, scalar layout "
            "identity, zero-copy leases, width-aware offsets/budgets and mismatch/unsupported "
            "rejection passed");
}
