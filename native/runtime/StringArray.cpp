#include "StringArray.h"
#include <cstring>
extern "C" void
kalandra_string_array_validate_v1(kalandra::runtime::Invocation *context,
                                  const kalandra::runtime::StringArrayDescriptor *value) noexcept {
  using namespace kalandra::runtime;
  if (context->poll() != 0)
    return;
  kalandra_record_array_validate_v1(context, value, sizeof(StringDescriptor),
                                    alignof(StringDescriptor));
  if (context->poll() != 0 || !context->usable())
    return;
  auto lease = value->allocated ? context->lease(value->allocated) : std::nullopt;
  if (value->size && !lease) {
    context->fault(3);
    return;
  }
  for (std::int64_t i = 0; i < value->size; ++i) {
    StringDescriptor cell;
    std::memcpy(&cell, lease->bytes().data() + i * sizeof(cell), sizeof(cell));
    if (!validateString(*context, cell))
      return;
  }
}
extern "C" bool
kalandra_string_array_retain_v1(kalandra::runtime::Invocation *destination,
                                const kalandra::runtime::Invocation *source,
                                const kalandra::runtime::StringArrayDescriptor *value) noexcept {
  using namespace kalandra::runtime;
  if (destination->poll() != 0 || !destination->usable())
    return false;
  if (!kalandra_record_array_retain_v1(destination, source, value, sizeof(StringDescriptor),
                                       alignof(StringDescriptor)))
    return false;
  auto lease = value->allocated ? source->lease(value->allocated) : std::nullopt;
  if (value->size && !lease) {
    destination->fault(3);
    return false;
  }
  for (std::int64_t i = 0; i < value->size; ++i) {
    StringDescriptor cell;
    std::memcpy(&cell, lease->bytes().data() + i * sizeof(cell), sizeof(cell));
    if (!kalandra_string_retain_v1(destination, source, &cell))
      return false;
  }
  return destination->poll() == 0;
}
