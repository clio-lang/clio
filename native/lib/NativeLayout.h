#pragma once
namespace kalandra {
// Pinned macOS ARM64 target layout. Record allocation and task transport must
// use the same ABI, including i64 alignment and tail padding.
inline constexpr char nativeCpuDataLayout[] =
    "e-m:o-p270:32:32-p271:32:32-p272:64:64-i64:64-i128:128-n32:64-S128-Fn32";
} // namespace kalandra
