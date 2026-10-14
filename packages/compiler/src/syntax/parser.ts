import { CstParser, EOF, type IToken } from "chevrotain";
import * as T from "./tokens.js";

/** Syntax only: semantic actions live in the independent AST visitor. */
export class KalandraParser extends CstParser {
  constructor() {
    super(T.allTokens, {
      recoveryEnabled: true,
      nodeLocationTracking: "full",
      maxLookahead: 2,
    });
    this.performSelfAnalysis();
  }

  private indentAhead(): boolean {
    let n = 1;
    while (this.LA(n).tokenType === T.Newline) n++;
    return this.LA(n).tokenType === T.Indent;
  }
  private elseAhead(): boolean {
    let n = 1;
    while (this.LA(n).tokenType === T.Newline) n++;
    return this.LA(n).tokenType === T.Else;
  }
  private assignmentAhead(): boolean {
    let n = 1;
    // Inspect postfix targets without mistaking an assignment inside an index
    // or group for the outer assignment. Match the same reference bases as Clio.
    const balanced = (): boolean => {
      const closing = new Map([
        [T.LParen, T.RParen],
        [T.SliceStart, T.RSquare],
        [T.LSquare, T.RSquare],
        [T.LCurly, T.RCurly],
      ]);
      const stack = [closing.get(this.LA(n++).tokenType)!];
      while (stack.length) {
        const kind = this.LA(n++).tokenType;
        if (kind === EOF) return false;
        const close = closing.get(kind);
        if (close) stack.push(close);
        else if ([T.RParen, T.RSquare, T.RCurly].includes(kind)) {
          if (stack.pop() !== kind) return false;
        }
      }
      return true;
    };
    const postfix = (): boolean => {
      if (this.LA(n).tokenType === T.Identifier) n++;
      else return false;
      while (true) {
        if (
          this.LA(n).tokenType === T.Dot &&
          this.LA(n + 1).tokenType === T.Identifier
        )
          n += 2;
        else if (this.LA(n).tokenType === T.SliceStart) {
          if (!balanced()) return false;
        } else break;
      }
      return true;
    };
    if (!postfix()) return false;
    if (this.LA(n).tokenType === T.Assign) return true;
    return postfix() && this.LA(n).tokenType === T.Assign;
  }

  private startsArgument(token: IToken): boolean {
    return [
      T.Identifier,
      T.Parameter,
      T.NumberLiteral,
      T.StringLiteral,
      T.LParen,
      T.LSquare,
      T.LCurly,
      T.Hash,
      T.Pipe,
      T.Range,
      T.By,
      T.Not,
      T.Await,
      T.AwaitAll,
    ].includes(token.tokenType);
  }

