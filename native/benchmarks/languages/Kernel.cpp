#include <cstddef>
#include <vector>

#ifdef BENCH_FLOAT32
using Float = float;
#else
using Float = double;
#endif
static Float reduce(std::vector<Float> &values) {
  auto count = values.size();
  while (count > 1) {
    for (std::size_t i = 0; i < count / 2; ++i)
      values[i] = values[i * 2] + values[i * 2 + 1];
    if (count % 2)
      values[count / 2] = values[count - 1];
    count = (count + 1) / 2;
  }
  return values.empty() ? 0 : values[0];
}

// Kept in a separate translation unit, without LTO, from the timing driver.
extern "C" Float benchmark_kernel(int kind, std::size_t n, const Float *a, const Float *b) {
  const auto count = kind == 2 ? n * n : n;
  std::vector<Float> result(count);
  if (kind == 2) {
    std::vector<Float> products(n);
    for (std::size_t row = 0; row < n; ++row)
      for (std::size_t col = 0; col < n; ++col) {
        for (std::size_t k = 0; k < n; ++k)
          products[k] = a[row * n + k] * b[k * n + col];
        result[row * n + col] = reduce(products);
      }
  } else if (kind == 1) {
    std::vector<Float> scaled(count);
    for (std::size_t i = 0; i < count; ++i)
      scaled[i] = a[i] * 3;
    for (std::size_t i = 0; i < count; ++i)
      result[i] = scaled[i] + b[i];
  } else {
    for (std::size_t i = 0; i < count; ++i)
      result[i] = a[i] * b[i];
  }
  return reduce(result);
}
