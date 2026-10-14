import { createToken, Lexer } from "chevrotain";

const token = (name: string, pattern: RegExp) => createToken({ name, pattern });
export const Newline = createToken({
  name: "Newline",
  pattern: /\r?\n/,
  line_breaks: true,
});
export const Space = createToken({
  name: "Space",
  pattern: / +/,
  group: "spaces",
});
export const Comment = createToken({
  name: "Comment",
  pattern: /--[^\r\n]*/,
  group: "comments",
});
export const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /"(?:\\[\s\S]|[^"\\])*"/,
  line_breaks: true,
});
export const NumberLiteral = token(
  "NumberLiteral",
  /-?[0-9][\d_]*(?:\.[\d_]+)?(?:[eE][+-]?[\d_]+)?/,
);
export const Parameter = token("Parameter", /@[a-z_$][0-9a-z_$]*/i);
export const Identifier = token("Identifier", /[a-z_$][0-9a-z_$]*/i);
// Keep Clio's whitespace-sensitive keyword recognition, including its two exceptions.
const keyword = (name: string, word: string, extra = "") =>
  token(name, new RegExp(`${word}(?=\\s|(?![\\s\\S])${extra})`));
export const Fn = keyword("Fn", "fn");
export const If = keyword("If", "if");
export const Else = keyword("Else", "else", "|:");
export const Await = keyword("Await", "await", "|\\]");
export const AwaitAll = token("AwaitAll", /\[await\]/);
export const Import = keyword("Import", "import");
export const From = keyword("From", "from");
export const As = keyword("As", "as");
export const Export = keyword("Export", "export");
export const Type = keyword("Type", "type");
export const List = keyword("List", "list");
export const Is = keyword("Is", "is");
export const And = keyword("And", "and");
export const Or = keyword("Or", "or");
export const Not = keyword("Not", "not");
export const By = keyword("By", "by");
export const In = keyword("In", "in");
export const Arrow = token("Arrow", /->/);
export const FatArrow = token("FatArrow", /=>/);
export const Range = token("Range", /\.\./);
export const Power = token("Power", /\*\*/);
export const Equal = token("Equal", /==/);
export const GreaterEqual = token("GreaterEqual", />=/);
export const LessEqual = token("LessEqual", /<=/);
export const Plus = token("Plus", /\+/);
export const Minus = token("Minus", /-/);
export const Star = token("Star", /\*/);
export const Slash = token("Slash", /\//);
export const Percent = token("Percent", /%/);
export const Greater = token("Greater", />/);
export const Less = token("Less", /</);
export const Assign = token("Assign", /=/);
export const Dot = token("Dot", /\./);
export const Pipe = token("Pipe", /\|/);
export const Hash = token("Hash", /#/);
export const Colon = token("Colon", /:/);
export const LParen = token("LParen", /\(/);
export const RParen = token("RParen", /\)/);
export const LSquare = token("LSquare", /\[/);
export const RSquare = token("RSquare", /\]/);
export const LCurly = token("LCurly", /\{/);
export const RCurly = token("RCurly", /\}/);
const virtual = (name: string) => createToken({ name, pattern: Lexer.NA });
export const Indent = virtual("Indent");
export const Dedent = virtual("Dedent");
export const SliceStart = virtual("SliceStart");
export const FormatStart = virtual("FormatStart");
export const FormatEnd = virtual("FormatEnd");
export const FormatText = virtual("FormatText");
export const InterpolationStart = virtual("InterpolationStart");
export const InterpolationEnd = virtual("InterpolationEnd");
export const physicalTokens = [
  Space,
  Comment,
  Newline,
  StringLiteral,
  AwaitAll,
  Fn,
  If,
  Else,
  Await,
  Import,
  From,
  As,
  Export,
  Type,
  List,
  Is,
  And,
  Or,
  Not,
  By,
  In,
  Parameter,
  Identifier,
  NumberLiteral,
  Arrow,
  FatArrow,
  Range,
  Power,
  Equal,
  GreaterEqual,
  LessEqual,
  Plus,
  Minus,
  Star,
  Slash,
  Percent,
  Greater,
  Less,
  Assign,
  Dot,
  Pipe,
  Hash,
  Colon,
  LParen,
  RParen,
  LSquare,
  RSquare,
  LCurly,
  RCurly,
];
export const allTokens = [
  ...physicalTokens,
  Indent,
  Dedent,
  SliceStart,
  FormatStart,
  FormatEnd,
  FormatText,
  InterpolationStart,
  InterpolationEnd,
];
