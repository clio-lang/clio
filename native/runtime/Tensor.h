#pragma once
#include <array>
#include <cstddef>
#include <cstdint>
#include <span>
#include <type_traits>
namespace kalandra::runtime {
// The ranked float32 memref descriptor used by generated MLIR C interfaces.
// Native callers must keep metadata spans valid while the bridge validates them.
struct CpuTensorView {
  const void *allocated = nullptr, *aligned = nullptr;
  std::int64_t offset = 0;
  std::span<const std::int64_t> sizes, strides;
};
template <std::size_t Rank> struct Float32Tensor {
  static_assert(Rank <= 8);
  float *allocated = nullptr, *aligned = nullptr;
  std::int64_t offset = 0;
  std::array<std::int64_t, Rank> sizes{}, strides{};
  CpuTensorView view() const noexcept { return {allocated, aligned, offset, sizes, strides}; }
};
// Rank zero has no metadata arrays in the LLVM ABI (std::array<T,0> has size 1).
template <> struct Float32Tensor<0> {
  float *allocated = nullptr, *aligned = nullptr;
  std::int64_t offset = 0;
  CpuTensorView view() const noexcept { return {allocated, aligned, offset, {}, {}}; }
};
static_assert(std::is_standard_layout_v<Float32Tensor<1>>);
static_assert(sizeof(void *) == 8 && sizeof(Float32Tensor<0>) == 24);
static_assert(sizeof(Float32Tensor<1>) == 40 && sizeof(Float32Tensor<2>) == 56);
static_assert(offsetof(Float32Tensor<1>, sizes) == 24 && offsetof(Float32Tensor<1>, strides) == 32);
} // namespace kalandra::runtime