  readonly program = this.RULE("program", () => {
    this.MANY(() =>
      this.OR([
        { ALT: () => this.CONSUME(T.Newline) },
        { ALT: () => this.SUBRULE(this.statement) },
      ]),
    );
    this.CONSUME(EOF);
  });
  readonly statement = this.RULE("statement", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.functionDeclaration) },
      { ALT: () => this.SUBRULE(this.conditional) },
      { ALT: () => this.SUBRULE(this.typeDeclaration) },
      { ALT: () => this.SUBRULE(this.listDeclaration) },
      { ALT: () => this.SUBRULE(this.importDeclaration) },
      {
        ALT: () => {
          this.CONSUME(T.Export);
          this.SUBRULE(this.statement);
        },
      },
      {
        GATE: () => this.LA(1).tokenType === T.Parameter,
        ALT: () => this.SUBRULE(this.decoratedFunction),
      },
      { ALT: () => this.SUBRULE(this.expression) },
    ]);
  });
  readonly functionDeclaration = this.RULE("functionDeclaration", () => {
    this.CONSUME(T.Fn);
    this.CONSUME(T.Identifier, { LABEL: "name" });
    this.MANY(() => this.CONSUME2(T.Identifier, { LABEL: "parameter" }));
    this.CONSUME(T.Colon);
    this.SUBRULE(this.body);
  });
  readonly body = this.RULE("body", () => {
    this.MANY(() => this.CONSUME(T.Newline));
    this.OR([
      {
        ALT: () => {
          this.CONSUME(T.Indent);
          this.AT_LEAST_ONE(() =>
            this.OR2([
              { ALT: () => this.CONSUME2(T.Newline) },
              { ALT: () => this.SUBRULE(this.statement) },
            ]),
          );
          this.CONSUME(T.Dedent);
        },
      },
      { ALT: () => this.SUBRULE2(this.statement) },
    ]);
  });
  readonly conditional = this.RULE("conditional", () => {
    this.CONSUME(T.If);
    this.SUBRULE(this.expression, { LABEL: "condition" });
    this.CONSUME(T.Colon);
    this.SUBRULE(this.body);
    this.MANY({
      GATE: () => this.elseAhead(),
      DEF: () => this.SUBRULE(this.elseBranch),
    });
  });
  readonly elseBranch = this.RULE("elseBranch", () => {
    this.MANY(() => this.CONSUME(T.Newline));
    this.CONSUME(T.Else);
    this.OPTION(() => {
      this.CONSUME(T.If);
      this.SUBRULE(this.expression, { LABEL: "condition" });
    });
    this.CONSUME(T.Colon);
    this.SUBRULE(this.body);
  });
  readonly decoratedFunction = this.RULE("decoratedFunction", () => {
    this.AT_LEAST_ONE(() => this.SUBRULE(this.decorator));
    this.OPTION(() => this.CONSUME(T.Export));
    this.SUBRULE(this.functionDeclaration);
  });
  readonly decorator = this.RULE("decorator", () => {
    this.CONSUME(T.Parameter);
    this.MANY(() => {
      this.CONSUME(T.Dot);
      this.CONSUME(T.Identifier);
    });
    this.MANY2({
      GATE: () =>
        this.startsArgument(this.LA(1)) && this.LA(1).tokenType !== T.Parameter,
      DEF: () => this.SUBRULE(this.notExpression, { LABEL: "argument" }),
    });
    this.AT_LEAST_ONE(() => this.CONSUME(T.Newline));
  });
  readonly typeDeclaration = this.RULE("typeDeclaration", () => {
    this.CONSUME(T.Type);
    this.CONSUME(T.Identifier, { LABEL: "name" });
    this.OPTION(() => {
      this.CONSUME(T.Is);
      this.SUBRULE(this.reference, { LABEL: "parent" });
    });
    this.CONSUME(T.Colon);
    this.OR([
      {
        GATE: () => this.indentAhead(),
        ALT: () => {
          this.MANY(() => this.CONSUME(T.Newline));
          this.CONSUME(T.Indent);
          this.AT_LEAST_ONE(() => this.SUBRULE(this.typeMember));
          this.CONSUME(T.Dedent);
        },
      },
      {
        ALT: () =>
          this.AT_LEAST_ONE2(() =>
            this.SUBRULE2(this.reference, { LABEL: "member" }),
          ),
      },
    ]);
  });
  readonly typeMember = this.RULE("typeMember", () => {
    this.SUBRULE(this.reference);
    this.OPTION(() => this.SUBRULE2(this.reference));
    this.AT_LEAST_ONE(() => this.CONSUME(T.Newline));
  });
  readonly listDeclaration = this.RULE("listDeclaration", () => {
    this.CONSUME(T.List);
    this.CONSUME(T.Identifier, { LABEL: "name" });
    this.CONSUME(T.Colon);
    this.OR([
      {
        GATE: () => this.indentAhead(),
        ALT: () => {
          this.MANY(() => this.CONSUME(T.Newline));
          this.CONSUME(T.Indent);
          this.SUBRULE(this.reference);
          this.MANY2(() => this.CONSUME2(T.Newline));
          this.CONSUME(T.Dedent);
        },
      },
      { ALT: () => this.SUBRULE2(this.reference) },
    ]);
  });
  readonly importDeclaration = this.RULE("importDeclaration", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(T.Import);
          this.CONSUME(T.StringLiteral);
          this.OPTION(() => {
            this.CONSUME(T.As);
            this.CONSUME(T.Identifier, { LABEL: "alias" });
          });
        },
      },
      {
        ALT: () => {
          this.CONSUME(T.From);
          this.CONSUME2(T.StringLiteral);
          this.CONSUME2(T.Import);
          this.OR2([
            {
              GATE: () => this.indentAhead(),
              ALT: () => {
                this.MANY(() => this.CONSUME(T.Newline));
                this.CONSUME(T.Indent);
                this.AT_LEAST_ONE(() =>
                  this.OR3([
                    { ALT: () => this.SUBRULE(this.importItem) },
                    { ALT: () => this.CONSUME2(T.Newline) },
                  ]),
                );
                this.CONSUME(T.Dedent);
              },
            },
            {
              ALT: () =>
                this.AT_LEAST_ONE2(() => this.SUBRULE2(this.importItem)),
            },
          ]);
        },
      },
    ]);
  });
  readonly importItem = this.RULE("importItem", () => {
    this.OR([
      { ALT: () => this.CONSUME(T.Identifier) },
      { ALT: () => this.CONSUME(T.Star) },
    ]);
    this.OPTION(() => {
      this.CONSUME(T.As);
      this.CONSUME2(T.Identifier, { LABEL: "alias" });
    });
  });
  readonly reference = this.RULE("reference", () => {
    this.CONSUME(T.Identifier);
    this.MANY(() => {
      this.CONSUME(T.Dot);
      this.CONSUME2(T.Identifier);
    });
  });
  readonly expression = this.RULE("expression", () => {
    this.OR([
      {
        GATE: () => this.assignmentAhead(),
        ALT: () => {
          this.SUBRULE(this.postfixExpression, { LABEL: "targetOrType" });
          this.OPTION(() =>
            this.SUBRULE2(this.postfixExpression, { LABEL: "target" }),
          );
          this.CONSUME(T.Assign);
          this.SUBRULE(this.expression, { LABEL: "value" });
        },
      },
      { ALT: () => this.SUBRULE(this.membershipExpression) },
    ]);
  });
  readonly membershipExpression = this.RULE("membershipExpression", () => {
    this.SUBRULE(this.pipelineExpression);
    this.MANY(() => {
      this.CONSUME(T.In);
      this.SUBRULE2(this.pipelineExpression);
    });
  });
  readonly pipelineExpression = this.RULE("pipelineExpression", () => {
    this.SUBRULE(this.logicalExpression);
    this.MANY(() => this.SUBRULE(this.flowTail));
  });
  readonly flowTail = this.RULE("flowTail", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(T.Arrow);
          this.OPTION(() => this.CONSUME(T.Star));
          this.SUBRULE(this.awaitExpression);
        },
      },
      {
        ALT: () => {
          this.CONSUME(T.FatArrow);
          this.SUBRULE(this.postfixExpression);
        },
      },
    ]);
  });
  readonly logicalExpression = this.RULE("logicalExpression", () => {
    this.SUBRULE(this.awaitExpression);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(T.And) },
        { ALT: () => this.CONSUME(T.Or) },
      ]);
      this.SUBRULE2(this.awaitExpression);
    });
  });
  readonly awaitExpression = this.RULE("awaitExpression", () => {
    this.OPTION(() =>
      this.OR([
        { ALT: () => this.CONSUME(T.Await) },
        { ALT: () => this.CONSUME(T.AwaitAll) },
      ]),
    );
    this.SUBRULE(this.callExpression);
  });
  readonly callExpression = this.RULE("callExpression", () => {
    this.SUBRULE(this.notExpression);
    this.MANY({
      GATE: () => this.startsArgument(this.LA(1)),
      DEF: () => this.SUBRULE2(this.notExpression, { LABEL: "argument" }),
    });
  });
  readonly notExpression = this.RULE("notExpression", () => {
    this.OPTION(() => this.CONSUME(T.Not));
    this.SUBRULE(this.comparisonExpression);
  });
  readonly comparisonExpression = this.RULE("comparisonExpression", () => {
    this.SUBRULE(this.additiveExpression);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(T.Equal) },
        { ALT: () => this.CONSUME(T.Greater) },
        { ALT: () => this.CONSUME(T.GreaterEqual) },
        { ALT: () => this.CONSUME(T.Less) },
        { ALT: () => this.CONSUME(T.LessEqual) },
      ]);
      this.SUBRULE2(this.additiveExpression);
    });
  });
  readonly additiveExpression = this.RULE("additiveExpression", () => {
    this.SUBRULE(this.multiplicativeExpression);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(T.Plus) },
        { ALT: () => this.CONSUME(T.Minus) },
      ]);
      this.SUBRULE2(this.multiplicativeExpression);
    });
  });
  readonly multiplicativeExpression = this.RULE(
    "multiplicativeExpression",
    () => {
      this.SUBRULE(this.powerExpression);
      this.MANY(() => {
        this.OR([
          { ALT: () => this.CONSUME(T.Star) },
          { ALT: () => this.CONSUME(T.Slash) },
          { ALT: () => this.CONSUME(T.Percent) },
        ]);
        this.SUBRULE2(this.powerExpression);
      });
    },
  );
  readonly powerExpression = this.RULE("powerExpression", () => {
    this.SUBRULE(this.rangeExpression);
    this.OPTION(() => {
      this.CONSUME(T.Power);
      this.SUBRULE(this.powerExpression);
    });
  });
  readonly rangeExpression = this.RULE("rangeExpression", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(T.By);
          this.SUBRULE(this.postfixExpression, { LABEL: "step" });
        },
      },
      {
        ALT: () => {
          this.OR2([
            {
              ALT: () => {
                this.CONSUME(T.Range);
                this.OPTION(() =>
                  this.SUBRULE2(this.postfixExpression, { LABEL: "end" }),
                );
              },
            },
            {
              ALT: () => {
                this.SUBRULE3(this.postfixExpression, { LABEL: "start" });
                this.OPTION2(() => {
                  this.CONSUME2(T.Range);
                  this.OPTION3(() =>
                    this.SUBRULE4(this.postfixExpression, { LABEL: "end" }),
                  );
                });
              },
            },
          ]);
          this.OPTION4(() => {
            this.CONSUME2(T.By);
            this.SUBRULE5(this.postfixExpression, { LABEL: "step" });
          });
        },
      },
    ]);
  });
  readonly postfixExpression = this.RULE("postfixExpression", () => {
    this.SUBRULE(this.primaryExpression);
    this.MANY(() => this.SUBRULE(this.postfixTail));
  });
  readonly postfixTail = this.RULE("postfixTail", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(T.Dot);
          this.CONSUME(T.Identifier);
        },
      },
      {
        ALT: () => {
          this.CONSUME(T.SliceStart);
          this.MANY(() => this.SUBRULE(this.notExpression, { LABEL: "index" }));
          this.CONSUME(T.RSquare);
        },
      },
      { ALT: () => this.SUBRULE(this.formattedString) },
    ]);
  });
  readonly primaryExpression = this.RULE("primaryExpression", () => {
    this.OR([
      { ALT: () => this.CONSUME(T.NumberLiteral) },
      { ALT: () => this.CONSUME(T.StringLiteral) },
      { ALT: () => this.CONSUME(T.Identifier) },
      { ALT: () => this.CONSUME(T.Parameter) },
      {
        ALT: () => {
          this.CONSUME(T.Pipe);
          this.CONSUME2(T.Identifier);
          this.CONSUME2(T.Pipe);
        },
      },
      {
        ALT: () => {
          this.CONSUME(T.Dot);
          this.SUBRULE(this.reference);
        },
      },
      {
        ALT: () => {
          this.CONSUME(T.LParen);
          this.OPTION(() => this.SUBRULE(this.expression));
          this.CONSUME(T.RParen);
        },
      },
      { ALT: () => this.SUBRULE(this.arrayLiteral) },
      { ALT: () => this.SUBRULE(this.setLiteral) },
      { ALT: () => this.SUBRULE(this.hashmapLiteral) },
    ]);
  });
  readonly arrayLiteral = this.RULE("arrayLiteral", () => {
    this.CONSUME(T.LSquare);
    this.MANY(() => this.SUBRULE(this.notExpression));
    this.CONSUME(T.RSquare);
  });
  readonly setLiteral = this.RULE("setLiteral", () => {
    this.CONSUME(T.LCurly);
    this.MANY(() => this.SUBRULE(this.notExpression));
    this.CONSUME(T.RCurly);
  });
  readonly hashmapLiteral = this.RULE("hashmapLiteral", () => {
    this.CONSUME(T.Hash);
    this.OR([
      {
        GATE: () => this.indentAhead(),
        ALT: () => this.SUBRULE(this.mapBlock),
      },
      {
        ALT: () => {
          this.MANY({
            GATE: () =>
              this.LA(1).tokenType === T.Identifier &&
              this.LA(2).tokenType === T.Colon,
            DEF: () => this.SUBRULE(this.mapEntry),
          });
          this.OPTION({
            GATE: () => this.indentAhead(),
            DEF: () => this.SUBRULE2(this.mapBlock),
          });
        },
      },
    ]);
  });
  readonly mapBlock = this.RULE("mapBlock", () => {
    this.MANY(() => this.CONSUME(T.Newline));
    this.CONSUME(T.Indent);
    this.AT_LEAST_ONE(() =>
      this.OR([
        { ALT: () => this.CONSUME2(T.Newline) },
        { ALT: () => this.SUBRULE(this.mapEntry) },
      ]),
    );
    this.CONSUME(T.Dedent);
  });
  readonly mapEntry = this.RULE("mapEntry", () => {
    this.CONSUME(T.Identifier);
    this.CONSUME(T.Colon);
    this.OR([
      {
        GATE: () => this.indentAhead(),
        ALT: () => this.SUBRULE(this.mapBlock),
      },
      { ALT: () => this.SUBRULE(this.rangeExpression) },
    ]);
  });
  readonly formattedString = this.RULE("formattedString", () => {
    this.CONSUME(T.FormatStart);
    this.MANY(() =>
      this.OR([
        { ALT: () => this.CONSUME(T.FormatText) },
        { ALT: () => this.SUBRULE(this.interpolation) },
      ]),
    );
    this.CONSUME(T.FormatEnd);
  });
  readonly interpolation = this.RULE("interpolation", () => {
    this.CONSUME(T.InterpolationStart);
    this.OPTION(() => this.SUBRULE(this.expression));
    this.CONSUME(T.InterpolationEnd);
  });
}
