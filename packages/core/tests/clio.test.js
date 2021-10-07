import { compile } from "../index.js";
import { dirname } from "path";
import { fileURLToPath } from "url";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));

const testStr = (name, src, expected, file = "<mem>", wrap = true) => {
  return test(name, () => {
    const { code } = compile(src, file, {
      sourceDir: null,
      rpcPrefix: "test",
    });
    expected = wrap
      ? "export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;" +
        expected +
        ";return clio.exports}" +
        `//# sourceMappingURL=${file}.js.map`
      : expected;
    expect(code).toBe(expected);
  });
};

const testFile = (name, expected, wrap = true) => {
  const file = `${__dirname}/clio/${name}.clio`;
  const src = readFileSync(file, { encoding: "utf-8" });
  return testStr(`${name}.clio`, src, expected, `${name}.clio`, wrap);
};

const shouldThrow = (name, src, err, file = "<mem>") => {
  return test(name, () => {
    expect(() =>
      compile(src, file, {
        sourceDir: null,
        config: {},
        rpcPrefix: "test",
      })
    ).toThrowError(new RegExp(err));
  });
};

testStr("Booleans", "(not true) == false", "((!(true))===false)");
testStr("Null", "null", "null");
testStr("Set", "{1 2 3}", "new Set([1,2,3])");
testStr("Set (Empty)", "{}", "new Set([])");
testStr("Range", "2..100", "range(2,100,null)");
testStr("Range (No End)", "2..", "range(2,Infinity,null)");
testStr("Range (No Start)", "..100", "range(0,100,null)");
testStr("Range (No Start No End)", "..", "range(0,Infinity,null)");
testStr("Range (Step)", "2..100 by 2", "range(2,100,2)");
testStr("Range (No End With Step)", "2.. by 2", "range(2,Infinity,2)");
testStr("Range (No Start With Step)", "..100 by 2", "range(0,100,2)");
testStr("Range (No Start No End With Step)", ".. by 2", "range(0,Infinity,2)");
testStr("Range (Step Only)", "by 2", "range(0,Infinity,2)");
testStr("Array", "[1 2 3]", "[1,2,3]");
testStr("Array (Indented)", "[\n  1 2 3\n]", "[1,2,3]");
testStr("Array (Empty)", "[]", "[]");
testStr("Array (Nested)", "[1 [2 3]]", "[1,[2,3]]");
testStr("Array (Range Item)", "[2..100]", "[range(2,100,null)]");
testStr("Array (Step Only Range Item)", "[by 2]", "[range(0,Infinity,2)]");
testStr(
  "Array (With Assignment)",
  "[(a -> double => b)]",
  "const b=double(a);[(b)]"
);
testStr("Slice", "arr[0..100]", "arr[range(0,100,null)]");
testStr("Math", "a * b + c / 2", "a*b+c/2");
testStr("Math (Indented)", "a *\n  b + c / 2", "a*b+c/2");
testStr("Math (Indented-before)", "a\n  * b + c / 2", "a*b+c/2");
testStr("Math (Power)", "a ** b", "a**b");
testStr(
  "Math (Multiline)",
  "(fib n - 1)\n   + (fib n - 2)",
  "(fib(n-1))+(fib(n-2))"
);
testStr("Call", "add a b c", "add(a,b,c)");
testStr("Call (Quick Fn)", `(@a + b) 2 3`, "((a)=>a+b)(2,3)");
testStr("Call (No Args)", "die ()", "die()");
testStr(
  "Call (Formatted String)",
  `print f"a + b is {a + b}"`,
  "print(f(`a + b is `,a+b))"
);
testStr(
  "Call (Wrapped Formatted String)",
  `print (f"a + b is {a + b}")`,
  "print((f(`a + b is `,a+b)))"
);
testStr(
  "Call (Formatted String Quick Fn)",
  `print (f"a + b is {@a + @b}")`,
  "print(((a,b)=>f(`a + b is `,a+b)))"
);
testStr(
  "Call (Formatted String Quick Fn Call)",
  `(f"a + b is {@a + @b}") a b`,
  "((a,b)=>f(`a + b is `,a+b))(a,b)"
);
testStr("Call (Complex)", "add a [b] c", "add(a,[b],c)");
testStr("Call (Parallel)", "|add| a b c", "add.parallel(a,b,c)");
testStr("Wrapped", "(a + b) * c", "(a+b)*c");
testStr("Quick FN", "filter (@it > 0)", "filter(((it)=>(it>0)))");
testStr("Pipe", "a -> double", "double(a)");
testStr("Pipe (w/args)", "a -> add 2", "add(a,2)");
testStr("Await", "await a", "(await a)");
testStr("Await all", "[await] [a]", "(await Promise.all([a]))");
testStr("Hashmap", "# key: value", "{key:value}");
testStr("Hashmap (Empty)", "(#)", "({})");
testStr(
  "Hashmap (As Arg)",
  `print arg # a: b c: d\ne f`,
  "print(arg,{a:b,c:d});e(f)"
);
testStr(
  "Hashmap (As Arg Returned)",
  `fn test:\n  add # title: title checked: false`,
  "const test=register(`test/<mem>/test`,()=>{return add({title:title,checked:false})})"
);
testStr(
  "Hashmap (Multiline)",
  "# key: value\n  key2: value2",
  "{key:value,key2:value2}"
);
testStr("Hashmap (Indented)", "#\n  key: value", "{key:value}");
testStr(
  "Hashmap (Indented Multikey)",
  `# app:
    version: "1.0.1"
    name: "My App"
  window:
    height: 100
    width: 300
    title: "Hello world!"
-> console.log`,
  "console.log({app:{version:`1.0.1`,name:`My App`},window:{height:100,width:300,title:`Hello world!`}})"
);
testStr(
  "Hashmap (Multi Indent)",
  "#\n  key: value key:\n    key: value",
  "{key:value,key:{key:value}}"
);
testStr("Hashmap (Multi Key)", "# one: 1 two: 2", "{one:1,two:2}");
testStr("Hashmap (Nested)", "# key:\n    key: value", "{key:{key:value}}");
testStr(
  "Hashmap Should End on Line Break",
  "# key: value\ndouble x",
  "{key:value};double(x)"
);
testStr("Comparison", "a < b", "(a<b)");
testStr("Comparison (Chained)", "a < b <= c", "(a<b)&&(b<=c)");
testStr("Logical", "a and b", "(a)&&(b)");
testStr("Logical (Chained)", "a and b or c", "(a)&&(b)||(c)");
testStr("Not", "not a", "!(a)");
testStr("Not (Complex)", "not a >= b", "!((a>=b))");
testStr("Not (Chained)", "not a > b and not b < c", "(!((a>b)))&&(!((b<c)))");
testStr(
  "Functions",
  "fn add a b:\n  a + b",
  "const add=register(`test/<mem>/add`,(a,b)=>{return a+b})"
);
testStr(
  "Functions (Infinite loop)",
  "fn loop:\n  loop ()",
  "const loop=register(`test/<mem>/loop`,()=>{let __recurse = true;__loop: while(__recurse) {__recurse = false;__recurse=true;continue __loop;}})"
);
testStr(
  "Functions (One line, Range)",
  `fn row: (x - 1) .. (x + 2) -> .toArray -> .filter (@it >= 0)`,
  "const row=register(`test/<mem>/row`,()=>{return range((x-1),(x+2),null).toArray().filter(((it)=>(it>=0)))})"
);
testStr(
  "Functions (Expression)",
  "fn add a b: a + b",
  "const add=register(`test/<mem>/add`,(a,b)=>{return a+b})"
);
testStr(
  "Functions (Return Assignment)",
  "fn add a b:\n  c = a + b",
  "const add=register(`test/<mem>/add`,(a,b)=>{const c=a+b;return c})"
);
testStr(
  "Functions (Return Flow Assignment)",
  "fn add a b:\n  a + b => c",
  "const add=register(`test/<mem>/add`,(a,b)=>{const c=a+b;return c})"
);
testStr(
  "Functions (Return Mixed Assignment)",
  "fn add a b:\n  c = a + b => sum -> mul 4",
  "const add=register(`test/<mem>/add`,(a,b)=>{const sum=a+b;const c=mul(sum,4);return c})"
);
testStr(
  "Functions (Async)",
  `fn test a b:
  await |add| a b`,
  "const test=register(`test/<mem>/test`,async(a,b)=>{return (await add.parallel(a,b))})"
);
testStr(
  "Functions (Nested Async)",
  `fn outer x:
  fn inner a b:
  await |add| a b`,
  "const outer=register(`test/<mem>/outer`,(x)=>{const inner=register(`test/<mem>/inner`,async(a,b)=>{return (await add.parallel(a,b))});return inner})"
);
testStr("Map", "a -> * double", "a.map(double)");
testStr(
  "Map (w/args)",
  "a -> * add 1",
  "a.map(($item, $index, $iterator)=>add($item,1,$index,$iterator))"
);
testStr(
  "Map (Assignment In Args)",
  "a -> * add (4 => x)",
  "const x=4;a.map(($item, $index, $iterator)=>add($item,(x),$index,$iterator))"
);
testStr("In", "2 in {1 2 3}", "includes(2,new Set([1,2,3]))");
testStr(
  "In (Wrapped)",
  "4 in ([1 2 3] -> * double)",
  "includes(4,([1,2,3].map(double)))"
);
testStr("In (Hash)", "key in # key: value", "includes(key,{key:value})");
testStr("Conditionals", "if a > b:\n  c", "if((a>b)){c}");
testStr(
  "Conditionals (If In)",
  "if key in # key: value: console.log true",
  "if(includes(key,{key:value})){console.log(true)}"
);
testStr("Conditionals (Value Term)", "if a:\n  c", "if(a){c}");
testStr(
  "Conditionals (if/else)",
  "if a > b:\n  c\nelse:\n  d",
  "if((a>b)){c}else{d}"
);
testStr(
  "Conditionals (if/else if)",
  "if a > b:\n  c\nelse if a == b:\n  d",
  "if((a>b)){c}else if((a===b)){d}"
);
testStr(
  "Conditionals (if/else if/else)",
  "if a > b:\n  c\nelse if a == b:\n  d\nelse:\n  x",
  "if((a>b)){c}else if((a===b)){d}else{x}"
);
testStr(
  "Conditionals (return)",
  "fn testStr a b:\n  if a > b:\n    c\n  else if a == b:\n    d\n  else:\n    x",
  "const testStr=register(`test/<mem>/testStr`,(a,b)=>{if((a>b)){return c}else if((a===b)){return d}else{return x}})"
);
testStr(
  "Quick Fn (return)",
  "fn add a:\n  (a + @b)",
  "const add=register(`test/<mem>/add`,(a)=>{return ((b)=>a+b)})"
);
testStr("Method Call", ".push b c", "b.push(c)");
testStr("Flow", "a -> double", "double(a)");
testStr("Flow (With call)", "add a b -> double", "double(add(a,b))");
testStr(
  "Flow (Assignment)",
  "2 + 2 => four -> double",
  "const four=2+2;double(four)"
);
testStr(
  "Flow (Property Assignment)",
  "2 + 2 => values.four -> double",
  "values.four=2+2;double(values.four)"
);
testStr("Flow (Quick Fn)", "a -> (@a > 2)", "((a)=>(a>2))(a)");
testStr("Flow (Map)", "[1 2 3] -> * double", "[1,2,3].map(double)");
testStr("Flow (Chain)", "a -> double -> print", "print(double(a))");
testStr("Flow (Chain Map)", "a -> * double -> print", "print(a.map(double))");
testStr(
  "Flow (Chain Maps)",
  "a -> * double -> * print",
  "a.map(double).map(print)"
);
testStr("Flow (Await)", "a -> await double", "(await double(a))");
testStr("Flow (Await With Args)", "a -> await add 2", "(await add(a,2))");
testStr(
  "Flow (Await All)",
  "a -> [await] double",
  "(await Promise.all(double(a)))"
);
testStr("Flow (Await Map)", "a -> * await double", "(await a.map(double))");
testStr(
  "Flow (Await All Map)",
  "a -> * [await] double",
  "(await Promise.all(a.map(double)))"
);
testStr(
  "Flow (Await Chain Map)",
  "a -> * await double -> await print",
  "(await print((await a.map(double))))"
);
testStr(
  "Flow (Awaited Arg)",
  "a -> * add (await x)",
  "a.map(async ($item, $index, $iterator)=>add($item,((await x)),$index,$iterator))"
);
testStr(
  "Flow (Await Chain Maps)",
  "a -> * await double -> * await print",
  "(await (await a.map(double)).map(print))"
);
testStr(
  "Flow (Await All Chain Map)",
  "a -> * [await] double -> [await] print",
  "(await Promise.all(print((await Promise.all(a.map(double))))))"
);
testStr(
  "Flow (Await Chain Maps)",
  "a -> * [await] double -> * [await] print",
  "(await Promise.all((await Promise.all(a.map(double))).map(print)))"
);
testStr("Flow (Parallel)", "a -> |double|", "double.parallel(a)");
testStr(
  "Flow (Parallel Map)",
  "[1 2 3] -> * |double|",
  "[1,2,3].map(double.parallel)"
);
testStr(
  "Flow (Parallel Chain)",
  "a -> |double| -> print",
  "print(double.parallel(a))"
);
testStr(
  "Flow (Parallel Chain Map)",
  "a -> * |double| -> print",
  "print(a.map(double.parallel))"
);
testStr(
  "Flow (Parallel Chain Maps)",
  "a -> * |double| -> * |print|",
  "a.map(double.parallel).map(print.parallel)"
);
testStr(
  "Flow (Parallel Await)",
  "a -> await |double|",
  "(await double.parallel(a))"
);
testStr(
  "Flow (Parallel Await All)",
  "a -> [await] |double|",
  "(await Promise.all(double.parallel(a)))"
);
testStr(
  "Flow (Parallel Await Map)",
  "a -> * await |double|",
  "(await a.map(double.parallel))"
);
testStr(
  "Flow (Parallel Await All Map)",
  "a -> * [await] |double|",
  "(await Promise.all(a.map(double.parallel)))"
);
testStr(
  "Flow (Parallel Await Chain Map)",
  "a -> * await |double| -> await print.parallel",
  "(await print.parallel((await a.map(double.parallel))))"
);
testStr(
  "Flow (Parallel Await Chain Maps)",
  "a -> * await |double| -> * await |print|",
  "(await (await a.map(double.parallel)).map(print.parallel))"
);
testStr(
  "Flow (Parallel Await All Chain Map)",
  "a -> * [await] |double| -> [await] |print|",
  "(await Promise.all(print.parallel((await Promise.all(a.map(double.parallel))))))"
);
testStr(
  "Flow (Parallel Await Chain Maps)",
  "a -> * [await] |double| -> * [await] |print|",
  "(await Promise.all((await Promise.all(a.map(double.parallel))).map(print.parallel)))"
);
testStr("Flow (Multiline)", "a -> double\n  -> print", "print(double(a))");
testStr("Flow (Methods)", "a -> .push b", "a.push(b)");
testStr(
  "Flow (Method Map)",
  "a -> * .toUpperCase",
  "a.map(((($item)=>{return $item.toUpperCase()})))"
);
testStr(
  "Flow (Method Map w/Args)",
  "a -> * .push b",
  "a.map(($item)=>$item.push(b))"
);
testStr("Assignment", `a = 2 + 2`, "const a=2+2");
testStr("Assignment (Fat Arrow)", `2 + 2 => a`, "const a=2+2;a");
testStr("Assignment (Fat Arrow Call)", `double a => b`, "const b=double(a);b");
testStr(
  "Export (Function)",
  `export fn test a b:\n  add a b`,
  "const test=register(`test/<mem>/test`,(a,b)=>{return add(a,b)});clio.exports.test=test"
);
testStr(
  "Export (Constant)",
  `export pi = 3.14`,
  "const pi=3.14;clio.exports.pi=pi"
);
testStr("Export (Symbol)", `export pi`, "clio.exports.pi=pi");
testStr(
  "Export (Typed Assignment)",
  `export Number pi = 3.14`,
  "const pi=3.14;clio.exports.pi=pi"
);
testStr(
  "Export (Type)",
  `export type Point: x y`,
  "const Point=class Point{constructor(x,y){this.x=x;this.y=y;} static get members(){return 2}};clio.exports.Point=Point"
);
testStr(
  "Export (List)",
  `export list Numbers: Number`,
  "const Numbers=[Number];clio.exports.Numbers=Numbers"
);
testStr("List (Indented)", `list Numbers:\n  Number`, "const Numbers=[Number]");
testStr(
  "Type (Typed)",
  `export type Point:\n  Number x\n  Number y`,
  "const Point=class Point{constructor(x,y){this.x=x;this.y=y;} static get members(){return 2}};clio.exports.Point=Point"
);
testStr(
  "Type (Indented)",
  `export type Point:\n  x\n  y`,
  "const Point=class Point{constructor(x,y){this.x=x;this.y=y;} static get members(){return 2}};clio.exports.Point=Point"
);
testStr(
  "Type (Extend)",
  `type Point: x y\nexport type Location is Point: name`,
  "const Point=class Point{constructor(x,y){this.x=x;this.y=y;} static get members(){return 2}};const Location=class Location extends Point{constructor(...$args){super(...$args.slice(0,Point.members));const [name]=$args.slice(Point.members);this.name=name;} static get members(){return Point.members+1}};clio.exports.Location=Location"
);
testStr(
  "Decorators",
  `@silent\nfn print x: console.log(x)`,
  "const print=silent(((x)=>{return console.log((x))}))"
);
testStr(
  "Decorators (Exported)",
  `@silent\nexport fn print x: console.log(x)`,
  "const print=silent(((x)=>{return console.log((x))}));clio.exports.print=print"
);
testStr(
  "Decorators (Args)",
  `@silent true\nfn print x: console.log(x)`,
  "const print=silent(true,((x)=>{return console.log((x))}))"
);
testStr(
  "Decorators (Multiple)",
  `@route "/"\n@silent\nfn print x: console.log(x)`,
  "const print=route(`/`,silent(((x)=>{return console.log((x))})))"
);
testStr(
  "Decorators (Multiple + Exported)",
  `@route "/"\n@silent\nexport fn print x: console.log(x)`,
  "const print=route(`/`,silent(((x)=>{return console.log((x))})));clio.exports.print=print"
);
testStr(
  "Decorators (Multiple + Exported)",
  `@silent\n@route "/"\nexport fn print x: console.log(x)`,
  "const print=silent(route(`/`,((x)=>{return console.log((x))})));clio.exports.print=print"
);
testStr(
  "Decorators (Property + Multiple + Exported)",
  `@foo.bar\n@silent\n@route "/"\nexport fn print x: console.log(x)`,
  "const print=foo.bar(silent(route(`/`,((x)=>{return console.log((x))}))));clio.exports.print=print"
);
testStr(
  "Decorators (Args + Exported)",
  `@silent true\nexport fn print x: console.log(x)`,
  "const print=silent(true,((x)=>{return console.log((x))}));clio.exports.print=print"
);
testStr(
  "Import",
  `import "test"`,
  `import defaultTest from "test.clio.js";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const test=await defaultTest(clio);return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import All As",
  `from "test" import * as foo`,
  `import defaultTest from "test.clio.js";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const foo=await defaultTest(clio);return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import All As + Destruct",
  `from "test" import xyz as abc * as foo`,
  `import defaultTest from "test.clio.js";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const{xyz:abc,...foo}=await defaultTest(clio);return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import (Remote)",
  `import "ws:test"`,
  `const test=await remote(clio,"ws://test")`
);
testStr(
  "Import All As (Remote)",
  `from "ws:test" import * as foo`,
  `const foo=await remote(clio,"ws://test")`
);
testStr(
  "Import From (Remote)",
  `from "ws:test" import abc`,
  `const{abc}=await remote(clio,"ws://test")`
);
testStr(
  "Import As From (Remote)",
  `from "ws:test" import abc as xyz`,
  `const{abc:xyz}=await remote(clio,"ws://test")`
);
testStr(
  "Import (CJS)",
  `import "cjs:test"`,
  `import test from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import All As (CJS)",
  `from "cjs:test" import * as foo`,
  `import defaultTest from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const foo=defaultTest;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import From (CJS)",
  `from "cjs:test" import abc`,
  `import defaultTest from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const{abc}=defaultTest;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import As From (CJS)",
  `from "cjs:test" import abc as xyz`,
  `import defaultTest from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const{abc:xyz}=defaultTest;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import (ESM)",
  `import "esm:test"`,
  `import test from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import All As (ESM)",
  `from "esm:test" import * as foo`,
  `import * as foo from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import From (ESM)",
  `from "esm:test" import abc`,
  `import{abc}from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import As From (ESM)",
  `from "esm:test" import abc as xyz`,
  `import{abc as xyz}from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import (Multiple)",
  `from "sub/test" import a b c`,
  `import defaultTest from "sub/test.clio.js";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const{a,b,c}=await defaultTest(clio);return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import (Subdir)",
  `import "sub/test.clio"`,
  `import defaultTest from "sub/test.clio.js";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const test=await defaultTest(clio);return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import (As)",
  `from "cjs:test" import a as b`,
  `import defaultTest from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const{a:b}=defaultTest;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import (All as)",
  `import "cjs:test" as b`,
  `import defaultTest from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const b=defaultTest;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import (All as alternate)",
  `from "cjs:test" import * as b`,
  `import defaultTest from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const b=defaultTest;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import As (Indented)",
  `from "./greetings" import
      bye
      hello`,
  `import defaultGreetings from "./greetings.clio.js";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const{bye,hello}=await defaultGreetings(clio);return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Import (Complex)",
  `from "cjs:test" import a b c as d * as t`,
  `import defaultTest from "test";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const{a,b,c:d,...t}=defaultTest;return clio.exports}//# sourceMappingURL=<mem>.js.map`,
  "<mem>",
  false
);
testStr(
  "Deeply Nested",
  "add a b -> mul (k -> mul (add 2 (2 + 3)) q)",
  "mul(add(a,b),(mul(k,(add(2,(2+3))),q)))"
);
testStr("Formatted String", `f"test {a -> double}"`, "f(`test `,double(a))");
testStr("Formatted String (Single)", `f"a is {a}"`, "f(`a is `,a)");
testStr("Formatted String (Empty)", `f"a is {}"`, "f(`a is `,null)");
testStr(
  "Formatted String (Escape)",
  `f"test \n \\{a -> double}"`,
  "f(`test \n `,`{`,`a -> double}`)"
);
testStr("Correctly compiles groups", `await filter [a]`, "(await filter([a]))");
testStr(
  "Ignore \\r",
  "fn add a b:\r\n  a + b",
  "const add=register(`test/<mem>/add`,(a,b)=>{return a+b})"
);
testStr(
  "Ignore \\n at start and end of file",
  "\nfn add a b:\r\n  a + b\n",
  "const add=register(`test/<mem>/add`,(a,b)=>{return a+b})"
);
testStr(
  "Ignore indents on comment lines",
  `export fn main argv:
  5 -> console.log
-- D between code-lines
  "Hello" -> console.log`,
  "const main=register(`test/<mem>/main`,(argv)=>{console.log(5);return console.log(`Hello`)});clio.exports.main=main"
);
testFile(
  "fib",
  "const fib=register(`test/fib.clio/fib`,(n)=>{if((n<=2)){return n}else{return (fib(n-1))+(fib(n-2))}})"
);
testFile(
  "fib.parallel",
  "const fib=register(`test/fib.parallel.clio/fib`,(n)=>{if((n<2)){return n}else{return (fib(n-1))+(fib(n-2))}});const main=register(`test/fib.parallel.clio/main`,async(argv)=>{return (await Promise.all([39,40,41,42].map(fib.parallel))).map(((it)=>console.log(it)))});clio.exports.main=main"
);
testFile(
  "fizzbuzz",
  "const fizzbuzz=register(`test/fizzbuzz.clio/fizzbuzz`,(current,last)=>{let __current,__last;let __recurse = true;__fizzbuzz: while(__recurse) {__recurse = false;const buzz=!(current%5);const fizz=!(current%3);if((fizz)&&(buzz)){console.log(`Fizz Buzz`)}else if(fizz){console.log(`Fizz`)}else if(buzz){console.log(`Buzz`)}else{console.log(current)};if(!((current===last))){__current=(current+1);__last=last;current=__current;last=__last;__recurse=true;continue __fizzbuzz;}}})"
);
testFile(
  "express",
  'import express from "express";export default async(clio)=>{const{emitter,range,slice,remote,register,help,describe,returns,check,params,includes,f,Any}=clio;const hello=register(`test/express.clio/hello`,(req,res)=>{return res.send(`Hello world`)});const setup=register(`test/express.clio/setup`,(app)=>{app.get(`/`,hello);return app.listen(3000)});const main=register(`test/express.clio/main`,(argv)=>{const setup=express();return setup});clio.exports.main=main;return clio.exports}//# sourceMappingURL=express.clio.js.map',
  false
);
testFile(
  "hello",
  "const main=register(`test/hello.clio/main`,(argv)=>{return [`game`,`web`,`tools`,`science`,`systems`,`GUI`,`mobile`].map(((area)=>console.log(f(`Hello, `,area,` developers!`))))})"
);
testFile(
  "persons",
  "const person=register(`test/persons.clio/person`,(name,age)=>{return {name:name,age:age}});const people=[(person(`John`,45)),(person(`Kate`,30))];persons.map(((person)=>f(person.name,` is `,person.age,` years old`))).map(print)"
);
shouldThrow(
  "Inconsistent indentation",
  "if a:\n   x\n y",
  "Inconsistent indentation"
);
shouldThrow("Imbalanced curly braces", "}{}}", "Imbalanced curly braces");
shouldThrow("Imbalanced square braces", "][]]", "Imbalanced square braces");
shouldThrow("Imbalanced parentheses", ")())", "Imbalanced parentheses");
shouldThrow("Unsupported character", "!", "Unsupported character !");
shouldThrow("Calling an integer", "xyz -> 123", "but encountered .*Number");
