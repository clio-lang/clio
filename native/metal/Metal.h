#pragma once
#include "../runtime/Tasks.h"
#include "../runtime/Tensor.h"
#include <cstddef>
#include <cstdint>
#include <expected>
#include <memory>
#include <optional>
#include <span>
#include <string_view>

namespace kalandra::runtime::metal {
struct State;
struct Storage;
struct Bridge;
struct KernelState;
enum class Error : std::int64_t {
  Allocation = 2,
  Invalid = 3,
  Unavailable = 4,
  Device = 5,
  Budget = 6,
  Residency = 7
};
enum class Format { Float32, UInt32, UInt8 };
struct Options {
  std::uint64_t maxBytes = 64 * 1024 * 1024;
  std::uint32_t maxInFlight = 64, defaultDevice = 0;
};
struct Stats {
  std::uint64_t bytes = 0, peakBytes = 0, hostBackings = 0, deviceBackings = 0;
  std::uint64_t metalBuffers = 0, stagingBuffers = 0, inFlight = 0;
  std::uint64_t submissions = 0, completions = 0, attempts = 0;
};
class Device final {
public:
  Device() = default;
  explicit operator bool() const noexcept { return bool(state_); }
  std::uint64_t identity() const noexcept;
  std::string_view name() const noexcept;

private:
  std::shared_ptr<State> state_;
  std::uint32_t index_ = 0;
  Device(std::shared_ptr<State>, std::uint32_t) noexcept;
  friend class Runtime;
  friend struct Bridge;
};
// Private native bridge values. No writable bytes, Metal objects, or forged
// descriptors are exposed. Copies retain immutable backing independently.
class Buffer final {
public:
  Buffer() = default;
  explicit operator bool() const noexcept { return bool(storage_); }
  std::uint64_t bytes() const noexcept;
  std::span<const std::int64_t> shape() const noexcept;
  bool onDevice() const noexcept;
  Format format() const noexcept;
  std::expected<std::span<const std::byte>, Error> hostBytes() const noexcept;

private:
  std::shared_ptr<const Storage> storage_;
  explicit Buffer(std::shared_ptr<const Storage>) noexcept;
  friend class Runtime;
  friend struct Bridge;
};
// Trusted, compiler-produced binary32 kernel artifact; not an arbitrary shader API.
enum class BinaryOperation : std::uint32_t { Add, Multiply, MultiplyAddLeft };
class Kernel final {
public:
  Kernel() = default;
  explicit operator bool() const noexcept { return bool(state_); }

private:
  std::shared_ptr<KernelState> state_;
  friend class Runtime;
  friend struct Bridge;
};
// Trusted compiler-produced entry layout; scalar words preserve float32 bits.
struct ElementwiseSignature {
  std::uint32_t tensors = 1, scalars = 0;
  bool operator==(const ElementwiseSignature &) const = default;
};
class Runtime final {
public:
  static std::expected<std::unique_ptr<Runtime>, Error> create(Options = {}) noexcept;
  std::uint32_t deviceCount() const noexcept;
  std::expected<Device, Error> device() const noexcept;
  std::expected<Device, Error> device(std::uint32_t index) const noexcept;
  std::expected<Buffer, Error> hostTensor(std::span<const std::byte>, std::span<const std::int64_t>,
                                          Format) noexcept;
  std::expected<Buffer, Error> fromCpu(const Invocation &, CpuTensorView) noexcept;
  template <std::size_t Rank>
  std::expected<Float32Tensor<Rank>, Error> toCpu(Invocation &context,
                                                  const Buffer &buffer) noexcept {
    Float32Tensor<Rank> descriptor;
    std::span<std::int64_t> sizes, strides;
    if constexpr (Rank != 0) {
      sizes = descriptor.sizes;
      strides = descriptor.strides;
    }
    auto data = exportCpu(context, buffer, sizes, strides);
    if (!data)
      return std::unexpected(data.error());
    descriptor.allocated = descriptor.aligned = static_cast<float *>(*data);
    return descriptor;
  }
  TaskHandle upload(TaskCore &, GroupHandle, Buffer, Device) noexcept;
  TaskHandle download(TaskCore &, GroupHandle, Buffer) noexcept;
  TaskHandle upload(Task &, GroupHandle, Buffer, Device) noexcept;
  TaskHandle download(Task &, GroupHandle, Buffer) noexcept;
  std::expected<Kernel, Error> loadBinary32Kernel(std::string_view metallib, Device) noexcept;
  std::expected<Kernel, Error> loadElementwiseKernel(std::string_view metallib, Device) noexcept;
  std::expected<Kernel, Error> loadElementwiseKernel(std::string_view metallib, Device,
                                                     ElementwiseSignature) noexcept;
  std::expected<Kernel, Error> loadReductionKernel(std::string_view metallib, Device) noexcept;
  TaskHandle reduceSum(TaskCore &, GroupHandle, Kernel, Buffer) noexcept;
  TaskHandle reduceSum(Task &, GroupHandle, Kernel, Buffer) noexcept;
  static const ValueLayout &scalarLayout() noexcept;
  TaskHandle elementwise(TaskCore &, GroupHandle, Kernel, std::span<const Buffer>,
                         std::span<const float>) noexcept;
  TaskHandle elementwise(Task &, GroupHandle, Kernel, std::span<const Buffer>,
                         std::span<const float>) noexcept;
  TaskHandle elementwise(TaskCore &, GroupHandle, Kernel, Buffer, Buffer) noexcept;
  TaskHandle elementwise(Task &, GroupHandle, Kernel, Buffer, Buffer) noexcept;
  TaskHandle compute(TaskCore &, GroupHandle, Kernel, BinaryOperation, Buffer, Buffer) noexcept;
  TaskHandle compute(Task &, GroupHandle, Kernel, BinaryOperation, Buffer, Buffer) noexcept;
  static const ValueLayout &bufferLayout() noexcept;
  Stats stats() const noexcept;
  // Private, synchronized test controls. Reset allocation failure only when
  // admission is quiescent; held completion must be released before shutdown.
  void failAllocationAt(std::uint64_t attempt) noexcept;
  void failNextCompletion() noexcept;
  void holdCompletions(bool hold) noexcept;

private:
  std::shared_ptr<State> state_;
  explicit Runtime(std::shared_ptr<State>) noexcept;
  std::expected<void *, Error> exportCpu(Invocation &, const Buffer &,
                                         std::span<std::int64_t> sizes,
                                         std::span<std::int64_t> strides) noexcept;
  std::expected<Kernel, Error> loadKernel(std::string_view, Device, bool elementwise,
                                          std::optional<ElementwiseSignature> signature = {},
                                          bool reduction = false) noexcept;
};
} // namespace kalandra::runtime::metal
