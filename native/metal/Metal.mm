#include "Metal.h"
#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#include <algorithm>
#include <array>
#include <atomic>
#include <bit>
#include <condition_variable>
#include <cstring>
#include <limits>
#include <mutex>
#include <new>
#include <string>
#include <utility>
#include <vector>

namespace kalandra::runtime::metal {
struct State {
  Options options;
  NSArray<id<MTLDevice>> *devices;
  NSArray<id<MTLCommandQueue>> *queues;
  std::vector<std::string> names;
  std::atomic<std::uint64_t> bytes{0}, peakBytes{0}, hostBackings{0}, deviceBackings{0};
  std::atomic<std::uint64_t> metalBuffers{0}, stagingBuffers{0}, inFlight{0}, submissions{0},
      completions{0};
  std::atomic<std::uint64_t> attempts{0}, failAt{0};
  std::atomic<bool> failCompletion{false};
  std::mutex gateMutex;
  std::condition_variable gate;
  bool hold = false;
  bool permit() noexcept {
    auto n = ++attempts;
    return !failAt || n != failAt;
  }
  bool reserve(std::uint64_t n) noexcept {
    auto used = bytes.load();
    do {
      if (n > options.maxBytes - used)
        return false;
    } while (!bytes.compare_exchange_weak(used, used + n));
    auto peak = peakBytes.load();
    while (peak < used + n && !peakBytes.compare_exchange_weak(peak, used + n)) {
    }
    return true;
  }
};
struct MetalAllocation {
  std::shared_ptr<State> state;
  id<MTLBuffer> buffer;
  std::uint64_t bytes;
  bool staging;
  MetalAllocation(std::shared_ptr<State> s, id<MTLBuffer> b, std::uint64_t n, bool stage)
      : state(std::move(s)), buffer(b), bytes(n), staging(stage) {
    ++state->metalBuffers;
    if (staging)
      ++state->stagingBuffers;
  }
  ~MetalAllocation() {
    buffer = nil;
    state->bytes -= bytes;
    --state->metalBuffers;
    if (staging)
      --state->stagingBuffers;
  }
};
struct Storage {
  std::shared_ptr<State> state;
  std::array<std::int64_t, 8> dimensions{};
  std::uint32_t rank = 0, deviceIndex = 0;
  Format format = Format::Float32;
  bool device = false;
  std::uint64_t size = 0, hostReserved = 0;
  std::vector<std::byte> host;
  AllocationLease cpu;
  std::uint64_t cpuOffset = 0;
  std::span<const std::byte> hostView() const noexcept {
    return cpu ? cpu.bytes().subspan(cpuOffset, size) : std::span<const std::byte>(host);
  }
  std::shared_ptr<MetalAllocation> metal;
  Storage(std::shared_ptr<State> s, bool d) : state(std::move(s)), device(d) {
    if (device)
      ++state->deviceBackings;
    else
      ++state->hostBackings;
  }
  ~Storage() {
    metal.reset();
    host.clear();
    if (hostReserved)
      state->bytes -= hostReserved;
    if (device)
      --state->deviceBackings;
    else
      --state->hostBackings;
  }
};
struct KernelState {
  std::shared_ptr<State> registry;
  std::uint32_t index;
  id<MTLComputePipelineState> pipeline;
  bool elementwise, reduction;
  std::optional<ElementwiseSignature> signature;
};
namespace {
std::expected<std::uint64_t, Error> tensorBytes(std::span<const std::int64_t> shape,
                                                Format format) {
  if (shape.size() > 8)
    return std::unexpected(Error::Invalid);
  std::uint64_t width = 0;
  switch (format) {
  case Format::Float32:
  case Format::UInt32:
    width = 4;
    break;
  case Format::UInt8:
    width = 1;
    break;
  default:
    return std::unexpected(Error::Invalid);
  }
  bool zero = false;
  for (auto dimension : shape) {
    if (dimension < 0)
      return std::unexpected(Error::Invalid);
    zero |= dimension == 0;
  }
  if (zero)
    return 0;
  auto n = width;
  for (auto dimension : shape) {
    if (std::uint64_t(dimension) > UINT64_MAX / n)
      return std::unexpected(Error::Invalid);
    n *= std::uint64_t(dimension);
  }
  if (n > std::numeric_limits<std::size_t>::max())
    return std::unexpected(Error::Invalid);
  return n;
}
std::expected<std::shared_ptr<MetalAllocation>, Error>
allocateMetal(const std::shared_ptr<State> &state, std::uint32_t index, std::uint64_t n,
              bool staging) {
  if (!state->permit())
    return std::unexpected(Error::Allocation);
  if (n > state->devices[index].maxBufferLength)
    return std::unexpected(Error::Invalid);
  if (!state->reserve(n))
    return std::unexpected(Error::Budget);
  id<MTLBuffer> buffer = nil;
  if (state->permit())
    buffer = [state->devices[index]
        newBufferWithLength:n
                    options:staging ? MTLResourceStorageModeShared : MTLResourceStorageModePrivate];
  if (!buffer) {
    state->bytes -= n;
    return std::unexpected(Error::Allocation);
  }
  try {
    return std::make_shared<MetalAllocation>(state, buffer, n, staging);
  } catch (...) {
    state->bytes -= n;
    return std::unexpected(Error::Allocation);
  }
}
std::expected<std::shared_ptr<Storage>, Error> allocateStorage(const std::shared_ptr<State> &state,
                                                               std::span<const std::int64_t> shape,
                                                               Format format, bool device,
                                                               std::uint32_t index = 0) {
  auto size = tensorBytes(shape, format);
  if (!size)
    return std::unexpected(size.error());
  if (!state->permit())
    return std::unexpected(Error::Allocation);
  std::shared_ptr<Storage> storage;
  try {
    storage = std::make_shared<Storage>(state, device);
  } catch (...) {
    return std::unexpected(Error::Allocation);
  }
  storage->size = *size;
  storage->format = format;
  storage->rank = shape.size();
  storage->deviceIndex = index;
  std::copy(shape.begin(), shape.end(), storage->dimensions.begin());
  if (*size) {
    if (device) {
      auto buffer = allocateMetal(state, index, *size, false);
      if (!buffer)
        return std::unexpected(buffer.error());
      storage->metal = *buffer;
    } else {
      if (!state->reserve(*size))
        return std::unexpected(Error::Budget);
      storage->hostReserved = *size;
      if (!state->permit())
        return std::unexpected(Error::Allocation);
      try {
        storage->host.resize(*size);
      } catch (...) {
        return std::unexpected(Error::Allocation);
      }
    }
  }
  return storage;
}
} // namespace
struct Bridge {
  enum class Kind { Upload, Download, Compute, Elementwise, Reduce };
  struct PacketData {
    std::shared_ptr<State> state;
    Buffer input;
    Device target;
    Kind kind;
    Kernel kernel;
    BinaryOperation operation = BinaryOperation::Add;
    Buffer right;
    std::array<std::uint32_t, 8> scalarBits{};
    std::uint32_t tensorCount = 2, scalarCount = 0;
  };
  // uint32 indexing permits at most 32 tree levels, each with output and count storage.
  struct ReductionScratch {
    std::array<std::shared_ptr<MetalAllocation>, 64> retained{};
  };
  struct Frame {
    PacketData packet;
    Buffer result;
    float scalar = 0;
    std::unique_ptr<ReductionScratch> scratch;
    std::shared_ptr<MetalAllocation> staging;
    Error error = Error::Device;
    bool succeeded = false, started = false, active = false;
    explicit Frame(PacketData p) : packet(std::move(p)) {}
    ~Frame() {
      if (active)
        --packet.state->inFlight;
    }
  };
  static bool copy(Invocation &, void *out, const Invocation &, const void *in) noexcept {
    new (out) Buffer(*static_cast<const Buffer *>(in));
    return true;
  }
  static void destroyValue(void *value) noexcept { static_cast<Buffer *>(value)->~Buffer(); }
  static bool construct(Invocation &, void *out, const Packet &packet) {
    new (out) Frame(*static_cast<const PacketData *>(packet.data));
    return true;
  }
  static void destroy(void *frame) noexcept { static_cast<Frame *>(frame)->~Frame(); }
  static const ValueLayout layout;
  static bool copyScalar(Invocation &, void *out, const Invocation &, const void *in) noexcept {
    std::memcpy(out, in, sizeof(float));
    return true;
  }
  static void destroyScalar(void *) noexcept {}
  static const ValueLayout scalarLayout;
  static const TaskEntry entry, reductionEntry;
  static id<MTLCommandBuffer> reductionCommand(Frame &f) {
    auto state = f.packet.state;
    auto index = f.packet.kernel.state_->index;
    if (!state->permit())
      return nil;
    f.scratch.reset(new (std::nothrow) ReductionScratch{});
    if (!f.scratch)
      return nil;
    auto readback = allocateMetal(state, index, 4, true);
    if (!readback) {
      f.error = readback.error();
      return nil;
    }
    f.staging = *readback;
    id<MTLCommandBuffer> command = state->permit() ? [state->queues[index] commandBuffer] : nil;
    if (!command)
      return nil;
    id<MTLBuffer> input = f.packet.input.storage_->metal->buffer;
    std::uint64_t length = f.packet.input.bytes() / 4;
    unsigned retained = 0;
    while (length > 1) {
      const auto next = (length + 1) / 2;
      auto output = allocateMetal(state, index, next * 4, false);
      if (!output) {
        f.error = output.error();
        return nil;
      }
      f.scratch->retained[retained++] = *output;
      auto count = allocateMetal(state, index, 4, true);
      if (!count) {
        f.error = count.error();
        return nil;
      }
      f.scratch->retained[retained++] = *count;
      auto bits = std::uint32_t(length);
      std::memcpy((*count)->buffer.contents, &bits, 4);
      id<MTLComputeCommandEncoder> encoder =
          state->permit() ? [command computeCommandEncoder] : nil;
      if (!encoder)
        return nil;
      [encoder setComputePipelineState:f.packet.kernel.state_->pipeline];
      [encoder setBuffer:input offset:0 atIndex:0];
      [encoder setBuffer:(*output)->buffer offset:0 atIndex:1];
      [encoder setBuffer:(*count)->buffer offset:0 atIndex:2];
      [encoder dispatchThreadgroups:MTLSizeMake((next + 63) / 64, 1, 1)
              threadsPerThreadgroup:MTLSizeMake(64, 1, 1)];
      [encoder endEncoding];
      input = (*output)->buffer;
      length = next;
    }
    // Only the final scalar crosses back to the host. No CPU arithmetic fallback.
    id<MTLBlitCommandEncoder> blit = state->permit() ? [command blitCommandEncoder] : nil;
    if (!blit)
      return nil;
    [blit copyFromBuffer:input
             sourceOffset:0
                 toBuffer:f.staging->buffer
        destinationOffset:0
                     size:4];
    [blit endEncoding];
    if (!state->permit())
      return nil;
    return command;
  }
  static void resume(Task &task) {
    @autoreleasepool {
      auto &f = *static_cast<Frame *>(task.frame());
      auto state = f.packet.state;
      if (f.started) {
        if (f.succeeded) {
          // Materialize a host result on the scheduler, never in the Metal callback.
          if (f.packet.kind == Kind::Download) {
            auto *destination = const_cast<Storage *>(f.result.storage_.get());
            std::memcpy(destination->host.data(), f.staging->buffer.contents, destination->size);
          }
          if (f.packet.kind == Kind::Reduce)
            std::memcpy(&f.scalar, f.staging->buffer.contents, 4);
          f.staging.reset();
          f.scratch.reset();
          f.packet.input = Buffer{};
          f.packet.right = Buffer{};
          f.packet.kernel = Kernel{};
          task.complete(f.packet.kind == Kind::Reduce ? static_cast<const void *>(&f.scalar)
                                                      : &f.result);
        } else {
          task.fault(static_cast<std::int64_t>(f.error));
        }
        return;
      }
      f.started = true;
      const auto &source = f.packet.input.storage_;
      if (!source) {
        task.fault(std::int64_t(Error::Invalid));
        return;
      }
      std::uint32_t index = source->deviceIndex;
      const bool compute = f.packet.kind == Kind::Compute || f.packet.kind == Kind::Elementwise;
      const bool upload = f.packet.kind == Kind::Upload;
      const bool reduce = f.packet.kind == Kind::Reduce;
      if (reduce) {
        const auto &kernel = f.packet.kernel.state_;
        if (!kernel || !kernel->reduction || source->format != Format::Float32 ||
            source->rank != 1 || source->size / 4 > UINT32_MAX) {
          task.fault(std::int64_t(Error::Invalid));
          return;
        }
        index = kernel->index;
        if (kernel->registry != state || !source->device || source->state != state ||
            source->deviceIndex != index) {
          task.fault(std::int64_t(Error::Residency));
          return;
        }
        if (!source->size) {
          task.complete(&f.scalar);
          return;
        }
      }
      if (compute) {
        const auto &kernel = f.packet.kernel.state_;
        const auto &right = f.packet.right.storage_;
        const auto signature =
            kernel && kernel->signature ? *kernel->signature : ElementwiseSignature{2, 0};
        if (!kernel || kernel->reduction ||
            kernel->elementwise != (f.packet.kind == Kind::Elementwise) ||
            f.packet.tensorCount != signature.tensors ||
            f.packet.scalarCount != signature.scalars || std::uint32_t(f.packet.operation) > 2 ||
            source->format != Format::Float32 || source->rank != 1 ||
            source->size / 4 > UINT32_MAX ||
            (signature.tensors == 2 && (!right || right->format != Format::Float32 ||
                                        right->rank != 1 || source->size != right->size))) {
          task.fault(std::int64_t(Error::Invalid));
          return;
        }
        index = kernel->index;
        if (kernel->registry != state || !source->device || source->state != state ||
            source->deviceIndex != index ||
            (signature.tensors == 2 &&
             (!right->device || right->state != state || right->deviceIndex != index))) {
          task.fault(std::int64_t(Error::Residency));
          return;
        }
      } else if (upload) {
        if (f.packet.target.state_ != state) {
          task.fault(std::int64_t(Error::Residency));
          return;
        }
        index = f.packet.target.index_;
        if (source->device && (source->state != state || source->deviceIndex != index)) {
          task.fault(std::int64_t(Error::Residency));
          return;
        }
      } else if (!reduce && source->device && source->state != state) {
        task.fault(std::int64_t(Error::Residency));
        return;
      }
      if (!compute && !reduce && source->device == upload) {
        task.complete(&f.packet.input);
        return;
      }
      auto count = state->inFlight.load();
      do {
        if (count >= state->options.maxInFlight) {
          task.fault(std::int64_t(Error::Budget));
          return;
        }
      } while (!state->inFlight.compare_exchange_weak(count, count + 1));
      f.active = true;
      id<MTLCommandBuffer> command = nil;
      if (reduce) {
        f.error = Error::Allocation;
        command = reductionCommand(f);
        if (!command) {
          task.fault(std::int64_t(f.error));
          return;
        }
        f.error = Error::Device;
      } else {
        auto result = allocateStorage(state, f.packet.input.shape(), source->format,
                                      upload || compute, index);
        if (!result) {
          task.fault(std::int64_t(result.error()));
          return;
        }
        f.result = Buffer(*result);
        if (!source->size) {
          task.complete(&f.result);
          return;
        }

        if (compute) {
          const auto &kernel = f.packet.kernel.state_;
          const auto tensors = kernel->signature ? kernel->signature->tensors : 2;
          const auto parameterBytes = kernel->signature ? 4 * (1 + kernel->signature->scalars) : 8;
          auto parametersBuffer = allocateMetal(state, index, parameterBytes, true);
          if (!parametersBuffer) {
            task.fault(std::int64_t(parametersBuffer.error()));
            return;
          }
          f.staging = *parametersBuffer;
          if (!state->permit() || !(command = [state->queues[index] commandBuffer])) {
            task.fault(std::int64_t(Error::Allocation));
            return;
          }
          id<MTLComputeCommandEncoder> encoder =
              state->permit() ? [command computeCommandEncoder] : nil;
          if (!encoder) {
            task.fault(std::int64_t(Error::Allocation));
            return;
          }
          [encoder setComputePipelineState:kernel->pipeline];
          [encoder setBuffer:source->metal->buffer offset:0 atIndex:0];
          if (tensors == 2)
            [encoder setBuffer:f.packet.right.storage_->metal->buffer offset:0 atIndex:1];
          [encoder setBuffer:(*result)->metal->buffer offset:0 atIndex:tensors];
          std::array<std::uint32_t, 9> parameters{};
          parameters[0] = std::uint32_t(source->size / 4);
          if (kernel->signature)
            std::copy_n(f.packet.scalarBits.begin(), f.packet.scalarCount, parameters.begin() + 1);
          else
            parameters[1] = std::uint32_t(f.packet.operation);
          std::memcpy(f.staging->buffer.contents, parameters.data(), parameterBytes);
          [encoder setBuffer:f.staging->buffer offset:0 atIndex:tensors + 1];
          [encoder dispatchThreadgroups:MTLSizeMake((std::uint64_t(parameters[0]) + 63) / 64, 1, 1)
                  threadsPerThreadgroup:MTLSizeMake(64, 1, 1)];
          [encoder endEncoding];
          if (!state->permit()) {
            task.fault(std::int64_t(Error::Allocation));
            return;
          }
        } else {
          auto staging = allocateMetal(state, index, source->size, true);
          if (!staging) {
            task.fault(std::int64_t(staging.error()));
            return;
          }
          f.staging = *staging;
          if (upload)
            std::memcpy(f.staging->buffer.contents, source->hostView().data(), source->size);
          if (!state->permit()) {
            task.fault(std::int64_t(Error::Allocation));
            return;
          }
          command = [state->queues[index] commandBuffer];
          if (!command) {
            task.fault(std::int64_t(Error::Allocation));
            return;
          }
          if (!state->permit()) {
            task.fault(std::int64_t(Error::Allocation));
            return;
          }
          id<MTLBlitCommandEncoder> blit = [command blitCommandEncoder];
          if (!blit) {
            task.fault(std::int64_t(Error::Allocation));
            return;
          }
          if (upload)
            [blit copyFromBuffer:f.staging->buffer
                     sourceOffset:0
                         toBuffer:(*result)->metal->buffer
                destinationOffset:0
                             size:source->size];
          else
            [blit copyFromBuffer:source->metal->buffer
                     sourceOffset:0
                         toBuffer:f.staging->buffer
                destinationOffset:0
                             size:source->size];
          [blit endEncoding];
          if (!state->permit()) {
            task.fault(std::int64_t(Error::Allocation));
            return;
          }
        }
      }
      auto completion = task.suspendExternal();
      if (!completion)
        return;
      auto *frame = &f;
      [command addCompletedHandler:^(id<MTLCommandBuffer> finished) {
        @autoreleasepool {
          // The external lease pins frame. Never access it after signal().
          {
            std::unique_lock lock(frame->packet.state->gateMutex);
            frame->packet.state->gate.wait(lock, [&] { return !frame->packet.state->hold; });
          }
          frame->succeeded = finished.status == MTLCommandBufferStatusCompleted &&
                             !frame->packet.state->failCompletion.exchange(false);
          ++frame->packet.state->completions;
          --frame->packet.state->inFlight;
          frame->active = false;
          completion.signal();
        }
      }];
      ++state->submissions;
      [command commit];
    }
  }
};
const ValueLayout Bridge::layout{0x4d4554414c01, sizeof(Buffer), alignof(Buffer), Bridge::copy,
                                 Bridge::destroyValue};
const TaskEntry Bridge::entry{1,
                              0x4d4554414c02,
                              sizeof(PacketData),
                              alignof(PacketData),
                              sizeof(Frame),
                              alignof(Frame),
                              Bridge::construct,
                              Bridge::destroy,
                              Bridge::resume,
                              &Bridge::layout};
const ValueLayout Bridge::scalarLayout{0x4b414c46533332, sizeof(float), alignof(float),
                                       Bridge::copyScalar, Bridge::destroyScalar};
const TaskEntry Bridge::reductionEntry{1,
                                       0x4d4554414c03,
                                       sizeof(PacketData),
                                       alignof(PacketData),
                                       sizeof(Frame),
                                       alignof(Frame),
                                       Bridge::construct,
                                       Bridge::destroy,
                                       Bridge::resume,
                                       &Bridge::scalarLayout};
Device::Device(std::shared_ptr<State> state, std::uint32_t index) noexcept
    : state_(std::move(state)), index_(index) {}
std::uint64_t Device::identity() const noexcept {
  return state_ ? state_->devices[index_].registryID : 0;
}
std::string_view Device::name() const noexcept {
  return state_ ? std::string_view(state_->names[index_]) : std::string_view{};
}
Buffer::Buffer(std::shared_ptr<const Storage> storage) noexcept : storage_(std::move(storage)) {}
std::uint64_t Buffer::bytes() const noexcept { return storage_ ? storage_->size : 0; }
std::span<const std::int64_t> Buffer::shape() const noexcept {
  return storage_ ? std::span<const std::int64_t>(storage_->dimensions.data(), storage_->rank)
                  : std::span<const std::int64_t>{};
}
bool Buffer::onDevice() const noexcept { return storage_ && storage_->device; }
Format Buffer::format() const noexcept { return storage_ ? storage_->format : Format::Float32; }
std::expected<std::span<const std::byte>, Error> Buffer::hostBytes() const noexcept {
  if (!storage_)
    return std::unexpected(Error::Invalid);
  if (storage_->device)
    return std::unexpected(Error::Residency);
  return storage_->hostView();
}
Runtime::Runtime(std::shared_ptr<State> state) noexcept : state_(std::move(state)) {}
std::expected<std::unique_ptr<Runtime>, Error> Runtime::create(Options options) noexcept {
  @autoreleasepool {
    if (!options.maxBytes || !options.maxInFlight)
      return std::unexpected(Error::Invalid);
    try {
      auto state = std::make_shared<State>();
      state->options = options;
      NSArray<id<MTLDevice>> *devices = MTLCopyAllDevices();
      state->devices = [devices
          sortedArrayUsingComparator:^NSComparisonResult(id<MTLDevice> a, id<MTLDevice> b) {
            return a.registryID < b.registryID   ? NSOrderedAscending
                   : a.registryID > b.registryID ? NSOrderedDescending
                                                 : NSOrderedSame;
          }];
      if (!state->devices.count || state->devices.count > UINT32_MAX ||
          options.defaultDevice >= state->devices.count)
        return std::unexpected(Error::Unavailable);
      NSMutableArray<id<MTLCommandQueue>> *queues = [NSMutableArray array];
      for (id<MTLDevice> device in state->devices) {
        state->names.emplace_back(device.name.UTF8String);
        id<MTLCommandQueue> queue = [device newCommandQueue];
        if (!queue)
          return std::unexpected(Error::Allocation);
        [queues addObject:queue];
      }
      state->queues = [queues copy];
      return std::unique_ptr<Runtime>(new Runtime(std::move(state)));
    } catch (...) {
      return std::unexpected(Error::Allocation);
    }
  }
}
std::uint32_t Runtime::deviceCount() const noexcept { return state_->devices.count; }
std::expected<Device, Error> Runtime::device() const noexcept {
  return device(state_->options.defaultDevice);
}
std::expected<Device, Error> Runtime::device(std::uint32_t index) const noexcept {
  if (index >= deviceCount())
    return std::unexpected(Error::Unavailable);
  return Device(state_, index);
}
std::expected<Buffer, Error> Runtime::hostTensor(std::span<const std::byte> data,
                                                 std::span<const std::int64_t> shape,
                                                 Format format) noexcept {
  auto bytes = tensorBytes(shape, format);
  if (!bytes)
    return std::unexpected(bytes.error());
  if (*bytes != data.size())
    return std::unexpected(Error::Invalid);
  auto storage = allocateStorage(state_, shape, format, false);
  if (!storage)
    return std::unexpected(storage.error());
  if (*bytes)
    std::memcpy((*storage)->host.data(), data.data(), *bytes);
  return Buffer(*storage);
}
std::expected<Buffer, Error> Runtime::fromCpu(const Invocation &context,
                                              CpuTensorView view) noexcept {
  auto size = tensorBytes(view.sizes, Format::Float32);
  if (!context.usable() || !size || view.sizes.size() != view.strides.size() || view.offset < 0)
    return std::unexpected(Error::Invalid);
  // Empty tensors never dereference or retain descriptor addresses.
  if (!*size)
    return hostTensor({}, view.sizes, Format::Float32);
  std::uint64_t stride = 1;
  for (std::size_t axis = view.sizes.size(); axis-- > 0;) {
    if (view.strides[axis] < 0 || std::uint64_t(view.strides[axis]) != stride)
      return std::unexpected(Error::Invalid);
    if (std::uint64_t(view.sizes[axis]) > UINT64_MAX / stride)
      return std::unexpected(Error::Invalid);
    stride *= std::uint64_t(view.sizes[axis]);
  }
  auto lease = context.lease(view.allocated);
  if (!lease)
    return std::unexpected(Error::Invalid);
  auto allocation = lease->bytes();
  auto base = reinterpret_cast<std::uintptr_t>(view.allocated);
  auto aligned = reinterpret_cast<std::uintptr_t>(view.aligned);
  if (aligned < base || aligned % alignof(float) || aligned - base > allocation.size())
    return std::unexpected(Error::Invalid);
  auto displacement = aligned - base;
  if (std::uint64_t(view.offset) > (allocation.size() - displacement) / 4)
    return std::unexpected(Error::Invalid);
  displacement += std::uint64_t(view.offset) * 4;
  if (*size > allocation.size() - displacement)
    return std::unexpected(Error::Invalid);
  if (!state_->permit())
    return std::unexpected(Error::Allocation);
  try {
    auto storage = std::make_shared<Storage>(state_, false);
    if (!state_->reserve(allocation.size()))
      return std::unexpected(Error::Budget);
    storage->hostReserved = allocation.size(); // Charge the complete retained allocation.
    storage->cpu = std::move(*lease);
    storage->cpuOffset = displacement;
    storage->size = *size;
    storage->rank = view.sizes.size();
    std::copy(view.sizes.begin(), view.sizes.end(), storage->dimensions.begin());
    return Buffer(std::move(storage));
  } catch (...) {
    return std::unexpected(Error::Allocation);
  }
}
std::expected<void *, Error> Runtime::exportCpu(Invocation &context, const Buffer &buffer,
                                                std::span<std::int64_t> sizes,
                                                std::span<std::int64_t> strides) noexcept {
  if (!context.usable() || !buffer || buffer.format() != Format::Float32 ||
      sizes.size() != buffer.shape().size() || strides.size() != sizes.size())
    return std::unexpected(Error::Invalid);
  auto bytes = buffer.hostBytes();
  if (!bytes)
    return std::unexpected(bytes.error()); // A device result must be explicitly downloaded.
  std::uint64_t stride = 1;
  for (std::size_t axis = sizes.size(); axis-- > 0;) {
    if (stride > INT64_MAX)
      return std::unexpected(Error::Invalid);
    sizes[axis] = buffer.shape()[axis];
    strides[axis] = stride;
    if (sizes[axis] && stride > UINT64_MAX / std::uint64_t(sizes[axis]))
      return std::unexpected(Error::Invalid);
    stride *= std::uint64_t(sizes[axis]);
  }
  auto *result = context.allocate(bytes->size());
  if (!result)
    return std::unexpected(Error::Allocation);
  if (!bytes->empty())
    std::memcpy(result, bytes->data(), bytes->size());
  return result;
}
TaskHandle Runtime::upload(TaskCore &core, GroupHandle group, Buffer buffer,
                           Device target) noexcept {
  Bridge::PacketData packet{
      state_, std::move(buffer), std::move(target), Bridge::Kind::Upload, {}, BinaryOperation::Add,
      {}};
  return core.submit(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::download(TaskCore &core, GroupHandle group, Buffer buffer) noexcept {
  Bridge::PacketData packet{state_, std::move(buffer),    {}, Bridge::Kind::Download,
                            {},     BinaryOperation::Add, {}};
  return core.submit(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::upload(Task &task, GroupHandle group, Buffer buffer, Device target) noexcept {
  Bridge::PacketData packet{
      state_, std::move(buffer), std::move(target), Bridge::Kind::Upload, {}, BinaryOperation::Add,
      {}};
  return task.spawn(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::download(Task &task, GroupHandle group, Buffer buffer) noexcept {
  Bridge::PacketData packet{state_, std::move(buffer),    {}, Bridge::Kind::Download,
                            {},     BinaryOperation::Add, {}};
  return task.spawn(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
std::expected<Kernel, Error> Runtime::loadBinary32Kernel(std::string_view path,
                                                         Device device) noexcept {
  return loadKernel(path, std::move(device), false);
}
std::expected<Kernel, Error> Runtime::loadElementwiseKernel(std::string_view path,
                                                            Device device) noexcept {
  return loadKernel(path, std::move(device), true);
}
std::expected<Kernel, Error>
Runtime::loadElementwiseKernel(std::string_view path, Device device,
                               ElementwiseSignature signature) noexcept {
  return loadKernel(path, std::move(device), true, signature);
}
std::expected<Kernel, Error> Runtime::loadKernel(std::string_view path, Device device,
                                                 bool elementwise,
                                                 std::optional<ElementwiseSignature> signature,
                                                 bool reduction) noexcept {
  @autoreleasepool {
    if (signature && (!elementwise || signature->tensors < 1 || signature->tensors > 2 ||
                      signature->scalars > 8))
      return std::unexpected(Error::Invalid);
    if (device.state_ != state_)
      return std::unexpected(Error::Residency);
    if (path.empty() || path.find('\0') != std::string_view::npos)
      return std::unexpected(Error::Invalid);
    try {
      if (!state_->permit())
        return std::unexpected(Error::Allocation);
      NSString *name = [[NSString alloc] initWithBytes:path.data()
                                                length:path.size()
                                              encoding:NSUTF8StringEncoding];
      if (!name)
        return std::unexpected(Error::Invalid);
      NSError *error = nil;
      id<MTLLibrary> library =
          [state_->devices[device.index_] newLibraryWithURL:[NSURL fileURLWithPath:name]
                                                      error:&error];
      if (!library)
        return std::unexpected(Error::Invalid);
      id<MTLFunction> function = [library
          newFunctionWithName:reduction ? @"kalandra_reduce_sum"
                              : signature
                                  ? @"kalandra_elementwise_v2"
                                  : (elementwise ? @"kalandra_elementwise" : @"strict_binary32")];
      if (!function)
        return std::unexpected(Error::Invalid);
      MTLComputePipelineReflection *reflection = nil;
      id<MTLComputePipelineState> pipeline = [state_->devices[device.index_]
          newComputePipelineStateWithFunction:function
                                      options:MTLPipelineOptionBufferTypeInfo |
                                              MTLPipelineOptionBindingInfo
                                   reflection:&reflection
                                        error:&error];
      if (!pipeline || pipeline.maxTotalThreadsPerThreadgroup < 64)
        return std::unexpected(Error::Unavailable);
      // Validate the private dynamic-array ABI, not the numerical contents of arbitrary shaders.
      const auto tensors = signature ? signature->tensors : 2;
      const auto parameterIndex = tensors + 1, bindingCount = tensors + 2;
      const auto words = signature ? signature->scalars + 1 : 2;
      if (reflection.bindings.count != bindingCount)
        return std::unexpected(Error::Invalid);
      bool seen[4] = {};
      for (id<MTLBinding> argument in reflection.bindings) {
        if (argument.type != MTLBindingTypeBuffer || argument.index >= bindingCount ||
            seen[argument.index] ||
            ((id<MTLBufferBinding>)argument).bufferDataSize !=
                (argument.index == parameterIndex ? 4 * words : 4))
          return std::unexpected(Error::Invalid);
        id<MTLBufferBinding> binding = (id<MTLBufferBinding>)argument;
        auto members = binding.bufferStructType.members;
        if (binding.bufferAlignment != 4 || members.count != 1)
          return std::unexpected(Error::Invalid);
        MTLStructMember *member = members[0];
        MTLArrayType *array = member.arrayType;
        if (member.offset != 0 || member.dataType != MTLDataTypeArray || !array ||
            array.stride != 4 ||
            array.arrayLength != (argument.index == parameterIndex ? words : 1) ||
            array.elementType !=
                (argument.index == parameterIndex ? MTLDataTypeUInt : MTLDataTypeFloat))
          return std::unexpected(Error::Invalid);
        seen[argument.index] = true;
      }
      if (!state_->permit())
        return std::unexpected(Error::Allocation);
      Kernel kernel;
      kernel.state_ = std::make_shared<KernelState>(state_, device.index_, pipeline, elementwise,
                                                    reduction, signature);
      return kernel;
    } catch (...) {
      return std::unexpected(Error::Allocation);
    }
  }
}
std::expected<Kernel, Error> Runtime::loadReductionKernel(std::string_view path,
                                                          Device device) noexcept {
  return loadKernel(path, std::move(device), true, ElementwiseSignature{1, 0}, true);
}
TaskHandle Runtime::reduceSum(TaskCore &core, GroupHandle group, Kernel kernel,
                              Buffer input) noexcept {
  Bridge::PacketData packet{
      state_, std::move(input), {}, Bridge::Kind::Reduce, std::move(kernel), BinaryOperation::Add,
      {}};
  return core.submit(group, Bridge::reductionEntry,
                     {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::reduceSum(Task &task, GroupHandle group, Kernel kernel, Buffer input) noexcept {
  Bridge::PacketData packet{
      state_, std::move(input), {}, Bridge::Kind::Reduce, std::move(kernel), BinaryOperation::Add,
      {}};
  return task.spawn(group, Bridge::reductionEntry,
                    {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
}
const ValueLayout &Runtime::scalarLayout() noexcept { return Bridge::scalarLayout; }
TaskHandle Runtime::compute(TaskCore &core, GroupHandle group, Kernel kernel,
                            BinaryOperation operation, Buffer left, Buffer right) noexcept {
  Bridge::PacketData packet{
      state_,    std::move(left), {}, Bridge::Kind::Compute, std::move(kernel),
      operation, std::move(right)};
  return core.submit(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::compute(Task &task, GroupHandle group, Kernel kernel, BinaryOperation operation,
                            Buffer left, Buffer right) noexcept {
  Bridge::PacketData packet{
      state_,    std::move(left), {}, Bridge::Kind::Compute, std::move(kernel),
      operation, std::move(right)};
  return task.spawn(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::elementwise(TaskCore &core, GroupHandle group, Kernel kernel, Buffer left,
                                Buffer right) noexcept {
  Bridge::PacketData packet{state_,
                            std::move(left),
                            {},
                            Bridge::Kind::Elementwise,
                            std::move(kernel),
                            BinaryOperation::Add,
                            std::move(right)};
  return core.submit(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::elementwise(Task &task, GroupHandle group, Kernel kernel, Buffer left,
                                Buffer right) noexcept {
  Bridge::PacketData packet{state_,
                            std::move(left),
                            {},
                            Bridge::Kind::Elementwise,
                            std::move(kernel),
                            BinaryOperation::Add,
                            std::move(right)};
  return task.spawn(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::elementwise(TaskCore &core, GroupHandle group, Kernel kernel,
                                std::span<const Buffer> tensors,
                                std::span<const float> scalars) noexcept {
  Bridge::PacketData packet{state_,
                            tensors.empty() ? Buffer{} : tensors[0],
                            {},
                            Bridge::Kind::Elementwise,
                            std::move(kernel),
                            BinaryOperation::Add,
                            tensors.size() < 2 ? Buffer{} : tensors[1]};
  packet.tensorCount = tensors.size() > 2 ? UINT32_MAX : std::uint32_t(tensors.size());
  packet.scalarCount = scalars.size() > 8 ? UINT32_MAX : std::uint32_t(scalars.size());
  if (scalars.size() <= 8)
    for (std::size_t i = 0; i < scalars.size(); ++i)
      packet.scalarBits[i] = std::bit_cast<std::uint32_t>(scalars[i]);
  return core.submit(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::elementwise(Task &task, GroupHandle group, Kernel kernel,
                                std::span<const Buffer> tensors,
                                std::span<const float> scalars) noexcept {
  Bridge::PacketData packet{state_,
                            tensors.empty() ? Buffer{} : tensors[0],
                            {},
                            Bridge::Kind::Elementwise,
                            std::move(kernel),
                            BinaryOperation::Add,
                            tensors.size() < 2 ? Buffer{} : tensors[1]};
  packet.tensorCount = tensors.size() > 2 ? UINT32_MAX : std::uint32_t(tensors.size());
  packet.scalarCount = scalars.size() > 8 ? UINT32_MAX : std::uint32_t(scalars.size());
  if (scalars.size() <= 8)
    for (std::size_t i = 0; i < scalars.size(); ++i)
      packet.scalarBits[i] = std::bit_cast<std::uint32_t>(scalars[i]);
  return task.spawn(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
const ValueLayout &Runtime::bufferLayout() noexcept { return Bridge::layout; }
Stats Runtime::stats() const noexcept {
  return {state_->bytes,          state_->peakBytes,    state_->hostBackings,
          state_->deviceBackings, state_->metalBuffers, state_->stagingBuffers,
          state_->inFlight,       state_->submissions,  state_->completions,
          state_->attempts};
}
void Runtime::failAllocationAt(std::uint64_t attempt) noexcept {
  state_->attempts = 0;
  state_->failAt = attempt;
}
void Runtime::failNextCompletion() noexcept { state_->failCompletion = true; }
void Runtime::holdCompletions(bool hold) noexcept {
  {
    std::lock_guard lock(state_->gateMutex);
    state_->hold = hold;
  }
  if (!hold)
    state_->gate.notify_all();
}
} // namespace kalandra::runtime::metal
