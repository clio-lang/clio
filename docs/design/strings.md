# Native String contract

Proposed implementation contract — 2026-10-18. This is a review baseline for the next compiler slices, not implemented String support. The current compiler lexes quoted strings for module paths and has internal String-shaped task diagnostics; it does not yet provide ordinary String expressions or annotations.

The design follows the immutable [core](core.md) and [automatic memory model](memory.md). One ordinary `String` type represents text. No separate `Char` type, allocator arguments, mutable string buffers or lifetime annotations are introduced.

## Text and literals

A String is a finite sequence of Unicode scalar values, stored as well-formed UTF-8. A scalar excludes surrogate code points; UTF-8 uses one to four bytes per scalar. Validation follows [RFC 3629](https://www.rfc-editor.org/rfc/rfc3629): reject overlong encodings, isolated continuation bytes, truncated sequences, surrogate encodings and values above U+10FFFF. Noncharacters and unassigned scalar values remain valid; UTF-8 validity must not depend on a changing character database.

Double quotes delimit a literal. Direct Unicode text and the following escapes are allowed:

| Escape | Value |
| --- | --- |
| `\"` | Double quote |
| `\\` | Backslash |
| `\n`, `\r`, `\t` | LF, CR, tab |
| `\0` | U+0000 |
| `\u{H…}` | One scalar, with 1–6 hexadecimal digits |

Hex digits are case-insensitive. Unknown escapes, empty/oversized Unicode escapes, surrogate escapes and out-of-range escapes are compile errors. Raw LF/CR inside a literal is rejected; multiline/raw strings and interpolation are separate work. There is no `\xNN` byte escape or UTF-16 surrogate-pair escape syntax. Source byte spans remain available for diagnostics after decoding.

Embedded U+0000 is ordinary text. Strings are length-delimited, not C strings. No BOM is inserted or removed from a String; U+FEFF within a literal is data. There is no automatic newline conversion, normalization or replacement of invalid input. A future lossy decoder must have an explicit name; external byte decoding requires its own recoverable error contract before it is exposed.

## Operations

These examples specify intended behavior; they do not compile yet.

```kalandra
fn greeting(name: String) -> String:
  "Hello, " + name

fn main() -> String:
  greeting("Kalandra")
```

`String` annotations, inferred literals, ordinary helper arguments/results and immutable bindings follow existing core rules. Passing a number or Bool where String is required is a type error; there is no implicit formatting or parsing.

| Expression | Result / rule |
| --- | --- |
| `length(text)` | `int64` number of Unicode scalars |
| `byteLength(text)` | `int64` number of UTF-8 bytes |
| `text[index]` | A String containing one scalar |
| `slice(text, start, end)` | String over the half-open scalar interval `[start, end)` |
| `left + right` | Concatenate two Strings, preserving both operands |
| `left == right`, `left != right` | Exact scalar-sequence equality/inequality |

Index and slice operands accept completed int32/uint32/int64/uint64 scalars. Negative signed indexes, values above INT64_MAX, and out-of-range positions cause a checked Bounds fault; known-invalid constant cases are compile errors. Indexing requires `index < length(text)`. Slicing requires `0 <= start <= end <= length(text)`; it neither clamps nor wraps. An empty slice at the end is valid. `slice(text, 0, length(text))` equals `text`.

String length is not array/tensor shape metadata. A String is not `[uint8]` or `[String]`, has no tensor residence, and cannot be indexed as bytes. Numeric conversions, arithmetic other than String concatenation, whole-string logical operators and implicit array/tensor construction are rejected. Ordering comparisons are deferred; equality is not locale-sensitive collation.

## Unicode behavior without hidden transformations

Use “scalar” precisely; do not describe `length` as a count of visible characters. [Unicode text segmentation](https://www.unicode.org/reports/tr29/) defines grapheme clusters separately. A combining mark or a joiner may be a distinct scalar within one visible unit. Source order is preserved even for right-to-left text.

| Text | Scalars | UTF-8 bytes | Selected result |
| --- | ---: | ---: | --- |
| `""` | 0 | 0 | `slice("", 0, 0) == ""` |
| `"hello"` | 5 | 5 | `"hello"[1] == "e"` |
| `"سلام"` | 4 | 8 | `"سلام"[0] == "س"` |
| `"é"` | 1 | 2 | Index 0 returns `"é"` |
| `"e\u{301}"` | 2 | 3 | Index 1 returns the combining mark alone |
| `"👩‍💻"` | 3 | 11 | Index 1 returns U+200D, the joiner |
| `"a\0b"` | 3 | 3 | Index 1 returns `"\0"` |

`"é" != "e\u{301}"`. Normalization can make distinct sequences comparable in other ways, but String equality does not perform it. [Unicode normalization](https://www.unicode.org/reports/tr15/) and grapheme-aware APIs belong in explicitly named library operations, with pinned Unicode data and independent conformance tests when introduced. The language core does not silently change text, equality or scalar indexing when such tables are updated.

## Cost, ownership and failure

The initial flat UTF-8 implementation may scan for scalar length, indexing and slice boundaries. Budget `length` and scalar-position lookup as O(n), not O(1); `byteLength` is O(1). Equality is at most linear in bytes and concatenation at most linear in the combined byte length. Repeated `text[i]` in a loop can therefore be quadratic. A future scalar iterator should scan once; do not expose an unimplemented iterator API now. Cached counts, indexing accelerators and shared slices are optimizations, not extra source syntax.

Both byte and scalar counts must fit nonnegative int64. Runtime resource budgets may be smaller. Check combined byte counts before concatenation or allocation. Allocation/resource failure uses the existing checked-fault and settlement rules; partial text must never escape. No operation can manufacture an ill-formed UTF-8 String or split a scalar encoding.

A returned String remains valid after its helper returns. Captures, slices, records, arrays and unfinished tasks must keep required backing alive as those integrations are implemented. A slice may share storage, provided its lifetime is retained and its boundaries are valid. Copying is also permitted; pointer identity is not observable. Static literal storage and invocation-owned storage need explicit trusted provenance internally. Never accept arbitrary native pointers as static strings merely because an ownership field is null.

Worker handoff must carry validated lengths/provenance, retain the backing and leave the destination unpublished on failure. Dynamic allocation, scans and copies use the existing cooperative cancellation machinery. Native task diagnostic messages/reasons must be adapted to this model before becoming ordinary usable String values; their current private borrowed representation is not a public String ABI.

A String-valued CLI `main` writes its UTF-8 bytes followed by one LF, without quotes or NUL truncation. Validate and settle the result ownership before output, as with collection results. Structured display for future String arrays/records requires escaped, quoted elements and separate tests. Native String support initially targets CPU execution; GPU strings, distributed contracts and public C/C++ interfaces are outside this step.

## Implementation sequence and gates

1. **Literal/value foundation:** String AST and strict escape decoding, typed String literals/annotations, trusted literal and managed storage validation, synchronous helpers/returns and CLI output. Adapt existing internal diagnostic String values or explicitly gate their ordinary use until safe. Prove empty/non-ASCII/NUL behavior and failures before exposing further composition.
2. **Value operations:** exact equality and concatenation, checked allocation/overflow and fault ordering; byte/scalar lengths and scalar-boundary indexing/slicing. Keep operations gated until their own behavior is implemented and qualified.
3. **Workers and captures:** owned packets, source settlement, cached outcomes, cancellation, allocation failure and no partial publication; then ordinary callback captures.
4. **Compound values:** String record fields, String arrays and numeric/Bool/record/String map combinations, with the same finite-layout and recursive-retention rules. Do not silently enable these by adding a builtin tag.
5. **Text libraries and optimization:** explicit decoding/encoding once byte types and recoverable errors are ready; normalization, grapheme iteration and locale behavior with pinned tables; shared slices, cached counts and linear traversal. Add broader library operations independently.

[Conformance vectors](fixtures/strings-semantics.json) record scalar/byte counts, exact equality, index/slice results, invalid UTF-8, literal escape cases and bounds decisions for future tests. They are design data, not evidence of compiler implementation. Qualification must also cover all scalar boundary widths, cancellation during long scans, failure cleanup, external descriptor validation and result lifetime. Reuse generic ownership/scheduling machinery rather than building a separate String runtime for each context.
