#pragma once
#include "Runtime.h"
namespace kalandra::runtime {
// Private synchronous CPU ABI. Nonempty values require an invocation-owned base.
struct StringDescriptor {
  void *allocated = nullptr;
  const char *data = nullptr;
  std::int64_t byteLength = 0;
};
bool validateString(Invocation &, const StringDescriptor &) noexcept;
} // namespace kalandra::runtime
extern "C" {
// Source bytes belong to a compiler-emitted constant global, not a user descriptor.
void kalandra_string_literal_v1(kalandra::runtime::Invocation *,
                                kalandra::runtime::StringDescriptor *, const char *,
                                std::uint64_t) noexcept;
void kalandra_string_validate_v1(kalandra::runtime::Invocation *,
                                 const kalandra::runtime::StringDescriptor *) noexcept;
}
