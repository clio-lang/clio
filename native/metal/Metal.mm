#include "Metal.h"
#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#include <algorithm>
#include <array>
#include <atomic>
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
  enum class Kind { Upload, Download, Compute };
  struct PacketData {
    std::shared_ptr<State> state;
    Buffer input;
    Device target;
    Kind kind;
    Kernel kernel;
    BinaryOperation operation = BinaryOperation::Add;
    Buffer right;
  };
  struct Frame {
    PacketData packet;
    Buffer result;
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
  static const TaskEntry entry;
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
          f.staging.reset();
          f.packet.input = Buffer{};
          f.packet.right = Buffer{};
          f.packet.kernel = Kernel{};
          task.complete(&f.result);
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
      const bool compute = f.packet.kind == Kind::Compute;
      const bool upload = f.packet.kind == Kind::Upload;
      if (compute) {
        const auto &kernel = f.packet.kernel.state_;
        const auto &right = f.packet.right.storage_;
        if (!kernel || !right || std::uint32_t(f.packet.operation) > 2 ||
            source->format != Format::Float32 || right->format != Format::Float32 ||
            source->rank != 1 || right->rank != 1 || source->size != right->size ||
            source->size / 4 > UINT32_MAX) {
          task.fault(std::int64_t(Error::Invalid));
          return;
        }
        index = kernel->index;
        if (kernel->registry != state || !source->device || !right->device ||
            source->state != state || right->state != state || source->deviceIndex != index ||
            right->deviceIndex != index) {
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
      } else if (source->device && source->state != state) {
        task.fault(std::int64_t(Error::Residency));
        return;
      }
      if (!compute && source->device == upload) {
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
      auto result =
          allocateStorage(state, f.packet.input.shape(), source->format, upload || compute, index);
      if (!result) {
        task.fault(std::int64_t(result.error()));
        return;
      }
      f.result = Buffer(*result);
      if (!source->size) {
        task.complete(&f.result);
        return;
      }
      id<MTLCommandBuffer> command = nil;
      if (compute) {
        auto parametersBuffer = allocateMetal(state, index, 8, true);
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
        const auto &kernel = f.packet.kernel.state_;
        [encoder setComputePipelineState:kernel->pipeline];
        [encoder setBuffer:source->metal->buffer offset:0 atIndex:0];
        [encoder setBuffer:f.packet.right.storage_->metal->buffer offset:0 atIndex:1];
        [encoder setBuffer:(*result)->metal->buffer offset:0 atIndex:2];
        const std::uint32_t parameters[] = {std::uint32_t(source->size / 4),
                                            std::uint32_t(f.packet.operation)};
        std::memcpy(f.staging->buffer.contents, parameters, sizeof(parameters));
        [encoder setBuffer:f.staging->buffer offset:0 atIndex:3];
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
          std::memcpy(f.staging->buffer.contents, source->host.data(), source->size);
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
  return std::span<const std::byte>(storage_->host);
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
  @autoreleasepool {
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
      id<MTLFunction> function = [library newFunctionWithName:@"strict_binary32"];
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
      if (reflection.bindings.count != 4)
        return std::unexpected(Error::Invalid);
      bool seen[4] = {};
      for (id<MTLBinding> argument in reflection.bindings) {
        if (argument.type != MTLBindingTypeBuffer || argument.index >= 4 || seen[argument.index] ||
            ((id<MTLBufferBinding>)argument).bufferDataSize != (argument.index == 3 ? 8 : 4))
          return std::unexpected(Error::Invalid);
        id<MTLBufferBinding> binding = (id<MTLBufferBinding>)argument;
        auto members = binding.bufferStructType.members;
        if (binding.bufferAlignment != 4 || members.count != 1)
          return std::unexpected(Error::Invalid);
        MTLStructMember *member = members[0];
        MTLArrayType *array = member.arrayType;
        if (member.offset != 0 || member.dataType != MTLDataTypeArray || !array ||
            array.stride != 4 || array.arrayLength != (argument.index == 3 ? 2 : 1) ||
            array.elementType != (argument.index == 3 ? MTLDataTypeUInt : MTLDataTypeFloat))
          return std::unexpected(Error::Invalid);
        seen[argument.index] = true;
      }
      if (!state_->permit())
        return std::unexpected(Error::Allocation);
      Kernel kernel;
      kernel.state_ = std::make_shared<KernelState>(state_, device.index_, pipeline);
      return kernel;
    } catch (...) {
      return std::unexpected(Error::Allocation);
    }
  }
}
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
