#include "Edits.h"
#include "kalandra/Diagnostics.h"
#include "kalandra/Project.h"
#include "kalandra/Semantics.h"
#include "kalandra/Utf8.h"
#include "llvm/Support/JSON.h"
#include "llvm/Support/raw_ostream.h"
#include <algorithm>
#include <charconv>
#include <cmath>
#include <filesystem>
#include <iostream>
#include <limits>
#include <map>
#include <set>
#include <stdexcept>
#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif
namespace j = llvm::json;
namespace fs = std::filesystem;
using namespace kalandra;
namespace {
constexpr std::size_t maxFrame = 32 * 1024 * 1024, maxHeader = 8192;
std::string encode(const j::Value &value) {
  std::string text;
  llvm::raw_string_ostream stream(text);
  stream << value;
  return text;
}
void send(j::Value value) {
  auto text = encode(value);
  std::cout << "Content-Length: " << text.size() << "\r\n\r\n" << text << std::flush;
}
void error(j::Value id, int code, std::string message) {
  send(j::Object{{"jsonrpc", "2.0"},
                 {"id", std::move(id)},
                 {"error", j::Object{{"code", code}, {"message", std::move(message)}}}});
}
void log(std::string message) {
  if (!j::isUTF8(message))
    message = j::fixUTF8(message);
  send(j::Object{{"jsonrpc", "2.0"},
                 {"method", "window/logMessage"},
                 {"params", j::Object{{"type", 2}, {"message", std::move(message)}}}});
}
// Empty optional is clean EOF. Invalid framing is fatal: no reliable next boundary.
std::optional<std::string> readFrame() {
  std::string header;
  char byte;
  while (std::cin.get(byte)) {
    if (static_cast<unsigned char>(byte) > 127 || header.size() == maxHeader)
      throw std::runtime_error("invalid or oversized protocol header");
    header += byte;
    if (header.ends_with("\r\n\r\n"))
      break;
  }
  if (header.empty() && std::cin.eof())
    return {};
  if (!header.ends_with("\r\n\r\n"))
    throw std::runtime_error("truncated protocol header");
  std::optional<std::size_t> length;
  for (std::size_t at = 0; at + 2 < header.size();) {
    const auto end = header.find("\r\n", at);
    auto line = std::string_view(header).substr(at, end - at);
    at = end + 2;
    if (line.empty())
      break;
    const auto colon = line.find(':');
    if (colon == line.npos)
      throw std::runtime_error("invalid protocol header field");
    std::string name(line.substr(0, colon));
    std::ranges::transform(name, name.begin(), [](unsigned char c) {
      return c >= 'A' && c <= 'Z' ? char(c + 32) : char(c);
    });
    auto value = line.substr(colon + 1);
    while (!value.empty() && (value.front() == ' ' || value.front() == '\t'))
      value.remove_prefix(1);
    while (!value.empty() && (value.back() == ' ' || value.back() == '\t'))
      value.remove_suffix(1);
    if (name == "content-length") {
      std::size_t number = 0;
      const auto parsed = std::from_chars(value.data(), value.data() + value.size(), number);
      if (length || parsed.ec != std::errc{} || parsed.ptr != value.data() + value.size() ||
          !number || number > maxFrame)
        throw std::runtime_error("invalid protocol content length");
      length = number;
    } else if (name == "content-type") {
      std::string normalized;
      for (unsigned char c : value)
        if (c != ' ' && c != '\t')
          normalized += c >= 'A' && c <= 'Z' ? char(c + 32) : char(c);
      const auto charset = normalized.find("charset=");
      if (charset != normalized.npos) {
        auto encoding = std::string_view(normalized).substr(charset + 8);
        encoding = encoding.substr(0, encoding.find(';'));
        if (encoding.size() >= 2 && encoding.front() == '"' && encoding.back() == '"') {
          encoding.remove_prefix(1);
          encoding.remove_suffix(1);
        }
        if (encoding != "utf-8" && encoding != "utf8")
          throw std::runtime_error("protocol charset must be UTF-8");
      }
    }
  }
  if (!length)
    throw std::runtime_error("missing protocol content length");
  std::string body(*length, '\0');
  if (!std::cin.read(body.data(), static_cast<std::streamsize>(*length)))
    throw std::runtime_error("truncated protocol body");
  return body;
}
bool boundedJson(std::string_view text) {
  std::size_t depth = 0;
  bool quoted = false, escape = false;
  for (char c : text) {
    if (quoted) {
      if (escape)
        escape = false;
      else if (c == '\\')
        escape = true;
      else if (c == '"')
        quoted = false;
    } else if (c == '"')
      quoted = true;
    else if (c == '[' || c == '{') {
      if (++depth > 128)
        return false;
    } else if ((c == ']' || c == '}') && depth)
      --depth;
  }
  return true;
}
int hex(char c) {
  if (c >= '0' && c <= '9')
    return c - '0';
  if (c >= 'a' && c <= 'f')
    return c - 'a' + 10;
  if (c >= 'A' && c <= 'F')
    return c - 'A' + 10;
  return -1;
}
std::optional<std::string> pathFromUri(llvm::StringRef ref) {
  std::string_view uri(ref.data(), ref.size());
  if (!uri.starts_with("file://"))
    return {};
  uri.remove_prefix(7);
  if (uri.starts_with("localhost/"))
    uri.remove_prefix(9);
  if (uri.empty() || uri.front() != '/' || uri.find_first_of("?#") != uri.npos)
    return {};
  std::string path;
  for (std::size_t at = 0; at < uri.size(); ++at) {
    if (uri[at] == '%') {
      if (uri.size() - at < 3 || hex(uri[at + 1]) < 0 || hex(uri[at + 2]) < 0)
        return {};
      path += char(hex(uri[at + 1]) * 16 + hex(uri[at + 2]));
      at += 2;
    } else
      path += uri[at];
  }
  if (!validUtf8(path) || path.find_first_of(std::string("\0\r\n", 3)) != path.npos ||
      fs::path(path).extension() != ".k")
    return {};
  std::error_code ec;
  const auto canonical = fs::weakly_canonical(fs::path(path), ec);
  if (ec || canonical.empty())
    return {};
  return canonical.string();
}
std::string uriFromPath(std::string_view path) {
  constexpr char digits[] = "0123456789ABCDEF";
  std::string uri = "file://";
  for (unsigned char c : path) {
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '/' ||
        c == '-' || c == '_' || c == '.' || c == '~' || c == ':')
      uri += char(c);
    else {
      uri += '%';
      uri += digits[c >> 4];
      uri += digits[c & 15];
    }
  }
  return uri;
}
std::optional<std::int64_t> protocolInteger(const j::Value *value) {
  // Bound before LLVM's floating-number-to-integer conversion.
  const auto number = value ? value->getAsNumber() : std::nullopt;
  if (!number || !std::isfinite(*number) || *number < std::numeric_limits<std::int32_t>::min() ||
      *number > std::numeric_limits<std::int32_t>::max())
    return {};
  return value->getAsInteger();
}
std::optional<lsp::Position> editPosition(const j::Object *position) {
  const auto line = position ? protocolInteger(position->get("line")) : std::nullopt;
  const auto character = position ? protocolInteger(position->get("character")) : std::nullopt;
  if (!line || !character || *line < 0 || *character < 0)
    return {};
  return lsp::Position{static_cast<std::size_t>(*line), static_cast<std::size_t>(*character)};
}
struct Document {
  std::string uri, text;
  std::int64_t version;
};
class Session {
  std::map<std::string, Document> documents;
  std::map<std::string, std::string> published;
  std::size_t bytes = 0;
  std::optional<NativeProject> project;
  CheckOptions options;

public:
  bool initialized = false, shutdown = false;
  Session(std::optional<NativeProject> p, bool placement) : project(std::move(p)) {
    options.placement = placement;
  }
  void refresh() {
    std::vector<SourceOverlay> overlays;
    std::set<std::string> roots;
    for (const auto &[path, document] : documents) {
      overlays.push_back({path, document.text});
      roots.insert(path);
    }
    if (project && !documents.empty())
      roots.insert(project->entry);
    std::map<std::string, j::Array> diagnostics;
    std::map<std::string, std::set<std::string>> seen;
    for (const auto &[path, doc] : documents)
      diagnostics.try_emplace(path);
    const std::vector<ModulePackage> empty;
    const auto &packages = project ? project->packages : empty;
    for (const auto &root : roots) {
      auto syntax = loadModules(root, {}, {}, packages, overlays);
      if (!syntax) {
        log("Cannot check " + root + ": " + syntax.error());
        continue;
      }
      auto checked = check(std::move(*syntax), {}, options);
      const bool synthetic = checked.source && checked.source->text().empty() &&
                             std::ranges::all_of(checked.diagnostics, [](const auto &d) {
                               return d.code.starts_with("M");
                             });
      auto report = j::parse(
          renderDiagnosticsJson(synthetic ? nullptr : checked.source.get(), checked.diagnostics));
      if (!report)
        throw std::runtime_error(llvm::toString(report.takeError()));
      for (const auto &value : *report->getAsObject()->getArray("diagnostics")) {
        const auto &d = *value.getAsObject();
        const auto file = d.getString("file");
        const auto range = d.getObject("range");
        if (!file || !range) {
          log(std::string(*d.getString("message")));
          continue;
        }
        j::Value output = j::Object{{"range", *d.get("range")},
                                    {"severity", 1},
                                    {"source", "kalandra"},
                                    {"code", *d.get("code")},
                                    {"message", *d.get("message")}};
        const auto path = std::string(*file);
        if (seen[path].insert(encode(output)).second)
          diagnostics[path].push_back(std::move(output));
      }
    }
    for (const auto &[path, uri] : published)
      diagnostics.try_emplace(path);
    std::map<std::string, std::string> next;
    for (auto &[path, list] : diagnostics) {
      auto open = documents.find(path);
      const bool active = open != documents.end() || !list.empty();
      const auto previous = published.find(path);
      const auto uri = open != documents.end()                  ? open->second.uri
                       : !active && previous != published.end() ? previous->second
                                                                : uriFromPath(path);
      if (previous != published.end() && previous->second != uri)
        send(j::Object{
            {"jsonrpc", "2.0"},
            {"method", "textDocument/publishDiagnostics"},
            {"params", j::Object{{"uri", previous->second}, {"diagnostics", j::Array{}}}}});
      j::Object params{{"uri", uri}, {"diagnostics", std::move(list)}};
      if (open != documents.end())
        params["version"] = open->second.version;
      // Retain only paths with active diagnostics or open buffers for later clearing.
      if (active)
        next.emplace(path, uri);
      send(j::Object{{"jsonrpc", "2.0"},
                     {"method", "textDocument/publishDiagnostics"},
                     {"params", std::move(params)}});
    }
    published = std::move(next);
  }
  void document(llvm::StringRef method, const j::Object *params) {
    const auto item = params ? params->getObject("textDocument") : nullptr;
    const auto uri = item ? item->getString("uri") : std::nullopt;
    const auto path = uri ? pathFromUri(*uri) : std::nullopt;
    if (!path) {
      log("Expected a local file URI for a .k document");
      return;
    }
    auto found = documents.find(*path);
    if (method == "textDocument/didClose") {
      if (found == documents.end() || found->second.uri != *uri)
        return;
      bytes -= found->second.text.size() + 1;
      documents.erase(found);
      refresh();
      return;
    }
    if (method == "textDocument/didSave") {
      if (found != documents.end())
        refresh();
      return;
    }
    const auto version = protocolInteger(item->get("version"));
    if (!version || *version < std::numeric_limits<std::int32_t>::min() ||
        *version > std::numeric_limits<std::int32_t>::max()) {
      log("Expected an integer document version");
      return;
    }
    std::optional<std::string> text;
    const auto oldBytes = found == documents.end() ? 0 : found->second.text.size() + 1;
    if (method == "textDocument/didOpen") {
      if (found != documents.end()) {
        log("Document identity is already open");
        return;
      }
      if (auto value = item->getString("text"))
        text = std::string(*value);
    } else {
      if (found == documents.end() || found->second.uri != *uri) {
        log("Document is not open under this URI");
        return;
      }
      if (*version <= found->second.version)
        return;
      const auto changes = params->getArray("contentChanges");
      if (!changes || changes->size() > lsp::EditLimits{}.maxChanges) {
        log("Missing or excessive document content changes");
        return;
      }
      std::vector<lsp::TextChange> edits;
      for (const auto &change : *changes) {
        const auto event = change.getAsObject();
        const auto replacement = event ? event->getString("text") : std::nullopt;
        if (!replacement) {
          log("Expected replacement text for document edit");
          return;
        }
        lsp::TextChange edit{{}, std::string(*replacement), {}};
        if (event->get("range")) {
          const auto range = event->getObject("range");
          const auto start = editPosition(range ? range->getObject("start") : nullptr);
          const auto end = editPosition(range ? range->getObject("end") : nullptr);
          if (!start || !end) {
            log("Expected a nonnegative UTF-16 document range");
            return;
          }
          edit.range = lsp::Range{*start, *end};
        }
        if (event->get("rangeLength")) {
          const auto length = protocolInteger(event->get("rangeLength"));
          if (!length || *length < 0) {
            log("Invalid document rangeLength");
            return;
          }
          edit.rangeLength = static_cast<std::size_t>(*length);
        }
        edits.push_back(std::move(edit));
      }
      lsp::EditLimits limits;
      limits.maxBytes = SyntaxLimits{}.maxSourceBytes - 1 - (bytes - oldBytes);
      auto applied = lsp::applyChanges(found->second.text, edits, limits);
      if (!applied) {
        log(applied.error());
        return;
      }
      text = std::move(*applied);
    }
    if (!text || text->size() >= SyntaxLimits{}.maxSourceBytes - (bytes - oldBytes) ||
        (found == documents.end() && documents.size() >= ModuleLimits{}.maxFiles)) {
      log("Document text is missing or open-buffer budgets are exceeded");
      return;
    }
    bytes = bytes - oldBytes + text->size() + 1;
    documents.insert_or_assign(*path, Document{std::string(*uri), std::string(*text), *version});
    refresh();
  }
};
} // namespace
int main(int argc, char **argv) {
#ifdef _WIN32
  _setmode(_fileno(stdin), _O_BINARY);
  _setmode(_fileno(stdout), _O_BINARY);
#endif
  try {
    std::optional<NativeProject> project;
    bool placement = false;
    for (int i = 1; i < argc; ++i) {
      const std::string_view arg = argv[i];
      if (arg == "--placement" && !placement)
        placement = true;
      else if (arg == "--project" && !project && i + 1 < argc) {
        auto loaded = loadNativeProject(argv[++i]);
        if (!loaded) {
          std::cerr << loaded.error() << '\n';
          return 2;
        }
        project = std::move(*loaded);
      } else {
        std::cerr << "usage: kalandra-lsp [--placement] [--project manifest.toml]\n";
        return 2;
      }
    }
    Session session(std::move(project), placement);
    while (auto body = readFrame()) {
      if (!boundedJson(*body)) {
        error(nullptr, -32700, "JSON nesting limit exceeded");
        continue;
      }
      auto parsed = j::parse(*body);
      if (!parsed) {
        llvm::consumeError(parsed.takeError());
        error(nullptr, -32700, "Invalid JSON");
        continue;
      }
      const auto object = parsed->getAsObject();
      const auto method = object ? object->getString("method") : std::nullopt;
      const auto id = object ? object->get("id") : nullptr;
      const bool request = id != nullptr;
      if (!object || !method || object->getString("jsonrpc") != "2.0" ||
          (id && !protocolInteger(id) && !id->getAsString())) {
        error(nullptr, -32600, "Invalid request");
        continue;
      }
      if (*method == "exit" && !request)
        return session.shutdown ? 0 : 1;
      if (*method == "initialize" && request && !session.initialized && !session.shutdown) {
        if (!object->getObject("params")) {
          error(*id, -32602, "Expected initialize parameters");
          continue;
        }
        session.initialized = true;
        send(j::Object{
            {"jsonrpc", "2.0"},
            {"id", *id},
            {"result",
             j::Object{{"capabilities",
                        j::Object{{"positionEncoding", "utf-16"},
                                  {"textDocumentSync",
                                   j::Object{{"openClose", true},
                                             {"change", 2},
                                             {"save", j::Object{{"includeText", false}}}}}}},
                       {"serverInfo", j::Object{{"name", "kalandra-native"}}}}}});
      } else if (!session.initialized) {
        if (request)
          error(*id, -32002, "Server not initialized");
      } else if (session.shutdown) {
        if (request)
          error(*id, -32600, "Server is shut down");
      } else if (*method == "shutdown" && request) {
        session.shutdown = true;
        send(j::Object{{"jsonrpc", "2.0"}, {"id", *id}, {"result", nullptr}});
      } else if (request)
        error(*id, *method == "initialize" ? -32600 : -32601, "Unsupported request");
      else if (*method == "textDocument/didOpen" || *method == "textDocument/didChange" ||
               *method == "textDocument/didClose" || *method == "textDocument/didSave")
        session.document(*method, object->getObject("params"));
    }
    return session.shutdown ? 0 : 1;
  } catch (const std::exception &e) {
    std::cerr << "kalandra-lsp: " << e.what() << '\n';
    return 2;
  }
}
