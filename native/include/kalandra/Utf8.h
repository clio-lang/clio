#pragma once
#include <cstdint>
#include <string_view>
namespace kalandra {
enum class Utf8Status { Valid, Invalid, Interrupted };
// A strict scalar decoder. Poll between bounded groups before touching bytes.
template <class Poll> Utf8Status validateUtf8(std::string_view text, Poll poll) {
  std::size_t count = 0;
  for (std::size_t i = 0; i < text.size();) {
    if ((count++ & 255) == 0 && !poll())
      return Utf8Status::Interrupted;
    const auto first = static_cast<unsigned char>(text[i]);
    if (first < 0x80) {
      ++i;
      continue;
    }
    const unsigned length = first >= 0xc2 && first <= 0xdf   ? 2
                            : first >= 0xe0 && first <= 0xef ? 3
                            : first >= 0xf0 && first <= 0xf4 ? 4
                                                             : 0;
    if (!length || length > text.size() - i)
      return Utf8Status::Invalid;
    std::uint32_t point = first & (0x7f >> length);
    for (unsigned j = 1; j < length; ++j) {
      const auto next = static_cast<unsigned char>(text[i + j]);
      if ((next & 0xc0) != 0x80)
        return Utf8Status::Invalid;
      point = (point << 6) | (next & 0x3f);
    }
    if (point < (length == 2   ? 0x80u
                 : length == 3 ? 0x800u
                               : 0x10000u) ||
        point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff))
      return Utf8Status::Invalid;
    i += length;
  }
  return poll() ? Utf8Status::Valid : Utf8Status::Interrupted;
}
inline bool validUtf8(std::string_view text) {
  return validateUtf8(text, [] { return true; }) == Utf8Status::Valid;
}
} // namespace kalandra
