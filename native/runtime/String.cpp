#include "String.h"
#include "../include/kalandra/Utf8.h"
#include <algorithm>
#include <cstring>
#include <limits>
namespace kalandra::runtime {
bool validateString(Invocation &context, const StringDescriptor &value) noexcept {
  if (context.poll() != 0 || !context.usable())
    return false;
  const auto invalid = [&] {
    context.fault(3);
    return false;
  };
  if (value.byteLength == 0)
    return (!value.allocated && !value.data) || invalid();
  if (value.byteLength < 0 || !value.allocated || value.data != value.allocated)
    return invalid();
  auto backing = context.lease(value.allocated);
  if (!backing || static_cast<std::uint64_t>(value.byteLength) > backing->bytes().size())
    return invalid();
  auto status = validateUtf8(std::string_view(value.data, value.byteLength),
                             [&] { return context.poll() == 0; });
  return status == Utf8Status::Valid || (status == Utf8Status::Invalid && invalid());
}
} // namespace kalandra::runtime
extern "C" void kalandra_string_literal_v1(kalandra::runtime::Invocation *context,
                                           kalandra::runtime::StringDescriptor *output,
                                           const char *source, std::uint64_t length) noexcept {
  *output = {};
  if (context->poll() != 0 || !context->usable())
    return;
  if (length > std::numeric_limits<std::int64_t>::max() || (length && !source)) {
    context->fault(3);
    return;
  }
  if (!length)
    return;
  const auto status = kalandra::validateUtf8(std::string_view(source, length),
                                             [&] { return context->poll() == 0; });
  if (status != kalandra::Utf8Status::Valid) {
    if (status == kalandra::Utf8Status::Invalid)
      context->fault(3);
    return;
  }
  auto *data = static_cast<char *>(context->allocateRecord(length));
  if (!data)
    return;
  for (std::uint64_t offset = 0; offset < length;) {
    if (context->poll() != 0)
      return;
    const auto count = std::min<std::uint64_t>(1024, length - offset);
    std::memcpy(data + offset, source + offset, count);
    offset += count;
  }
  if (context->poll() == 0)
    *output = {data, data, static_cast<std::int64_t>(length)};
}
extern "C" void
kalandra_string_validate_v1(kalandra::runtime::Invocation *context,
                            const kalandra::runtime::StringDescriptor *value) noexcept {
  kalandra::runtime::validateString(*context, *value);
}
