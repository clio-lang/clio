#include "FloatOracle.h"
#include <cfenv>
#include <cstdio>
#include <cstdlib>
extern "C" std::uint32_t strict_add(std::uint32_t, std::uint32_t);
extern "C" std::uint32_t strict_mul(std::uint32_t, std::uint32_t);
extern "C" std::uint32_t strict_multiply_add(std::uint32_t, std::uint32_t);
int main() {
  if (std::fegetround() != FE_TONEAREST)
    return 2;
  const auto pairs = float_proof::corpus();
  unsigned long long checked = 0;
  for (auto pair : pairs)
    for (unsigned op = 0; op < 3; ++op) {
      auto expected = float_proof::oracle(pair, op);
      auto native = float_proof::hardware(pair, op);
      auto actual = op == 0   ? strict_add(pair.a, pair.b)
                    : op == 1 ? strict_mul(pair.a, pair.b)
                              : strict_multiply_add(pair.a, pair.b);
      if (!float_proof::equal(expected, native) || !float_proof::equal(expected, actual)) {
        std::fprintf(
            stderr,
            "Strict CPU mismatch op=%u a=%08x b=%08x expected=%08x native=%08x actual=%08x\n", op,
            pair.a, pair.b, expected, native, actual);
        return 1;
      }
      ++checked;
    }
  std::printf("Strict binary32 CPU: %llu add/multiply/composed comparisons passed against APFloat "
              "and hardware\n",
              checked);
}
