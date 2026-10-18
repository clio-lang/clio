#include "String.h"
#include "../include/kalandra/Utf8.h"
#include <algorithm>
#include <cstring>
#include <limits>
namespace kalandra::runtime {
namespace {
bool inspectString(Invocation &context, const StringDescriptor &value,
                   std::uint64_t *scalars = nullptr) noexcept {
  if (context.poll() != 0 || !context.usable())
    return false;
  const auto invalid = [&] {
    context.fault(3);
    return false;
  };
  if (value.byteLength == 0) {
    if (value.allocated || value.data)
      return invalid();
    if (scalars)
      *scalars = 0;
    return true;
  }
  if (value.byteLength < 0 || !value.allocated || value.data != value.allocated)
    return invalid();
  auto backing = context.lease(value.allocated);
  if (!backing || static_cast<std::uint64_t>(value.byteLength) > backing->bytes().size())
    return invalid();
  auto status = validateUtf8(
      std::string_view(value.data, value.byteLength), [&] { return context.poll() == 0; }, scalars);
  return status == Utf8Status::Valid || (status == Utf8Status::Invalid && invalid());
}
} // namespace
bool validateString(Invocation &context, const StringDescriptor &value) noexcept {
  return inspectString(context, value);
}
static std::int64_t stringLength(Invocation &context, const StringDescriptor &value,
                                 bool bytes) noexcept {
  std::uint64_t count = 0;
  if (!inspectString(context, value, bytes ? nullptr : &count))
    return 0;
  return bytes ? value.byteLength : static_cast<std::int64_t>(count);
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
extern "C" void
kalandra_string_concat_v1(kalandra::runtime::Invocation *context,
                          kalandra::runtime::StringDescriptor *output,
                          const kalandra::runtime::StringDescriptor *left,
                          const kalandra::runtime::StringDescriptor *right) noexcept {
  // Copy descriptors first, permitting output to alias an input descriptor.
  const auto a = *left, b = *right;
  *output = {};
  if (!kalandra::runtime::validateString(*context, a) ||
      !kalandra::runtime::validateString(*context, b))
    return;
  const auto length = kalandra::runtime::combinedStringBytes(a.byteLength, b.byteLength);
  if (!length) {
    context->fault(2);
    return;
  }
  if (!*length)
    return;
  auto *data = static_cast<char *>(context->allocateRecord(*length));
  if (!data)
    return;
  std::uint64_t offset = 0;
  for (const auto &part : {a, b}) {
    for (std::uint64_t i = 0; i < static_cast<std::uint64_t>(part.byteLength);) {
      if (context->poll() != 0)
        return;
      const auto count = std::min<std::uint64_t>(1024, part.byteLength - i);
      std::memcpy(data + offset, part.data + i, count);
      i += count;
      offset += count;
    }
  }
  if (context->poll() == 0)
    *output = {data, data, static_cast<std::int64_t>(*length)};
}
extern "C" std::int64_t
kalandra_string_equal_v1(kalandra::runtime::Invocation *context,
                         const kalandra::runtime::StringDescriptor *left,
                         const kalandra::runtime::StringDescriptor *right) noexcept {
  // Validate both complete operands before length/prefix shortcuts, even aliases.
  if (!kalandra::runtime::validateString(*context, *left) ||
      !kalandra::runtime::validateString(*context, *right))
    return 0;
  if (left->byteLength != right->byteLength)
    return 0;
  for (std::uint64_t i = 0; i < static_cast<std::uint64_t>(left->byteLength);) {
    if (context->poll() != 0)
      return 0;
    const auto count = std::min<std::uint64_t>(1024, left->byteLength - i);
    if (std::memcmp(left->data + i, right->data + i, count))
      return 0;
    i += count;
  }
  return context->poll() == 0 ? 1 : 0;
}
extern "C" std::int64_t
kalandra_string_length_v1(kalandra::runtime::Invocation *context,
                          const kalandra::runtime::StringDescriptor *value) noexcept {
  return kalandra::runtime::stringLength(*context, *value, false);
}
extern "C" std::int64_t
kalandra_string_byte_length_v1(kalandra::runtime::Invocation *context,
                               const kalandra::runtime::StringDescriptor *value) noexcept {
  return kalandra::runtime::stringLength(*context, *value, true);
}
