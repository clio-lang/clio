#include "kalandra/Syntax.h"
#include <algorithm>
#include <fstream>
#include <sstream>

namespace kalandra {
SourceFile::SourceFile(std::string path, std::string text)
    : path_(std::move(path)), text_(std::move(text)), lines_{0} {
  for (std::size_t i = 0; i < text_.size(); ++i)
    if (text_[i] == '\n')
      lines_.push_back(i + 1);
}
std::string_view SourceFile::slice(SourceSpan span) const {
  const auto begin = std::min(span.begin, text_.size());
  const auto end = std::clamp(span.end, begin, text_.size());
  return std::string_view(text_).substr(begin, end - begin);
}
std::pair<std::size_t, std::size_t> SourceFile::location(std::size_t offset) const {
  offset = std::min(offset, text_.size());
  const auto line = static_cast<std::size_t>(
      std::upper_bound(lines_.begin(), lines_.end(), offset) - lines_.begin());
  return {line, offset - lines_[line - 1] + 1};
}
std::string_view SourceFile::line(std::size_t number) const {
  if (number == 0 || number > lines_.size())
    return {};
  const auto begin = lines_[number - 1];
  auto end = number < lines_.size() ? lines_[number] : text_.size();
  while (end > begin && (text_[end - 1] == '\n' || text_[end - 1] == '\r'))
    --end;
  return slice({begin, end});
}
std::string renderDiagnostic(const SourceFile &source, const Diagnostic &diagnostic) {
  const auto [line, column] = source.location(diagnostic.span.begin);
  const auto text = source.line(line);
  const auto start = column > 81 ? column - 81 : 0;
  const auto excerpt = text.substr(std::min(start, text.size()), 160);
  const auto caret = std::min(column - 1 - start, excerpt.size());
  const auto width = std::max<std::size_t>(1, std::min({diagnostic.span.end - diagnostic.span.begin,
                                                        excerpt.size() - caret, std::size_t{40}}));
  std::ostringstream output;
  output << source.path() << ':' << line << ':' << column << ": error[" << diagnostic.code
         << "]: " << diagnostic.message << '\n'
         << "  " << excerpt << '\n'
         << "  " << std::string(caret, ' ') << std::string(width, '^') << '\n';
  return output.str();
}
std::expected<std::shared_ptr<const SourceFile>, std::string> loadSource(std::string path,
                                                                         std::size_t maximum) {
  std::ifstream file(path, std::ios::binary);
  if (!file)
    return std::unexpected("cannot open source file");
  std::string text;
  char buffer[8192];
  while (file.read(buffer, sizeof(buffer)) || file.gcount()) {
    if (static_cast<std::size_t>(file.gcount()) > maximum - text.size())
      return std::unexpected("source exceeds the configured size limit");
    text.append(buffer, static_cast<std::size_t>(file.gcount()));
  }
  if (!file.eof())
    return std::unexpected("cannot read source file");
  return std::make_shared<const SourceFile>(std::move(path), std::move(text));
}
} // namespace kalandra
