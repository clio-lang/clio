const isStartOfLine = (compiler) => {
  return !compiler.lastToken || compiler.lastToken.type === "linebreak";
};

module.exports = [
  function header() {
    if (!isStartOfLine(this)) return false;
    const pattern = /^(#+)(.+)/;
    const match = this.code.match(pattern);
    if (match)
      this.token(match[0], "header", {
        level: match[1].length,
        text: match[2],
      });
    return !!match;
  },
  function blockquote() {
    if (!isStartOfLine(this)) return false;
    const pattern = /^>/;
    const match = this.code.match(pattern);
    if (match) this.token(match[0], "blockquote", {});
    return !!match;
  },
  function blocktext() {
    if (!isStartOfLine(this)) return false;
    const pattern = /^\[(.+?)\]>/;
    const match = this.code.match(pattern);
    if (match) this.token(match[0], "blocktext", { type: match[1] });
    return !!match;
  },
  function tab() {
    if (!isStartOfLine(this)) return false;
    const pattern = /^\|> +(.*)/;
    const match = this.code.match(pattern);
    if (match)
      this.token(match[0], "tab", {
        text: match[1],
      });
    return !!match;
  },
  function bold() {
    const pattern = /^\*\*(.+?)\*\*/;
    const match = this.code.match(pattern);
    if (match) this.token(match[0], "bold", { text: match[1] });
    return !!match;
  },
  function tablehead() {
    if (!isStartOfLine(this)) return false;
    const pattern = /^\|( *:?--+:?\ *\|)+/;
    const match = this.code.match(pattern);
    if (match) {
      const align = [...match[0].matchAll(/:?--+:?/g)].map((match) => {
        if (match[0].startsWith(":")) {
          return match[0].endsWith(":") ? "center" : "left";
        }
        if (match[0].endsWith(":")) return "right";
        return null;
      });
      this.token(match[0], "tablehead", { align });
    }
    return !!match;
  },
  function italic() {
    const pattern = /^(?<!_)_(.+?)_(?!_)/;
    const match = this.code.match(pattern);
    if (match) this.token(match[0], "italic", { text: match[1] });
    return !!match;
  },
  function image() {
    const pattern = /^!\[(.+?)]\((.+?)\)/;
    const match = this.code.match(pattern);
    if (match) this.token(match[0], "image", { text: match[1], src: match[2] });
    return !!match;
  },
  function link() {
    const pattern = /^\[(.+?)]\((.+?)\)/;
    const match = this.code.match(pattern);
    if (match) this.token(match[0], "link", { text: match[1], href: match[2] });
    return !!match;
  },
  function code() {
    if (!isStartOfLine(this)) return false;
    const pattern = /^```(.*?)\n((?:\\```|.|\n)+?)\n```/;
    const match = this.code.match(pattern);
    if (match)
      this.token(match[0], "code", { language: match[1], code: match[2] });
    return !!match;
  },
  function list() {
    if (!isStartOfLine(this)) return false;
    const pattern = /^( *(?:\d+\.|[*-]) .*?\n)+/;
    const match = this.code.match(pattern);
    if (match) {
      const items = [...match[0].matchAll(/( *)(\d+\.|[*-]) (.*?)\n/g)];
      this.token(match[0], "list", {
        items: items.map((match) => {
          return {
            text: match[3],
            bullet: match[2],
            level: match[1].length,
          };
        }),
      });
    }
    return !!match;
  },
  function inlinecode() {
    const pattern = /^`((?:\\`|.)+?)`/;
    const match = this.code.match(pattern);
    if (match)
      this.token(match[0], "inlinecode", {
        code: match[1],
      });
    return !!match;
  },
  function text() {
    const pattern = /^[^\s]+/;
    const match = this.code.match(pattern);
    if (match) this.token(match[0], "text");
    return !!match;
  },
  function linebreak() {
    const pattern = /^\n+/;
    const match = this.code.match(pattern);
    if (match) this.token(match[0], "linebreak");
    return !!match;
  },
  function empty() {
    const pattern = /^\s+/;
    const match = this.code.match(pattern);
    if (match) this.token(match[0], "empty");
    return !!match;
  },
];
