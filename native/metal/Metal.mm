#include "Metal.h"
#include "ElementwiseLayout.h"
#include "MatmulLayout.h"
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
  std::atomic<std::uint64_t> argumentBytes{0}, peakArgumentBytes{0}, argumentPacks{0};
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
  bool elementwise, reduction, matrix;
  std::optional<ElementwiseSignature> signature;
  std::array<id<MTLComputePipelineState>, 2> matrixTiles{};
  // Backend resource bound, independent of logical signature arity.
  std::array<std::uint32_t, directBufferEntries - 2> reads{};
  std::uint32_t readCount = 2;
  bool projected = false;
  std::vector<std::uint32_t> indirectReads;
  id<MTLFunction> argumentFunction = nil;
  std::uint64_t encodedBytes = 0;
  bool indirect() const { return argumentFunction != nil; }
  std::uint32_t tensorIndex(std::size_t i) const {
    return indirect() ? indirectReads[i] : reads[i];
  }
};
namespace {
std::expected<std::uint64_t, Error> tensorBytes(std::span<const std::int64_t> shape,
                                                Format format) {
  if (shape.size() > 8)
    return std::unexpected(Error::Invalid);
  const auto type = storageNumericType(format);
  if (!type)
    return std::unexpected(Error::Invalid);
  bool zero = false;
  for (auto dimension : shape) {
    if (dimension < 0)
      return std::unexpected(Error::Invalid);
    zero |= dimension == 0;
  }
  if (zero)
    return 0;
  std::uint64_t n = 1;
  for (auto dimension : shape) {
    if (std::uint64_t(dimension) > UINT64_MAX / n)
      return std::unexpected(Error::Invalid);
    n *= std::uint64_t(dimension);
  }
  auto bytes = checkedNumericBytes(*type, n, std::numeric_limits<std::size_t>::max());
  if (!bytes)
    return std::unexpected(Error::Invalid);
  return *bytes;
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
// Immutable submission-owned captures. Requested array payload is budgeted
// separately from tensor/staging bytes; vector/control allocator overhead is not.
struct Arguments {
  std::shared_ptr<State> state;
  std::vector<Buffer> tensors;
  std::vector<std::uint32_t> scalarBits;
  std::uint64_t reserved = 0;
  explicit Arguments(std::shared_ptr<State> s) : state(std::move(s)) { ++state->argumentPacks; }
  ~Arguments() {
    state->argumentBytes -= reserved;
    --state->argumentPacks;
  }
};
// Submission-owned workspace, mutated only by its single scheduled task.
struct MatrixGraphArguments {
  std::shared_ptr<State> state;
  std::uint64_t reserved = 0;
  std::size_t inputs = 0;
  std::vector<Buffer> values;
  std::vector<std::uint32_t> ranks, reductions;
  std::vector<Buffer> reduced;
  Kernel join;
  std::shared_ptr<const Arguments> joinArguments;
  std::vector<MatrixProduct> products;
  std::vector<Kernel> maps;
  std::vector<std::shared_ptr<const Arguments>> mapArguments;
  std::vector<std::uint32_t> uses;
  std::vector<std::array<std::int64_t, 2>> shapes;
  explicit MatrixGraphArguments(std::shared_ptr<State> s) : state(std::move(s)) {
    ++state->argumentPacks;
  }
  ~MatrixGraphArguments() {
    state->argumentBytes -= reserved;
    --state->argumentPacks;
  }
};
struct Bridge {
  enum class Kind { Upload, Download, Compute, Elementwise, Reduce, Matmul };
  struct PacketData {
    std::shared_ptr<State> state;
    Buffer input;
    Device target;
    Kind kind;
    Kernel kernel;
    BinaryOperation operation = BinaryOperation::Add;
    Buffer right;
    std::shared_ptr<const Arguments> arguments{};
    std::optional<Error> preparation{};
    Kernel reduction{}, epilogue{}, matrixPost{};
    Buffer replacement{};
    std::shared_ptr<const Arguments> postArguments{}, scalarArguments{};
    Kernel matrixLeftMap{}, matrixRightMap{};
    std::shared_ptr<const Arguments> leftArguments{}, rightArguments{};
    std::shared_ptr<MatrixGraphArguments> graph{};
  };
  static std::expected<std::shared_ptr<const Arguments>, Error>
  capture(std::shared_ptr<State> state, const Kernel &kernel, std::span<const Buffer> tensors,
          std::span<const float> scalars) noexcept {
    const auto expected = kernel.state_ && kernel.state_->signature ? *kernel.state_->signature
                                                                    : ElementwiseSignature{2, 0};
    if (!kernel.state_ || !kernel.state_->elementwise || kernel.state_->reduction ||
        kernel.state_->matrix || tensors.size() != expected.tensors ||
        scalars.size() != expected.scalars ||
        (tensors.empty() || tensors.size() > UINT32_MAX || scalars.size() >= UINT32_MAX))
      return std::unexpected(Error::Invalid);
    if (kernel.state_->registry != state)
      return std::unexpected(Error::Residency);
    const auto bytes = std::uint64_t(tensors.size()) * sizeof(Buffer) +
                       std::uint64_t(scalars.size()) * sizeof(std::uint32_t);
    try {
      if (!state->permit())
        return std::unexpected(Error::Allocation);
      auto result = std::make_shared<Arguments>(state);
      auto used = state->argumentBytes.load();
      do {
        if (bytes > state->options.maxArgumentBytes - used)
          return std::unexpected(Error::Budget);
      } while (!state->argumentBytes.compare_exchange_weak(used, used + bytes));
      result->reserved = bytes;
      auto peak = state->peakArgumentBytes.load();
      while (peak < used + bytes &&
             !state->peakArgumentBytes.compare_exchange_weak(peak, used + bytes)) {
      }
      if (!state->permit())
        return std::unexpected(Error::Allocation);
      result->tensors.assign(tensors.begin(), tensors.end());
      if (!scalars.empty()) {
        if (!state->permit())
          return std::unexpected(Error::Allocation);
        result->scalarBits.resize(scalars.size());
        for (std::size_t i = 0; i < scalars.size(); ++i)
          result->scalarBits[i] = std::bit_cast<std::uint32_t>(scalars[i]);
      }
      return result;
    } catch (...) {
      return std::unexpected(Error::Allocation);
    }
  }
  static std::expected<std::shared_ptr<MatrixGraphArguments>, Error>
  captureGraph(std::shared_ptr<State> state, const Kernel &kernel, std::span<const Buffer> inputs,
               std::span<const MatrixProduct> products, std::span<const Kernel> maps = {},
               std::span<const float> scalars = {},
               std::span<const std::uint32_t> roots = {}) noexcept {
    if ((!maps.empty() && maps.size() != products.size()) || (maps.empty() && !scalars.empty()))
      return std::unexpected(Error::Invalid);
    if (!kernel.state_ ||
        (!kernel.state_->matrix && (roots.empty() || !kernel.state_->reduction)) ||
        inputs.empty() || (products.empty() && roots.empty()) || inputs.size() > UINT32_MAX ||
        products.size() > UINT32_MAX / 2 || inputs.size() + products.size() > UINT32_MAX)
      return std::unexpected(Error::Invalid);
    if (kernel.state_->registry != state)
      return std::unexpected(Error::Residency);
    const auto count = inputs.size() + products.size();
    const auto bytes =
        std::uint64_t(roots.size()) * (sizeof(std::uint32_t) + sizeof(Buffer)) +
        std::uint64_t(maps.size()) * (sizeof(Kernel) + sizeof(std::shared_ptr<const Arguments>)) +
        std::uint64_t(count) *
            (sizeof(Buffer) + sizeof(std::uint32_t) + sizeof(std::array<std::int64_t, 2>) +
             (roots.empty() ? 0 : sizeof(std::uint32_t))) +
        std::uint64_t(products.size()) * sizeof(MatrixProduct);
    try {
      if (!state->permit())
        return std::unexpected(Error::Allocation);
      auto result = std::make_shared<MatrixGraphArguments>(state);
      auto used = state->argumentBytes.load();
      do {
        if (used > state->options.maxArgumentBytes ||
            bytes > state->options.maxArgumentBytes - used)
          return std::unexpected(Error::Budget);
      } while (!state->argumentBytes.compare_exchange_weak(used, used + bytes));
      result->reserved = bytes;
      auto peak = state->peakArgumentBytes.load();
      while (peak < used + bytes &&
             !state->peakArgumentBytes.compare_exchange_weak(peak, used + bytes)) {
      }
      if (!state->permit())
        return std::unexpected(Error::Allocation);
      result->values.resize(count);
      if (!state->permit())
        return std::unexpected(Error::Allocation);
      result->products.assign(products.begin(), products.end());
      if (!state->permit())
        return std::unexpected(Error::Allocation);
      result->uses.resize(count);
      if (!state->permit())
        return std::unexpected(Error::Allocation);
      result->shapes.resize(count);
      if (!maps.empty()) {
        if (!state->permit())
          return std::unexpected(Error::Allocation);
        result->maps.assign(maps.begin(), maps.end());
        if (!state->permit())
          return std::unexpected(Error::Allocation);
        result->mapArguments.resize(maps.size());
      }
      if (!roots.empty()) {
        if (roots.size() > UINT32_MAX / 2)
          return std::unexpected(Error::Invalid);
        if (!state->permit())
          return std::unexpected(Error::Allocation);
        result->ranks.resize(count);
        if (!state->permit())
          return std::unexpected(Error::Allocation);
        result->reductions.assign(roots.begin(), roots.end());
        if (!state->permit())
          return std::unexpected(Error::Allocation);
        result->reduced.resize(roots.size());
      }
      result->inputs = inputs.size();
      for (std::size_t i = 0; i < inputs.size(); ++i) {
        const auto &input = inputs[i].storage_;
        if (!input || (input->rank != 2 && (roots.empty() || input->rank != 1)) ||
            input->format != Format::Float32 || input->size / 4 > UINT32_MAX)
          return std::unexpected(Error::Invalid);
        if (!input->device || input->state != state || input->deviceIndex != kernel.state_->index)
          return std::unexpected(Error::Residency);
        if (std::uint64_t(input->dimensions[0]) > UINT32_MAX ||
            std::uint64_t(input->dimensions[1]) > UINT32_MAX)
          return std::unexpected(Error::Invalid);
        result->values[i] = inputs[i];
        result->shapes[i] = {input->dimensions[0], input->rank == 2 ? input->dimensions[1] : 1};
        if (!roots.empty())
          result->ranks[i] = input->rank;
      }
      for (std::size_t i = 0; i < products.size(); ++i) {
        const auto edge = products[i];
        const auto output = inputs.size() + i;
        if (edge.left >= output || edge.right >= output)
          return std::unexpected(Error::Invalid);
        const auto a = result->shapes[edge.left], b = result->shapes[edge.right];
        const bool map = !maps.empty() && bool(maps[i]);
        if (map) {
          const auto &mapping = maps[i].state_;
          const auto tensors = edge.left == edge.right ? 1u : 2u;
          if (edge.left > edge.right || !mapping->elementwise || mapping->matrix ||
              mapping->reduction || mapping->projected || mapping->indirect() ||
              mapping->signature.value_or(ElementwiseSignature{2, 0}) !=
                  ElementwiseSignature{tensors, std::uint32_t(scalars.size())} ||
              (a != b || (!roots.empty() && result->ranks[edge.left] != result->ranks[edge.right])))
            return std::unexpected(Error::Invalid);
          if (mapping->registry != state || mapping->index != kernel.state_->index)
            return std::unexpected(Error::Residency);
          std::array<Buffer, 2> placeholders{};
          auto args = capture(state, maps[i], std::span<const Buffer>(placeholders).first(tensors),
                              scalars);
          if (!args)
            return std::unexpected(args.error());
          result->mapArguments[i] = *args;
          result->shapes[output] = a;
        } else {
          if (!kernel.state_->matrix ||
              (!roots.empty() &&
               (result->ranks[edge.left] != 2 || result->ranks[edge.right] != 2)) ||
              a[1] != b[0] || std::uint64_t(a[0]) * std::uint64_t(b[1]) > UINT32_MAX)
            return std::unexpected(Error::Invalid);
          result->shapes[output] = {a[0], b[1]};
        }
        if (!roots.empty())
          result->ranks[output] = map ? result->ranks[edge.left] : 2;
        ++result->uses[edge.left];
        ++result->uses[edge.right];
      }
      for (auto root : roots) {
        if (root >= count || result->uses[root] == UINT32_MAX)
          return std::unexpected(Error::Invalid);
        ++result->uses[root];
      }
      for (std::size_t i = inputs.size(); i < (roots.empty() ? count - 1 : count); ++i)
        if (!result->uses[i])
          return std::unexpected(Error::Invalid);
      for (std::size_t i = 0; i < inputs.size(); ++i)
        if (!result->uses[i])
          result->values[i] = {};
      return result;
    } catch (...) {
      return std::unexpected(Error::Allocation);
    }
  }
  // Each invocation owns two alternating outputs and up to 32 immutable count words.
  // A serial encoder orders dispatches and tracked buffer accesses during reuse.
  struct ReductionScratch {
    std::array<std::shared_ptr<MetalAllocation>, 2> outputs{};
    // Apple-family devices pack all words into counts[0]. Other GPUs retain
    // separate offset-zero buffers rather than assuming Apple offset alignment.
    std::array<std::shared_ptr<MetalAllocation>, 32> counts{};
    std::shared_ptr<MetalAllocation> seed, postOutput, postParameters;
  };
  struct Frame {
    PacketData packet;
    Buffer result;
    Buffer matrixLeft{}, matrixRight{};
    Kernel matrixKernel{}, graphKernel{};
    std::size_t graphStage = 0, reductionStage = 0;
    unsigned graphPhase = 0;
    std::shared_ptr<MetalAllocation> joinReadback;
    unsigned matrixStage = 0; // 1: left map, 2: right map, 3: multiply.
    float scalar = 0;
    std::unique_ptr<ReductionScratch> scratch;
    std::shared_ptr<MetalAllocation> staging, resources;
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
  static const Buffer &tensor(const Frame &frame, std::size_t index) {
    if (frame.packet.graph && frame.packet.kind == Kind::Elementwise) {
      if (frame.graphPhase == 2)
        return frame.packet.graph->reduced[index];
      const auto edge = frame.packet.graph->products[frame.graphStage];
      return frame.packet.graph->values[index == 0 ? edge.left : edge.right];
    }
    return index == 0 && frame.packet.replacement ? frame.packet.replacement
                                                  : frame.packet.arguments->tensors[index];
  }
  static void matrixMaps(PacketData &packet, Kernel left, Kernel right,
                         std::span<const Buffer> inputs, std::span<const float> scalars) noexcept {
    if (!left && !right) {
      if (!inputs.empty() || !scalars.empty())
        packet.preparation = Error::Invalid;
      return;
    }
    const auto &base = packet.kernel.state_;
    for (auto *map : {&left, &right}) {
      if (!*map)
        continue;
      if (!base || !base->matrix || !map->state_ || map->state_->index != base->index) {
        packet.preparation = Error::Invalid;
        return;
      }
      auto args = capture(packet.state, *map, inputs, scalars);
      if (!args) {
        packet.preparation = args.error();
        return;
      }
      (map == &left ? packet.leftArguments : packet.rightArguments) = *args;
    }
    packet.matrixLeftMap = std::move(left);
    packet.matrixRightMap = std::move(right);
  }
  static const ValueLayout layout;
  static const TaskEntry entry, reductionEntry;
  static id<MTLCommandBuffer> reductionCommand(Frame &f) {
    auto state = f.packet.state;
    auto index = f.packet.kernel.state_->index;
    if (!state->permit())
      return nil;
    f.scratch.reset(new (std::nothrow) ReductionScratch{});
    if (!f.scratch)
      return nil;
    const bool resident = f.packet.graph && f.graphPhase == 1;
    if (resident) {
      auto output =
          allocateStorage(state, std::array<std::int64_t, 1>{1}, Format::Float32, true, index);
      if (!output) {
        f.error = output.error();
        return nil;
      }
      f.result = Buffer(*output);
    } else {
      auto readback = allocateMetal(state, index, 4, true);
      if (!readback) {
        f.error = readback.error();
        return nil;
      }
      f.staging = *readback;
    }
    id<MTLCommandBuffer> command = state->permit() ? [state->queues[index] commandBuffer] : nil;
    if (!command)
      return nil;
    std::uint64_t length = f.packet.input.bytes() / 4;
    // Empty device storage has no Metal allocation. The epilogue uses a
    // separately owned positive-zero seed rather than dereferencing that storage.
    id<MTLBuffer> input = length ? f.packet.input.storage_->metal->buffer : nil;
    if (f.packet.epilogue) {
      // All fallible epilogue storage is prepared before opening any encoder.
      auto output = allocateMetal(state, index, 4, false);
      if (!output) {
        f.error = output.error();
        return nil;
      }
      f.scratch->postOutput = *output;
      const auto &bits = f.packet.scalarArguments->scalarBits;
      auto parameters = allocateMetal(state, index, (std::uint64_t(bits.size()) + 1) * 4, true);
      if (!parameters) {
        f.error = parameters.error();
        return nil;
      }
      f.scratch->postParameters = *parameters;
      auto *words = static_cast<std::uint32_t *>(f.scratch->postParameters->buffer.contents);
      words[0] = 1;
      std::copy(bits.begin(), bits.end(), words + 1);
      if (!length) {
        auto seed = allocateMetal(state, index, 4, true);
        if (!seed) {
          f.error = seed.error();
          return nil;
        }
        f.scratch->seed = *seed;
        std::uint32_t zero = 0;
        std::memcpy(f.scratch->seed->buffer.contents, &zero, 4);
        input = f.scratch->seed->buffer;
        length = 1;
      }
    }
    if (resident && !length) {
      auto seed = allocateMetal(state, index, 4, true);
      if (!seed) {
        f.error = seed.error();
        return nil;
      }
      f.scratch->seed = *seed;
      std::uint32_t zero = 0;
      std::memcpy(f.scratch->seed->buffer.contents, &zero, 4);
      input = f.scratch->seed->buffer;
      length = 1;
    }
    const bool packedCounts = [state->devices[index] supportsFamily:MTLGPUFamilyApple1];
    unsigned levels = 0;
    for (auto remaining = length; remaining > 1; remaining = (remaining + 1) / 2)
      ++levels;
    if (levels && packedCounts) {
      // Apple-family constant buffer offsets permit four-byte alignment. Each
      // dispatch receives a distinct immutable word, retained until acknowledgement.
      auto count = allocateMetal(state, index, levels * 4, true);
      if (!count) {
        f.error = count.error();
        return nil;
      }
      f.scratch->counts[0] = *count;
    }
    unsigned level = 0;
    while (length > 1) {
      const auto next = (length + 1) / 2;
      auto &output = f.scratch->outputs[level % 2];
      if (!output) {
        auto allocated = allocateMetal(state, index, next * 4, false);
        if (!allocated) {
          f.error = allocated.error();
          return nil;
        }
        output = *allocated;
      }
      // Later levels only shrink. Never write into the input or the current read buffer.
      if (!packedCounts) {
        auto count = allocateMetal(state, index, 4, true);
        if (!count) {
          f.error = count.error();
          return nil;
        }
        f.scratch->counts[level] = *count;
      }
      auto bits = std::uint32_t(length);
      auto count = f.scratch->counts[packedCounts ? 0 : level]->buffer;
      std::memcpy(static_cast<std::byte *>(count.contents) + (packedCounts ? level * 4 : 0), &bits,
                  4);
      length = next;
      ++level;
    }
    // Finish fallible storage preparation before opening an encoder. Every early
    // allocation failure can unwind without leaving an active encoder behind.
    if (level) {
      id<MTLComputeCommandEncoder> encoder =
          state->permit() ? [command computeCommandEncoderWithDispatchType:MTLDispatchTypeSerial]
                          : nil;
      if (!encoder)
        return nil;
      [encoder setComputePipelineState:f.packet.kernel.state_->pipeline];
      length = f.packet.input.bytes() / 4;
      for (unsigned i = 0; i < level; ++i) {
        const auto next = (length + 1) / 2;
        const auto &output = f.scratch->outputs[i % 2];
        [encoder setBuffer:input offset:0 atIndex:0];
        [encoder setBuffer:output->buffer offset:0 atIndex:1];
        [encoder setBuffer:f.scratch->counts[packedCounts ? 0 : i]->buffer
                    offset:packedCounts ? i * 4 : 0
                   atIndex:2];
        [encoder dispatchThreadgroups:MTLSizeMake((next + 63) / 64, 1, 1)
                threadsPerThreadgroup:MTLSizeMake(64, 1, 1)];
        input = output->buffer;
        length = next;
      }
      [encoder endEncoding];
    }
    if (f.packet.epilogue) {
      id<MTLComputeCommandEncoder> encoder =
          state->permit() ? [command computeCommandEncoder] : nil;
      if (!encoder)
        return nil;
      [encoder setComputePipelineState:f.packet.epilogue.state_->pipeline];
      [encoder setBuffer:input offset:0 atIndex:0];
      [encoder setBuffer:f.scratch->postOutput->buffer offset:0 atIndex:1];
      [encoder setBuffer:f.scratch->postParameters->buffer offset:0 atIndex:2];
      [encoder dispatchThreadgroups:MTLSizeMake(1, 1, 1)
              threadsPerThreadgroup:MTLSizeMake(64, 1, 1)];
      [encoder endEncoding];
      input = f.scratch->postOutput->buffer;
    }
    // Only the final scalar crosses back to the host. No CPU arithmetic fallback.
    id<MTLBlitCommandEncoder> blit = state->permit() ? [command blitCommandEncoder] : nil;
    if (!blit)
      return nil;
    [blit copyFromBuffer:input
             sourceOffset:0
                 toBuffer:resident ? f.result.storage_->metal->buffer : f.staging->buffer
        destinationOffset:0
                     size:4];
    [blit endEncoding];
    if (!state->permit())
      return nil;
    return command;
  }
  static void nextMatrixStage(Frame &f) {
    if (f.packet.matrixLeftMap) {
      f.matrixStage = 1;
      f.packet.kernel = std::move(f.packet.matrixLeftMap);
      f.packet.arguments = std::move(f.packet.leftArguments);
      f.packet.kind = Kind::Elementwise;
    } else if (f.packet.matrixRightMap) {
      f.matrixStage = 2;
      f.packet.kernel = std::move(f.packet.matrixRightMap);
      f.packet.arguments = std::move(f.packet.rightArguments);
      f.packet.kind = Kind::Elementwise;
    } else {
      f.matrixStage = 3;
      f.packet.kernel = std::move(f.matrixKernel);
      f.packet.input = std::move(f.matrixLeft);
      f.packet.right = std::move(f.matrixRight);
      f.packet.kind = Kind::Matmul;
    }
  }
  static void captureJoin(PacketData &packet, Kernel join,
                          std::span<const float> scalars) noexcept {
    if (!packet.graph)
      return;
    const auto &base = packet.kernel.state_, &reduction = packet.reduction.state_;
    const auto &kernel = join.state_;
    if (!kernel || !base || !reduction || !reduction->reduction || reduction->matrix ||
        !kernel->elementwise || kernel->reduction || kernel->matrix || kernel->projected ||
        kernel->signature.value_or(ElementwiseSignature{2, 0}).tensors !=
            packet.graph->reduced.size()) {
      packet.preparation = Error::Invalid;
      return;
    }
    if (reduction->registry != packet.state || kernel->registry != packet.state ||
        reduction->index != base->index || kernel->index != base->index) {
      packet.preparation = Error::Residency;
      return;
    }
    auto args = capture(packet.state, join, packet.graph->reduced, scalars);
    if (!args) {
      packet.preparation = args.error();
      return;
    }
    packet.graph->join = std::move(join);
    packet.graph->joinArguments = *args;
  }
  static void nextGraphStage(Frame &f) {
    const auto &graph = *f.packet.graph;
    if (!f.graphKernel)
      f.graphKernel = f.packet.kernel;
    if (!graph.reductions.empty()) {
      if (f.graphPhase == 0 && f.graphStage == graph.products.size())
        f.graphPhase = 1;
      if (f.graphPhase == 1) {
        f.packet.kind = Kind::Reduce;
        f.packet.kernel = f.packet.reduction;
        f.packet.input = graph.values[graph.reductions[f.reductionStage]];
        f.packet.right = {};
        f.packet.arguments.reset();
        return;
      }
      if (f.graphPhase == 2) {
        f.packet.kind = Kind::Elementwise;
        f.packet.kernel = graph.join;
        f.packet.arguments = graph.joinArguments;
        f.packet.input = graph.reduced.front();
        f.packet.right = {};
        return;
      }
    }
    const auto edge = graph.products[f.graphStage];
    const bool map = !graph.maps.empty() && bool(graph.maps[f.graphStage]);
    f.packet.kernel = map ? graph.maps[f.graphStage] : f.graphKernel;
    f.packet.kind = map ? Kind::Elementwise : Kind::Matmul;
    f.packet.arguments = map ? graph.mapArguments[f.graphStage] : nullptr;
    f.packet.input = graph.values[edge.left];
    f.packet.right = graph.values[edge.right];
  }
  static void resume(Task &task) {
    for (;;) {
      @autoreleasepool {
        auto &f = *static_cast<Frame *>(task.frame());
        auto state = f.packet.state;
        if (!f.started && !f.matrixStage && (f.packet.matrixLeftMap || f.packet.matrixRightMap) &&
            !f.packet.preparation) {
          // Keep both original operands until their independent maps acknowledge.
          f.matrixLeft = std::move(f.packet.input);
          f.matrixRight = std::move(f.packet.right);
          f.matrixKernel = std::move(f.packet.kernel);
          nextMatrixStage(f);
        }
        if (f.packet.graph && !f.started && !f.packet.preparation) {
          nextGraphStage(f);
        }
        if (f.started) {
          if (!f.succeeded) {
            task.fault(static_cast<std::int64_t>(f.error));
            return;
          }
          if (f.packet.graph) {
            auto &graph = *f.packet.graph;
            if (!graph.reductions.empty() && f.graphPhase > 0) {
              if (f.graphPhase == 2) {
                std::memcpy(&f.scalar, f.joinReadback->buffer.contents, 4);
                f.packet.arguments.reset();
                f.packet.input = {};
                f.packet.right = {};
                f.packet.graph.reset();
                f.result = {};
                f.scratch.reset();
                f.staging.reset();
                f.resources.reset();
                f.joinReadback.reset();
                task.complete(&f.scalar);
                return;
              }
              f.staging.reset();
              f.scratch.reset();
              f.packet.input = {};
              f.packet.right = {};
              graph.reduced[f.reductionStage] = std::move(f.result);
              const auto root = graph.reductions[f.reductionStage];
              if (!--graph.uses[root])
                graph.values[root] = {};
              if (++f.reductionStage == graph.reductions.size())
                f.graphPhase = 2;
              f.started = f.succeeded = false;
              if (task.cancelled())
                return;
              continue;
            }
            const auto edge = graph.products[f.graphStage];
            f.staging.reset();
            f.resources.reset();
            f.packet.input = {};
            f.packet.right = {};
            f.packet.arguments.reset();
            graph.values[graph.inputs + f.graphStage] = std::move(f.result);
            for (auto operand : {edge.left, edge.right})
              if (!--graph.uses[operand])
                graph.values[operand] = {};
            ++f.graphStage;
            if (!graph.reductions.empty()) {
              f.started = f.succeeded = false;
              if (task.cancelled())
                return;
              continue;
            }
            if (f.graphStage == graph.products.size()) {
              f.result = std::move(graph.values.back());
              f.packet.graph.reset();
              f.graphKernel = {};
              if (f.packet.reduction) {
                if (task.cancelled())
                  return;
                f.packet.input = std::move(f.result);
                f.packet.kernel = std::move(f.packet.reduction);
                f.packet.kind = Kind::Reduce;
                f.started = f.succeeded = false;
                continue;
              }
              task.complete(&f.result);
              return;
            }
            if (task.cancelled())
              return;
            f.started = f.succeeded = false;
            nextGraphStage(f);
          } else {
            // Materialize host results on the scheduler, never in the Metal callback.
            if (f.packet.kind == Kind::Download) {
              auto *destination = const_cast<Storage *>(f.result.storage_.get());
              std::memcpy(destination->host.data(), f.staging->buffer.contents, destination->size);
            }
            if (f.packet.kind == Kind::Reduce)
              std::memcpy(&f.scalar, f.staging->buffer.contents, 4);
            f.staging.reset();
            f.resources.reset();
            f.scratch.reset();
            f.packet.input = Buffer{};
            f.packet.right = Buffer{};
            f.packet.kernel = Kernel{};
            f.packet.arguments.reset();
            f.packet.replacement = Buffer{};
            const bool beforeMatrix = f.matrixStage == 1 || f.matrixStage == 2;
            if (beforeMatrix) {
              (f.matrixStage == 1 ? f.matrixLeft : f.matrixRight) = std::move(f.result);
              nextMatrixStage(f);
            } else if (!f.packet.reduction && !f.packet.matrixPost) {
              f.packet.epilogue = Kernel{};
              f.packet.postArguments.reset();
              f.packet.scalarArguments.reset();
              task.complete(f.packet.kind == Kind::Reduce ? static_cast<const void *>(&f.scalar)
                                                          : &f.result);
              return;
            }
            // Acknowledgement transfers the resident result into the next stage.
            // Source argument packs remain immutable; slot zero may select this result.
            if (beforeMatrix) {
              // nextMatrixStage has selected the next resident operand or primitive.
            } else if (f.packet.matrixPost) {
              f.packet.replacement = std::move(f.result);
              f.packet.kernel = std::move(f.packet.matrixPost);
              f.packet.arguments = std::move(f.packet.postArguments);
              f.packet.kind = Kind::Elementwise;
            } else {
              f.packet.input = std::move(f.result);
              f.packet.kernel = std::move(f.packet.reduction);
              f.packet.kind = Kind::Reduce;
            }
            f.started = false;
            f.succeeded = false;
            if (task.cancelled())
              return;
          }
        }
        f.started = true;
        if (f.packet.preparation) {
          task.fault(std::int64_t(*f.packet.preparation));
          return;
        }
        if (f.packet.matrixPost && f.packet.kind == Kind::Matmul) {
          const auto &kernel = f.packet.matrixPost.state_;
          const auto &base = f.packet.kernel.state_;
          if (!base || !base->matrix || kernel->registry != state || kernel->index != base->index ||
              !f.packet.postArguments || !kernel->elementwise || kernel->matrix ||
              kernel->reduction || kernel->tensorIndex(0) != 0) {
            task.fault(std::int64_t(Error::Invalid));
            return;
          }
        }
        if (f.packet.epilogue) {
          const auto &kernel = f.packet.epilogue.state_;
          const auto &base = f.packet.kernel.state_;
          const auto signature = kernel->signature.value_or(ElementwiseSignature{2, 0});
          if (!base || !kernel->elementwise || kernel->reduction || kernel->matrix ||
              kernel->projected || kernel->indirect() || signature.tensors != 1 ||
              !f.packet.scalarArguments ||
              signature.scalars != f.packet.scalarArguments->scalarBits.size() ||
              kernel->registry != state || kernel->index != base->index) {
            task.fault(std::int64_t(Error::Invalid));
            return;
          }
        }
        if (f.packet.reduction) {
          const auto &reduction = f.packet.reduction.state_;
          const auto &mapping = f.packet.kernel.state_;
          if (!reduction->reduction || reduction->matrix || !mapping ||
              reduction->registry != state || reduction->index != mapping->index) {
            task.fault(std::int64_t(Error::Invalid));
            return;
          }
        }
        if (f.packet.arguments) {
          const auto &kernel = f.packet.kernel.state_;
          f.packet.input = tensor(f, kernel->tensorIndex(0));
        }
        const auto &source = f.packet.input.storage_;
        if (!source) {
          task.fault(std::int64_t(Error::Invalid));
          return;
        }
        std::uint32_t index = source->deviceIndex;
        const bool compute = f.packet.kind == Kind::Compute || f.packet.kind == Kind::Elementwise;
        const bool upload = f.packet.kind == Kind::Upload;
        const bool reduce = f.packet.kind == Kind::Reduce;
        const bool matrix = f.packet.kind == Kind::Matmul;
        std::array<std::int64_t, 2> matrixShape{};
        if (matrix) {
          const auto &kernel = f.packet.kernel.state_;
          const auto &right = f.packet.right.storage_;
          if (!kernel || !kernel->matrix || !right || source->format != Format::Float32 ||
              right->format != Format::Float32 || source->rank != 2 || right->rank != 2 ||
              source->dimensions[1] != right->dimensions[0] || source->size / 4 > UINT32_MAX ||
              right->size / 4 > UINT32_MAX) {
            task.fault(std::int64_t(Error::Invalid));
            return;
          }
          for (auto dimension :
               {source->dimensions[0], source->dimensions[1], right->dimensions[1]})
            if (std::uint64_t(dimension) > UINT32_MAX) {
              task.fault(std::int64_t(Error::Invalid));
              return;
            }
          matrixShape = {source->dimensions[0], right->dimensions[1]};
          if (std::uint64_t(matrixShape[0]) * std::uint64_t(matrixShape[1]) > UINT32_MAX) {
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
        }
        if (reduce) {
          const auto &kernel = f.packet.kernel.state_;
          if (!kernel || !kernel->reduction || kernel->matrix ||
              source->format != Format::Float32 || (source->rank != 1 && source->rank != 2) ||
              source->size / 4 > UINT32_MAX) {
            task.fault(std::int64_t(Error::Invalid));
            return;
          }
          index = kernel->index;
          if (kernel->registry != state || !source->device || source->state != state ||
              source->deviceIndex != index) {
            task.fault(std::int64_t(Error::Residency));
            return;
          }
          if (!source->size && !f.packet.epilogue && !(f.packet.graph && f.graphPhase == 1)) {
            task.complete(&f.scalar);
            return;
          }
        }
        if (compute) {
          const auto &kernel = f.packet.kernel.state_;
          const auto &right = f.packet.right.storage_;
          const auto signature =
              kernel && kernel->signature ? *kernel->signature : ElementwiseSignature{2, 0};
          if (!kernel || kernel->reduction || kernel->matrix ||
              kernel->elementwise != (f.packet.kind == Kind::Elementwise) ||
              (!f.packet.arguments && (kernel->projected || kernel->indirect() ||
                                       signature.tensors != 2 || signature.scalars != 0)) ||
              (f.packet.arguments &&
               (f.packet.arguments->tensors.size() != signature.tensors ||
                f.packet.arguments->scalarBits.size() != signature.scalars)) ||
              std::uint32_t(f.packet.operation) > 2 || source->format != Format::Float32 ||
              (source->rank != 1 && (!kernel->elementwise || source->rank != 2)) ||
              source->size / 4 > UINT32_MAX ||
              (signature.tensors == 2 && !f.packet.arguments &&
               (!right || right->format != Format::Float32 || right->rank != source->rank ||
                source->size != right->size ||
                !std::equal(source->dimensions.begin(), source->dimensions.begin() + source->rank,
                            right->dimensions.begin())))) {
            task.fault(std::int64_t(Error::Invalid));
            return;
          }
          index = kernel->index;
          if (kernel->registry != state || !source->device || source->state != state ||
              source->deviceIndex != index ||
              (signature.tensors == 2 && !f.packet.arguments &&
               (!right->device || right->state != state || right->deviceIndex != index))) {
            task.fault(std::int64_t(Error::Residency));
            return;
          }
          if (f.packet.arguments)
            for (std::size_t i = 0; i < f.packet.arguments->tensors.size(); ++i) {
              const auto &other = tensor(f, i).storage_;
              const auto reads =
                  kernel->indirect()
                      ? std::span<const std::uint32_t>(kernel->indirectReads)
                      : std::span<const std::uint32_t>(kernel->reads.data(), kernel->readCount);
              const bool read = std::binary_search(reads.begin(), reads.end(), i);
              if (!other || other->format != Format::Float32 ||
                  (other->rank != 1 && other->rank != 2) ||
                  (read && (other->rank != source->rank || other->size != source->size ||
                            !std::equal(source->dimensions.begin(),
                                        source->dimensions.begin() + source->rank,
                                        other->dimensions.begin())))) {
                task.fault(std::int64_t(Error::Invalid));
                return;
              }
              if (!other->device || other->state != state || other->deviceIndex != index) {
                task.fault(std::int64_t(Error::Residency));
                return;
              }
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
        if (!compute && !reduce && !matrix && source->device == upload) {
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
          auto result = allocateStorage(
              state, matrix ? std::span<const std::int64_t>(matrixShape) : f.packet.input.shape(),
              source->format, upload || compute || matrix, index);
          if (!result) {
            task.fault(std::int64_t(result.error()));
            return;
          }
          f.result = Buffer(*result);
          if (!f.result.bytes()) {
            // Empty composed results still validate both stages and all arguments.
            if (f.packet.graph || (f.packet.reduction && f.packet.epilogue) ||
                f.packet.matrixPost || f.matrixStage == 1 || f.matrixStage == 2) {
              // Empty first stages submit no command; release their admission
              // before continuing iteratively, including arbitrarily long empty graphs.
              --state->inFlight;
              f.active = false;
              f.succeeded = true;
              continue;
            } else
              task.complete(f.packet.reduction ? static_cast<const void *>(&f.scalar) : &f.result);
            return;
          }

          if (compute || matrix) {
            const auto &kernel = f.packet.kernel.state_;
            const auto tensors = kernel->readCount;
            const auto parameterBytes = matrix ? 12
                                        : kernel->signature
                                            ? 4ull * (1ull + kernel->signature->scalars)
                                            : 8;
            auto parametersBuffer = allocateMetal(state, index, parameterBytes, true);
            if (!parametersBuffer) {
              task.fault(std::int64_t(parametersBuffer.error()));
              return;
            }
            f.staging = *parametersBuffer;
            if (f.packet.graph && f.graphPhase == 2) {
              auto readback = allocateMetal(state, index, 4, true);
              if (!readback) {
                task.fault(std::int64_t(readback.error()));
                return;
              }
              f.joinReadback = *readback;
            }
            id<MTLArgumentEncoder> arguments = nil;
            if (kernel->indirect()) {
              auto resources = allocateMetal(state, index, kernel->encodedBytes, true);
              if (!resources) {
                task.fault(std::int64_t(resources.error()));
                return;
              }
              f.resources = *resources;
              // Argument encoders are invocation-local: their mutable destination cannot
              // be shared by concurrent calls using the same immutable Kernel.
              arguments = state->permit()
                              ? [kernel->argumentFunction newArgumentEncoderWithBufferIndex:0]
                              : nil;
              if (!arguments) {
                task.fault(std::int64_t(Error::Allocation));
                return;
              }
              [arguments setArgumentBuffer:f.resources->buffer offset:0];
            }
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
            auto layout = MatmulLayout::Scalar;
            if (matrix && kernel->matrixTiles[0] && kernel->matrixTiles[1])
              layout = selectMatmulLayout(std::uint32_t(matrixShape[0]),
                                          std::uint32_t(source->dimensions[1]),
                                          std::uint32_t(matrixShape[1]));
            auto pipeline = layout == MatmulLayout::Rows2  ? kernel->matrixTiles[0]
                            : layout == MatmulLayout::Quad ? kernel->matrixTiles[1]
                                                           : kernel->pipeline;
            [encoder setComputePipelineState:pipeline];
            if (!kernel->indirect()) {
              [encoder setBuffer:matrix && !source->size ? (*result)->metal->buffer
                                                         : source->metal->buffer
                          offset:0
                         atIndex:0];
              if (f.packet.arguments) {
                for (std::size_t i = 0; i < tensors; ++i)
                  [encoder setBuffer:tensor(f, kernel->tensorIndex(i)).storage_->metal->buffer
                              offset:0
                             atIndex:i];
              } else if (tensors == 2)
                [encoder setBuffer:matrix && !f.packet.right.bytes()
                                       ? (*result)->metal->buffer
                                       : f.packet.right.storage_->metal->buffer
                            offset:0
                           atIndex:1];
              [encoder setBuffer:(*result)->metal->buffer offset:0 atIndex:tensors];
            }
            auto *parameters = static_cast<std::uint32_t *>(f.staging->buffer.contents);
            std::fill_n(parameters, parameterBytes / 4, 0u);
            parameters[0] = std::uint32_t(source->size / 4);
            if (matrix) {
              parameters[0] = std::uint32_t(matrixShape[0]);
              parameters[1] = std::uint32_t(source->dimensions[1]);
              parameters[2] = std::uint32_t(matrixShape[1]);
            } else if (f.packet.arguments)
              std::copy(f.packet.arguments->scalarBits.begin(),
                        f.packet.arguments->scalarBits.end(), parameters + 1);
            else
              parameters[1] = std::uint32_t(f.packet.operation);
            if (kernel->indirect()) {

              for (std::size_t i = 0; i < tensors; ++i) {
                auto buffer = tensor(f, kernel->tensorIndex(i)).storage_->metal->buffer;
                [arguments setBuffer:buffer offset:0 atIndex:i];
                [encoder useResource:buffer usage:MTLResourceUsageRead];
              }
              [arguments setBuffer:(*result)->metal->buffer offset:0 atIndex:tensors];
              [arguments setBuffer:f.staging->buffer offset:0 atIndex:tensors + 1];
              [encoder useResource:(*result)->metal->buffer usage:MTLResourceUsageWrite];
              [encoder useResource:f.staging->buffer usage:MTLResourceUsageRead];
              [encoder setBuffer:f.resources->buffer offset:0 atIndex:0];
            } else
              [encoder setBuffer:f.staging->buffer offset:0 atIndex:tensors + 1];
            const auto lanes = matrix ? matmulWorkItems(layout, parameters[0], parameters[2])
                                      : std::uint64_t(parameters[0]);
            [encoder dispatchThreadgroups:MTLSizeMake((lanes + 63) / 64, 1, 1)
                    threadsPerThreadgroup:MTLSizeMake(64, 1, 1)];
            [encoder endEncoding];
            if (f.packet.graph && f.graphPhase == 2) {
              id<MTLBlitCommandEncoder> blit = state->permit() ? [command blitCommandEncoder] : nil;
              if (!blit) {
                task.fault(std::int64_t(Error::Allocation));
                return;
              }
              [blit copyFromBuffer:f.result.storage_->metal->buffer
                       sourceOffset:0
                           toBuffer:f.joinReadback->buffer
                  destinationOffset:0
                               size:4];
              [blit endEncoding];
            }
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
        return;
      }
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
const TaskEntry Bridge::reductionEntry{1,
                                       0x4d4554414c03,
                                       sizeof(PacketData),
                                       alignof(PacketData),
                                       sizeof(Frame),
                                       alignof(Frame),
                                       Bridge::construct,
                                       Bridge::destroy,
                                       Bridge::resume,
                                       numericScalarLayout(NumericType::Float32)};
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
  const auto format = storageFormat(view.element);
  if (!format)
    return std::unexpected(Error::Invalid);
  auto retained = retainCpuTensor(context, view);
  if (!retained)
    return std::unexpected(Error::Invalid);
  if (!retained->bytes())
    return hostTensor({}, retained->shape(), *format);
  const auto allocationBytes = retained->retainedBytes();
  if (!state_->permit())
    return std::unexpected(Error::Allocation);
  try {
    auto storage = std::make_shared<Storage>(state_, false);
    if (!state_->reserve(allocationBytes))
      return std::unexpected(Error::Budget);
    storage->hostReserved = allocationBytes; // Charge the complete retained allocation.
    storage->format = *format;
    storage->cpuOffset = retained->offsetBytes();
    storage->size = retained->bytes();
    storage->rank = retained->shape().size();
    std::copy(retained->shape().begin(), retained->shape().end(), storage->dimensions.begin());
    storage->cpu = std::move(*retained).releaseAllocation();
    return Buffer(std::move(storage));
  } catch (...) {
    return std::unexpected(Error::Allocation);
  }
}
std::expected<void *, Error> Runtime::exportCpu(Invocation &context, const Buffer &buffer,
                                                NumericType element, std::span<std::int64_t> sizes,
                                                std::span<std::int64_t> strides) noexcept {
  if (!context.usable() || !buffer || storageNumericType(buffer.format()) != element)
    return std::unexpected(Error::Invalid);
  auto bytes = buffer.hostBytes();
  if (!bytes)
    return std::unexpected(bytes.error()); // Explicit download required.
  auto result = copyCpuTensorData(context, element, *bytes, buffer.shape(), sizes, strides);
  if (!result)
    return std::unexpected(result.error() == CpuTensorError::Allocation ? Error::Allocation
                                                                        : Error::Invalid);
  return *result;
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
std::expected<Kernel, Error>
Runtime::loadElementwiseKernel(std::string_view path, Device device, ElementwiseSignature signature,
                               std::span<const std::uint32_t> reads) noexcept {
  return loadKernel(path, std::move(device), true, signature, false, false, reads);
}
std::expected<Kernel, Error>
Runtime::loadKernel(std::string_view path, Device device, bool elementwise,
                    std::optional<ElementwiseSignature> signature, bool reduction, bool matrix,
                    std::optional<std::span<const std::uint32_t>> reads) noexcept {
  @autoreleasepool {
    const auto physical = reads ? reads->size() : signature ? signature->tensors : 2;
    const bool indirect = signature && signature->binding == ElementwiseBinding::ArgumentBuffer;
    if ((signature &&
         std::uint32_t(signature->binding) > std::uint32_t(ElementwiseBinding::ArgumentBuffer)) ||
        (indirect && (reduction || matrix || !elementwise)))
      return std::unexpected(Error::Invalid);
    if ((signature &&
         (!elementwise || signature->tensors == 0 || signature->scalars == UINT32_MAX)) ||
        !(indirect ? indirectElementwiseLayout(physical, signature->scalars)
                   : directElementwiseLayout(physical, signature ? signature->scalars : 0)))
      return std::unexpected(Error::Invalid);
    if (reads) {
      if (!signature || reduction || matrix)
        return std::unexpected(Error::Invalid);
      for (std::size_t i = 0; i < reads->size(); ++i)
        if ((*reads)[i] >= signature->tensors || (i && (*reads)[i - 1] >= (*reads)[i]))
          return std::unexpected(Error::Invalid);
    }
    if (device.state_ != state_)
      return std::unexpected(Error::Residency);
    if (indirect &&
        state_->devices[device.index_].argumentBuffersSupport != MTLArgumentBuffersTier2)
      return std::unexpected(Error::Unavailable);
    if (signature &&
        4ull * (1ull + signature->scalars) > state_->devices[device.index_].maxBufferLength)
      return std::unexpected(Error::Unavailable);
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
      id<MTLFunction> argumentFunction = nil;
      std::uint64_t encodedBytes = 0;
      auto prepare = [&](NSString *entry) -> std::expected<id<MTLComputePipelineState>, Error> {
        id<MTLFunction> function = [library newFunctionWithName:entry];
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
        const auto tensors = physical;
        const auto parameterIndex = tensors + 1, bindingCount = tensors + 2;
        const auto words = matrix ? 3 : signature ? signature->scalars + 1 : 2;
        if (indirect) {
          if (reflection.bindings.count != 1)
            return std::unexpected(Error::Invalid);
          id<MTLBufferBinding> root = (id<MTLBufferBinding>)reflection.bindings[0];
          if (root.type != MTLBindingTypeBuffer || root.index != 0 ||
              !root.bufferPointerType.elementIsArgumentBuffer ||
              root.bufferDataType != MTLDataTypeStruct ||
              root.bufferStructType.members.count != bindingCount)
            return std::unexpected(Error::Invalid);
          if (!state_->permit())
            return std::unexpected(Error::Allocation);
          auto encoder = [function newArgumentEncoderWithBufferIndex:0];
          if (!encoder || encoder.encodedLength < sizeof(std::uint64_t) ||
              encoder.encodedLength > state_->devices[device.index_].maxBufferLength)
            return std::unexpected(Error::Unavailable);
          if (encoder.encodedLength != root.bufferDataSize ||
              encoder.alignment != root.bufferAlignment ||
              encoder.alignment < alignof(std::uint64_t) ||
              (encoder.alignment & (encoder.alignment - 1)))
            return std::unexpected(Error::Invalid);
          std::uint64_t last = 0;
          for (std::size_t i = 0; i < bindingCount; ++i) {
            MTLStructMember *member = root.bufferStructType.members[i];
            auto pointer = member.pointerType;
            auto fields = pointer.elementStructType.members;
            const auto count = i == parameterIndex ? words : 1;
            if (member.dataType != MTLDataTypePointer || member.argumentIndex != i ||
                member.offset < last || member.offset % alignof(std::uint64_t) ||
                member.offset > encoder.encodedLength - sizeof(std::uint64_t) || !pointer ||
                pointer.elementIsArgumentBuffer || pointer.elementType != MTLDataTypeStruct ||
                pointer.alignment != 4 || pointer.dataSize != 4ull * count || fields.count != 1)
              return std::unexpected(Error::Invalid);
            last = member.offset + sizeof(std::uint64_t);
            MTLStructMember *field = fields[0];
            auto array = field.arrayType;
            if (field.offset != 0 || field.dataType != MTLDataTypeArray || !array ||
                array.stride != 4 || array.arrayLength != count ||
                array.elementType != (i == parameterIndex ? MTLDataTypeUInt : MTLDataTypeFloat))
              return std::unexpected(Error::Invalid);
          }
          argumentFunction = function;
          encodedBytes = encoder.encodedLength;
          return pipeline;
        }
        if (reflection.bindings.count != bindingCount)
          return std::unexpected(Error::Invalid);
        bool seen[directBufferEntries] = {};
        for (id<MTLBinding> argument in reflection.bindings) {
          if (argument.type != MTLBindingTypeBuffer || argument.index >= bindingCount ||
              seen[argument.index] ||
              ((id<MTLBufferBinding>)argument).bufferDataSize !=
                  (argument.index == parameterIndex ? 4ull * words : 4ull))
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
        return pipeline;
      };
      auto prepared = prepare(matrix        ? @"kalandra_matmul"
                              : reduction   ? @"kalandra_reduce_sum"
                              : indirect    ? @"kalandra_elementwise_v3"
                              : signature   ? @"kalandra_elementwise_v2"
                              : elementwise ? @"kalandra_elementwise"
                                            : @"strict_binary32");
      if (!prepared)
        return std::unexpected(prepared.error());
      auto pipeline = *prepared;
      std::array<id<MTLComputePipelineState>, 2> matrixTiles{};
      // Performance profile qualified on this device. Other Apple GPUs retain
      // the strict scalar entry until their crossover measurements exist.
      if (matrix && [state_->devices[device.index_].name isEqualToString:@"Apple M2 Max"]) {
        const std::array<NSString *, 2> names{@"kalandra_matmul_2x1", @"kalandra_matmul_2x2"};
        for (unsigned i = 0; i < names.size(); ++i) {
          if (!state_->permit())
            return std::unexpected(Error::Allocation);
          auto tile = prepare(names[i]);
          if (!tile)
            return std::unexpected(tile.error());
          matrixTiles[i] = *tile;
        }
      }
      if (!state_->permit())
        return std::unexpected(Error::Allocation);
      Kernel kernel;
      auto metadata = std::make_shared<KernelState>(state_, device.index_, pipeline, elementwise,
                                                    reduction, matrix, signature, matrixTiles);
      metadata->readCount = physical;
      metadata->projected = reads.has_value();
      if (indirect) {
        if (!state_->permit())
          return std::unexpected(Error::Allocation);
        metadata->indirectReads.resize(physical);
        metadata->argumentFunction = argumentFunction;
        metadata->encodedBytes = encodedBytes;
        for (std::uint32_t i = 0; i < physical; ++i)
          metadata->indirectReads[i] = reads ? (*reads)[i] : i;
      } else
        for (std::uint32_t i = 0; i < physical; ++i)
          metadata->reads[i] = reads ? (*reads)[i] : i;
      kernel.state_ = std::move(metadata);
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
std::expected<Kernel, Error> Runtime::loadMatmulKernel(std::string_view path,
                                                       Device device) noexcept {
  return loadKernel(path, std::move(device), true, {}, false, true);
}
TaskHandle Runtime::matmul(TaskCore &core, GroupHandle group, Kernel kernel, Buffer left,
                           Buffer right, Kernel post, std::span<const Buffer> postInputs,
                           std::span<const float> scalars, Kernel leftMap, Kernel rightMap,
                           std::span<const Buffer> mapInputs,
                           std::span<const float> mapScalars) noexcept {
  Bridge::PacketData packet{state_,
                            std::move(left),
                            {},
                            Bridge::Kind::Matmul,
                            std::move(kernel),
                            BinaryOperation::Add,
                            std::move(right)};
  if (post) {
    auto arguments = Bridge::capture(state_, post, postInputs, scalars);
    if (arguments)
      packet.postArguments = *arguments;
    else
      packet.preparation = arguments.error();
    packet.matrixPost = std::move(post);
  } else if (!postInputs.empty() || !scalars.empty())
    packet.preparation = Error::Invalid;
  Bridge::matrixMaps(packet, std::move(leftMap), std::move(rightMap), mapInputs, mapScalars);
  return core.submit(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::matmul(Task &task, GroupHandle group, Kernel kernel, Buffer left, Buffer right,
                           Kernel post, std::span<const Buffer> postInputs,
                           std::span<const float> scalars, Kernel leftMap, Kernel rightMap,
                           std::span<const Buffer> mapInputs,
                           std::span<const float> mapScalars) noexcept {
  Bridge::PacketData packet{state_,
                            std::move(left),
                            {},
                            Bridge::Kind::Matmul,
                            std::move(kernel),
                            BinaryOperation::Add,
                            std::move(right)};
  if (post) {
    auto arguments = Bridge::capture(state_, post, postInputs, scalars);
    if (arguments)
      packet.postArguments = *arguments;
    else
      packet.preparation = arguments.error();
    packet.matrixPost = std::move(post);
  } else if (!postInputs.empty() || !scalars.empty())
    packet.preparation = Error::Invalid;
  Bridge::matrixMaps(packet, std::move(leftMap), std::move(rightMap), mapInputs, mapScalars);
  return task.spawn(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::matmulGraph(TaskCore &task, GroupHandle group, Kernel kernel,
                                std::span<const Buffer> inputs,
                                std::span<const MatrixProduct> products,
                                std::span<const Kernel> maps,
                                std::span<const float> mapScalars) noexcept {
  Bridge::PacketData packet{
      state_, {}, {}, Bridge::Kind::Matmul, std::move(kernel), BinaryOperation::Add, {}};
  auto graph = Bridge::captureGraph(state_, packet.kernel, inputs, products, maps, mapScalars);
  if (graph)
    packet.graph = *graph;
  else
    packet.preparation = graph.error();
  return task.submit(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::matmulGraph(Task &task, GroupHandle group, Kernel kernel,
                                std::span<const Buffer> inputs,
                                std::span<const MatrixProduct> products,
                                std::span<const Kernel> maps,
                                std::span<const float> mapScalars) noexcept {
  Bridge::PacketData packet{
      state_, {}, {}, Bridge::Kind::Matmul, std::move(kernel), BinaryOperation::Add, {}};
  auto graph = Bridge::captureGraph(state_, packet.kernel, inputs, products, maps, mapScalars);
  if (graph)
    packet.graph = *graph;
  else
    packet.preparation = graph.error();
  return task.spawn(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::matmulGraphReduceSum(TaskCore &task, GroupHandle group, Kernel kernel,
                                         std::span<const Buffer> inputs,
                                         std::span<const MatrixProduct> products, Kernel reduction,
                                         Kernel epilogue, std::span<const float> scalars,
                                         std::span<const Kernel> maps,
                                         std::span<const float> mapScalars) noexcept {
  Bridge::PacketData packet{
      state_, {}, {}, Bridge::Kind::Matmul, std::move(kernel), BinaryOperation::Add, {}};
  auto graph = Bridge::captureGraph(state_, packet.kernel, inputs, products, maps, mapScalars);
  if (graph)
    packet.graph = *graph;
  else
    packet.preparation = graph.error();
  if (!reduction)
    packet.preparation = Error::Invalid;
  packet.reduction = std::move(reduction);
  if (epilogue) {
    auto args = Bridge::capture(state_, epilogue, std::array{Buffer{}}, scalars);
    if (args)
      packet.scalarArguments = *args;
    else
      packet.preparation = args.error();
    packet.epilogue = std::move(epilogue);
  } else if (!scalars.empty())
    packet.preparation = Error::Invalid;
  return task.submit(group, Bridge::reductionEntry,
                     {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::matmulGraphReduceSum(Task &task, GroupHandle group, Kernel kernel,
                                         std::span<const Buffer> inputs,
                                         std::span<const MatrixProduct> products, Kernel reduction,
                                         Kernel epilogue, std::span<const float> scalars,
                                         std::span<const Kernel> maps,
                                         std::span<const float> mapScalars) noexcept {
  Bridge::PacketData packet{
      state_, {}, {}, Bridge::Kind::Matmul, std::move(kernel), BinaryOperation::Add, {}};
  auto graph = Bridge::captureGraph(state_, packet.kernel, inputs, products, maps, mapScalars);
  if (graph)
    packet.graph = *graph;
  else
    packet.preparation = graph.error();
  if (!reduction)
    packet.preparation = Error::Invalid;
  packet.reduction = std::move(reduction);
  if (epilogue) {
    auto args = Bridge::capture(state_, epilogue, std::array{Buffer{}}, scalars);
    if (args)
      packet.scalarArguments = *args;
    else
      packet.preparation = args.error();
    packet.epilogue = std::move(epilogue);
  } else if (!scalars.empty())
    packet.preparation = Error::Invalid;
  return task.spawn(group, Bridge::reductionEntry,
                    {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::graphReductions(TaskCore &task, GroupHandle group, Kernel base,
                                    std::span<const Buffer> inputs,
                                    std::span<const MatrixProduct> products, Kernel reduction,
                                    Kernel join, std::span<const std::uint32_t> roots,
                                    std::span<const float> scalars, std::span<const Kernel> maps,
                                    std::span<const float> mapScalars) noexcept {
  Bridge::PacketData packet{
      state_, {}, {}, Bridge::Kind::Matmul, std::move(base), BinaryOperation::Add, {}};
  if (roots.size() < 2)
    packet.preparation = Error::Invalid;
  else {
    auto graph =
        Bridge::captureGraph(state_, packet.kernel, inputs, products, maps, mapScalars, roots);
    if (graph)
      packet.graph = *graph;
    else
      packet.preparation = graph.error();
  }
  packet.reduction = std::move(reduction);
  Bridge::captureJoin(packet, std::move(join), scalars);
  return task.submit(group, Bridge::reductionEntry,
                     {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::graphReductions(Task &task, GroupHandle group, Kernel base,
                                    std::span<const Buffer> inputs,
                                    std::span<const MatrixProduct> products, Kernel reduction,
                                    Kernel join, std::span<const std::uint32_t> roots,
                                    std::span<const float> scalars, std::span<const Kernel> maps,
                                    std::span<const float> mapScalars) noexcept {
  Bridge::PacketData packet{
      state_, {}, {}, Bridge::Kind::Matmul, std::move(base), BinaryOperation::Add, {}};
  if (roots.size() < 2)
    packet.preparation = Error::Invalid;
  else {
    auto graph =
        Bridge::captureGraph(state_, packet.kernel, inputs, products, maps, mapScalars, roots);
    if (graph)
      packet.graph = *graph;
    else
      packet.preparation = graph.error();
  }
  packet.reduction = std::move(reduction);
  Bridge::captureJoin(packet, std::move(join), scalars);
  return task.spawn(group, Bridge::reductionEntry,
                    {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::matmulReduceSum(TaskCore &task, GroupHandle group, Kernel matrix,
                                    Kernel reduction, Buffer left, Buffer right, Kernel leftMap,
                                    Kernel rightMap, std::span<const Buffer> mapInputs,
                                    std::span<const float> mapScalars, Kernel adjustment,
                                    std::span<const Buffer> adjustmentInputs,
                                    std::span<const float> adjustmentScalars, Kernel epilogue,
                                    std::span<const float> epilogueScalars) noexcept {
  Bridge::PacketData packet{state_,
                            std::move(left),
                            {},
                            Bridge::Kind::Matmul,
                            std::move(matrix),
                            BinaryOperation::Add,
                            std::move(right)};
  if (!reduction)
    packet.preparation = Error::Invalid;
  packet.reduction = std::move(reduction);
  if (adjustment) {
    auto args = Bridge::capture(state_, adjustment, adjustmentInputs, adjustmentScalars);
    if (args)
      packet.postArguments = *args;
    else
      packet.preparation = args.error();
    packet.matrixPost = std::move(adjustment);
  } else if (!adjustmentInputs.empty() || !adjustmentScalars.empty())
    packet.preparation = Error::Invalid;
  if (epilogue) {
    auto args = Bridge::capture(state_, epilogue, std::array{packet.input}, epilogueScalars);
    if (args)
      packet.scalarArguments = *args;
    else
      packet.preparation = args.error();
    packet.epilogue = std::move(epilogue);
  } else if (!epilogueScalars.empty())
    packet.preparation = Error::Invalid;
  Bridge::matrixMaps(packet, std::move(leftMap), std::move(rightMap), mapInputs, mapScalars);
  return task.submit(group, Bridge::reductionEntry,
                     {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::matmulReduceSum(Task &task, GroupHandle group, Kernel matrix, Kernel reduction,
                                    Buffer left, Buffer right, Kernel leftMap, Kernel rightMap,
                                    std::span<const Buffer> mapInputs,
                                    std::span<const float> mapScalars, Kernel adjustment,
                                    std::span<const Buffer> adjustmentInputs,
                                    std::span<const float> adjustmentScalars, Kernel epilogue,
                                    std::span<const float> epilogueScalars) noexcept {
  Bridge::PacketData packet{state_,
                            std::move(left),
                            {},
                            Bridge::Kind::Matmul,
                            std::move(matrix),
                            BinaryOperation::Add,
                            std::move(right)};
  if (!reduction)
    packet.preparation = Error::Invalid;
  packet.reduction = std::move(reduction);
  if (adjustment) {
    auto args = Bridge::capture(state_, adjustment, adjustmentInputs, adjustmentScalars);
    if (args)
      packet.postArguments = *args;
    else
      packet.preparation = args.error();
    packet.matrixPost = std::move(adjustment);
  } else if (!adjustmentInputs.empty() || !adjustmentScalars.empty())
    packet.preparation = Error::Invalid;
  if (epilogue) {
    auto args = Bridge::capture(state_, epilogue, std::array{packet.input}, epilogueScalars);
    if (args)
      packet.scalarArguments = *args;
    else
      packet.preparation = args.error();
    packet.epilogue = std::move(epilogue);
  } else if (!epilogueScalars.empty())
    packet.preparation = Error::Invalid;
  Bridge::matrixMaps(packet, std::move(leftMap), std::move(rightMap), mapInputs, mapScalars);
  return task.spawn(group, Bridge::reductionEntry,
                    {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::reduceSum(TaskCore &core, GroupHandle group, Kernel kernel, Buffer input,
                              Kernel epilogue, std::span<const float> scalars) noexcept {
  Bridge::PacketData packet{
      state_, std::move(input), {}, Bridge::Kind::Reduce, std::move(kernel), BinaryOperation::Add,
      {}};
  if (epilogue) {
    auto arguments = Bridge::capture(state_, epilogue, std::array{packet.input}, scalars);
    if (arguments)
      packet.scalarArguments = *arguments;
    else
      packet.preparation = arguments.error();
    packet.epilogue = std::move(epilogue);
  } else if (!scalars.empty())
    packet.preparation = Error::Invalid;
  return core.submit(group, Bridge::reductionEntry,
                     {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::reduceSum(Task &task, GroupHandle group, Kernel kernel, Buffer input,
                              Kernel epilogue, std::span<const float> scalars) noexcept {
  Bridge::PacketData packet{
      state_, std::move(input), {}, Bridge::Kind::Reduce, std::move(kernel), BinaryOperation::Add,
      {}};
  if (epilogue) {
    auto arguments = Bridge::capture(state_, epilogue, std::array{packet.input}, scalars);
    if (arguments)
      packet.scalarArguments = *arguments;
    else
      packet.preparation = arguments.error();
    packet.epilogue = std::move(epilogue);
  } else if (!scalars.empty())
    packet.preparation = Error::Invalid;
  return task.spawn(group, Bridge::reductionEntry,
                    {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
}
const ValueLayout &Runtime::scalarLayout() noexcept {
  return *numericScalarLayout(NumericType::Float32);
}
TaskHandle Runtime::elementwiseReduceSum(TaskCore &core, GroupHandle group, Kernel mapping,
                                         Kernel reduction, std::span<const Buffer> tensors,
                                         std::span<const float> scalars, Kernel epilogue) noexcept {
  Bridge::PacketData packet{state_,
                            tensors.empty() ? Buffer{} : tensors[0],
                            {},
                            Bridge::Kind::Elementwise,
                            std::move(mapping),
                            BinaryOperation::Add,
                            {}};
  auto arguments = Bridge::capture(state_, packet.kernel, tensors, scalars);
  if (arguments)
    packet.arguments = *arguments;
  else
    packet.preparation = arguments.error();
  if (!reduction)
    packet.preparation = Error::Invalid;
  packet.reduction = std::move(reduction);
  if (epilogue) {
    packet.epilogue = std::move(epilogue);
    packet.scalarArguments = packet.arguments;
  }
  return core.submit(group, Bridge::reductionEntry,
                     {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
}
TaskHandle Runtime::elementwiseReduceSum(Task &task, GroupHandle group, Kernel mapping,
                                         Kernel reduction, std::span<const Buffer> tensors,
                                         std::span<const float> scalars, Kernel epilogue) noexcept {
  Bridge::PacketData packet{state_,
                            tensors.empty() ? Buffer{} : tensors[0],
                            {},
                            Bridge::Kind::Elementwise,
                            std::move(mapping),
                            BinaryOperation::Add,
                            {}};
  auto arguments = Bridge::capture(state_, packet.kernel, tensors, scalars);
  if (arguments)
    packet.arguments = *arguments;
  else
    packet.preparation = arguments.error();
  if (!reduction)
    packet.preparation = Error::Invalid;
  packet.reduction = std::move(reduction);
  if (epilogue) {
    packet.epilogue = std::move(epilogue);
    packet.scalarArguments = packet.arguments;
  }
  return task.spawn(group, Bridge::reductionEntry,
                    {Bridge::reductionEntry.packetLayout, &packet, sizeof(packet)});
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
  auto arguments = Bridge::capture(state_, packet.kernel, tensors, scalars);
  if (arguments)
    packet.arguments = *arguments;
  else
    packet.preparation = arguments.error();
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
  auto arguments = Bridge::capture(state_, packet.kernel, tensors, scalars);
  if (arguments)
    packet.arguments = *arguments;
  else
    packet.preparation = arguments.error();
  return task.spawn(group, Bridge::entry, {Bridge::entry.packetLayout, &packet, sizeof(packet)});
}
const ValueLayout &Runtime::bufferLayout() noexcept { return Bridge::layout; }
Stats Runtime::stats() const noexcept {
  return {state_->bytes,          state_->peakBytes,     state_->hostBackings,
          state_->deviceBackings, state_->metalBuffers,  state_->stagingBuffers,
          state_->inFlight,       state_->submissions,   state_->completions,
          state_->attempts,       state_->argumentBytes, state_->peakArgumentBytes,
          state_->argumentPacks};
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
