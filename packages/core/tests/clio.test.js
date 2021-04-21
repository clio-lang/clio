const { compile } = require("../index");
const fs = require("fs");

const testStr = (name, src, expected, file = "<mem>") => {
  return test(name, () => {
    const { code } = compile(src, file);
    expected =
      "module.exports.exports=async(clio)=>{const{tco,range,man,inCheck,slice,f,distributed}=clio;" +
      expected +
      ";return clio.exports}";
    expect(code).toBe(expected);
  });
};

const testFile = (name, expected) => {
  const file = `${__dirname}/clio/${name}.clio`;
  const src = fs.readFileSync(file, { encoding: "utf-8" });
  return testStr(`${name}.clio`, src, expected, `${name}.clio`);
};

const shouldThrow = (name, src, err, file = "<mem>") => {
  return test(name, () => {
    expect(() => compile(src, file)).toThrow(err);
  });
};

testStr("Booleans", "(not true) == false", "((!(true))==false)");
testStr("Null", "null", "null");
testStr("Set", "{1 2 3}", "new Set([1,2,3])");
testStr("Set (Empty)", "{}", "new Set([])");
testStr("Range", "2..100", "range(2,100,null)");
testStr("Range (No End)", "2..", "range(2,Inf,null)");
testStr("Range (No Start)", "..100", "range(0,100,null)");
testStr("Range (No Start No End)", "..", "range(0,Inf,null)");
testStr("Range (Step)", "2..100 by 2", "range(2,100,2)");
testStr("Range (No End With Step)", "2.. by 2", "range(2,Inf,2)");
testStr("Range (No Start With Step)", "..100 by 2", "range(0,100,2)");
testStr("Range (No Start No End With Step)", ".. by 2", "range(0,Inf,2)");
testStr("Range (Step Only)", "by 2", "range(0,Inf,2)");
testStr("Array", "[1 2 3]", "[1,2,3]");
testStr("Array (Indented)", "[\n  1 2 3\n]", "[1,2,3]");
testStr("Array (Empty)", "[]", "[]");
testStr("Array (Nested)", "[1 [2 3]]", "[1,[2,3]]");
testStr("Array (Range Item)", "[2..100]", "[range(2,100,null)]");
testStr("Array (Step Only Range Item)", "[by 2]", "[range(0,Inf,2)]");
testStr(
  "Array (With Assignment)",
  "[(a -> double => b)]",
  "const b=double(a);[(b)]"
);
testStr("Slice", "arr[0..100]", "slice(arr,[range(0,100,null)])");
testStr("Math", "a * b + c / 2", "a*b+c/2");
testStr("Math (Indented)", "a *\n  b + c / 2", "a*b+c/2");
testStr("Math (Power)", "a ** b", "a**b");
testStr(
  "Math (Multiline)",
  "(fib n - 1)\n   + (fib n - 2)",
  "(fib(n-1))+(fib(n-2))"
);
testStr("Call", "add a b c", "add(a,b,c)");
testStr("Call (Quick Fn)", `(@a + b) 2 3`, "((a)=>(a+b))(2,3)");
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
  "print(((a,b)=>(f(`a + b is `,a+b))))"
);
testStr(
  "Call (Formatted String Quick Fn Call)",
  `(f"a + b is {@a + @b}") a b`,
  "((a,b)=>(f(`a + b is `,a+b)))(a,b)"
);
testStr("Call (Complex)", "add a [b] c", "add(a,[b],c)");
testStr("Call (Parallel)", "|add| a b c", "add.parallel(a,b,c)");
testStr("Wrapped", "(a + b) * c", "(a+b)*c");
testStr("Quick FN", "filter @it > 0", "filter(((it)=>(it>0)))");
testStr("Pipe", "a -> double", "double(a)");
testStr("Pipe (w/args)", "a -> add 2", "add(a,2)");
testStr("Await", "await a", "(await a)");
testStr("Await all", "[await] [a]", "(await Promise.all([a]))");
testStr("Hashmap", "# key value", "{key:value}");
testStr(
  "Hashmap (Multiline)",
  "# key value\n  key2 value2",
  "{key:value,key2:value2}"
);
testStr("Hashmap (Indented)", "#\n  key value", "{key:value}");
testStr(
  "Hashmap (Multi Indent)",
  "#\n  key value key\n    key value",
  "{key:value,key:{key:value}}"
);
testStr("Hashmap (Multi Key)", "# one 1 two 2", "{one:1,two:2}");
testStr("Hashmap (Nested)", "# key\n  key value", "{key:{key:value}}");
testStr(
  "Hashmap Should End on Line Break",
  "# key value\ndouble x",
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
  "const add=tco((a,b)=>{return a+b});distributed.set(`<mem>/add`,add);add.parallel=distributed.get(`<mem>/add`)"
);
testStr(
  "Functions (With Man)",
  "-- Adds a and b!\nfn add a b:\n  a + b",
  "const add=tco((a,b)=>{return a+b});add.__man__=`-- Adds a and b!`;distributed.set(`<mem>/add`,add);add.parallel=distributed.get(`<mem>/add`)"
);
testStr(
  "Functions (With Block Man)",
  "+- Adds a and b!-+\nfn add a b:\n  a + b",
  "const add=tco((a,b)=>{return a+b});add.__man__=`+- Adds a and b!-+`;distributed.set(`<mem>/add`,add);add.parallel=distributed.get(`<mem>/add`)"
);
testStr(
  "Functions (With Nested Block Man)",
  "+- Adds +- a -+ and b!-+\nfn add a b:\n  a + b",
  "const add=tco((a,b)=>{return a+b});add.__man__=`+- Adds +- a -+ and b!-+`;distributed.set(`<mem>/add`,add);add.parallel=distributed.get(`<mem>/add`)"
);
testStr(
  "Functions (Expression)",
  "fn add a b: a + b",
  "const add=tco((a,b)=>{return a+b});distributed.set(`<mem>/add`,add);add.parallel=distributed.get(`<mem>/add`)"
);
testStr(
  "Functions (Return Assignment)",
  "fn add a b:\n  c = a + b",
  "const add=tco((a,b)=>{const c=a+b;return c});distributed.set(`<mem>/add`,add);add.parallel=distributed.get(`<mem>/add`)"
);
testStr(
  "Functions (Return Flow Assignment)",
  "fn add a b:\n  a + b => c",
  "const add=tco((a,b)=>{const c=a+b;return c});distributed.set(`<mem>/add`,add);add.parallel=distributed.get(`<mem>/add`)"
);
testStr(
  "Functions (Return Mixed Assignment)",
  "fn add a b:\n  c = a + b => sum -> mul 4",
  "const add=tco((a,b)=>{const sum=a+b;const c=mul(sum,4);return c});distributed.set(`<mem>/add`,add);add.parallel=distributed.get(`<mem>/add`)"
);
testStr(
  "Functions (Async)",
  `fn test a b:
  await |add| a b`,
  "const test=tco(async(a,b)=>{return (await add.parallel(a,b))});distributed.set(`<mem>/test`,test);test.parallel=distributed.get(`<mem>/test`)"
);
testStr(
  "Functions (Nested Async)",
  `fn outer x:
  fn inner a b:
  await |add| a b`,
  "const outer=tco((x)=>{const inner=tco(async(a,b)=>{return (await add.parallel(a,b))});distributed.set(`<mem>/inner`,inner);inner.parallel=distributed.get(`<mem>/inner`);return inner});distributed.set(`<mem>/outer`,outer);outer.parallel=distributed.get(`<mem>/outer`)"
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
testStr("In", "2 in {1 2 3}", "inCheck(2,new Set([1,2,3]))");
testStr(
  "In (Wrapped)",
  "4 in ([1 2 3] -> * double)",
  "inCheck(4,([1,2,3].map(double)))"
);
testStr("In (Hash)", "key in # key value", "inCheck(key,{key:value})");
testStr("Conditionals", "if a > b:\n  c", "if((a>b)){c}");
testStr(
  "Conditionals (If In)",
  "if key in # key value: console.log true",
  "if(inCheck(key,{key:value})){console.log(true)}"
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
  "if((a>b)){c}else if((a==b)){d}"
);
testStr(
  "Conditionals (if/else if/else)",
  "if a > b:\n  c\nelse if a == b:\n  d\nelse:\n  x",
  "if((a>b)){c}else if((a==b)){d}else{x}"
);
testStr(
  "Conditionals (return)",
  "fn testStr a b:\n  if a > b:\n    c\n  else if a == b:\n    d\n  else:\n    x",
  "const testStr=tco((a,b)=>{if((a>b)){return c}else if((a==b)){return d}else{return x}});distributed.set(`<mem>/testStr`,testStr);testStr.parallel=distributed.get(`<mem>/testStr`)"
);
testStr(
  "Quick Fn (return)",
  "fn add a:\n  a + @b",
  "const add=tco((a)=>{return ((b)=>a+b)});distributed.set(`<mem>/add`,add);add.parallel=distributed.get(`<mem>/add`)"
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
testStr("Flow (Quick Fn)", "a -> (@a > 2)", "((a)=>((a>2)))(a)");
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
  "a.map((tco(($item)=>{return $item.toUpperCase()})))"
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
  "const test=tco((a,b)=>{return add(a,b)});distributed.set(`<mem>/test`,test);test.parallel=distributed.get(`<mem>/test`);clio.exports.test=test"
);
testStr(
  "Export (Function With Man)",
  `-- Adds a and b!\nexport fn test a b:\n  add a b`,
  "const test=tco((a,b)=>{return add(a,b)});test.__man__=`-- Adds a and b!`;distributed.set(`<mem>/test`,test);test.parallel=distributed.get(`<mem>/test`);clio.exports.test=test"
);
testStr(
  "Export (Constant)",
  `export pi = 3.14`,
  "const pi=3.14;clio.exports.pi=pi"
);
testStr(
  "Import",
  `import "test"`,
  `const test=await require("test.clio.js").exports(clio)`
);
testStr("Import (JS)", `import "js:test"`, `const test=require("test")`);
testStr(
  "Import (Multiple)",
  `import a b c from "sub/test"`,
  `const{a,b,c}=await require("sub/test.clio.js").exports(clio)`
);
testStr(
  "Import (Subdir)",
  `import "sub/test.clio"`,
  `const test=await require("sub/test.clio.js").exports(clio)`
);
testStr(
  "Import (As)",
  `import a as b from "js:test"`,
  `const{a:b}=require("test")`
);
testStr(
  "Import (All as)",
  `import * as b from "js:test"`,
  `const{...b}=require("test")`
);
testStr(
  "Import (Complex)",
  `import a b c as d * as t from "js:test"`,
  `const{a,b,c:d,...t}=require("test")`
);
testStr(
  "Deeply Nested",
  "add a b -> mul (k -> mul (add 2 (2 + 3)) q)",
  "mul(add(a,b),(mul(k,(add(2,(2+3))),q)))"
);
testStr("Formatted String", `f"test {a -> double}"`, "f(`test `,double(a))");
testStr("Formatted String (Single)", `f"a is {a}"`, "f(`a is `,a)");
testStr("Formatted String (Empty)", `f"a is {}"`, "f(`a is `,undefined)");
testStr(
  "Formatted String (Escape)",
  `f"test \n \\{a -> double}"`,
  "f(`test \n `,`{`,`a -> double}`)"
);
testStr(
  "Ignore \\r",
  "fn add a b:\r\n  a + b",
  "const add=tco((a,b)=>{return a+b});distributed.set(`<mem>/add`,add);add.parallel=distributed.get(`<mem>/add`)"
);
testStr(
  "Ignore \\n at start and end of file",
  "\nfn add a b:\r\n  a + b\n",
  "const add=tco((a,b)=>{return a+b});distributed.set(`<mem>/add`,add);add.parallel=distributed.get(`<mem>/add`)"
);
testFile(
  "fib",
  "const fib=tco((n)=>{if((n<=2)){return n}else{return (fib(n-1))+(fib(n-2))}});distributed.set(`fib.clio/fib`,fib);fib.parallel=distributed.get(`fib.clio/fib`)"
);
testFile(
  "fib.parallel",
  "const fib=tco((n)=>{if((n<2)){return n}else{return (fib(n-1))+(fib(n-2))}});distributed.set(`fib.parallel.clio/fib`,fib);fib.parallel=distributed.get(`fib.parallel.clio/fib`);const main=tco(async(argv)=>{return (await Promise.all([39,40,41,42].map(fib.parallel))).map(((it)=>(console.log(it))))});distributed.set(`fib.parallel.clio/main`,main);main.parallel=distributed.get(`fib.parallel.clio/main`);clio.exports.main=main"
);
testFile(
  "fizzbuzz",
  "const fizzbuzz=tco((current,last)=>{const buzz=!(current%5);const fizz=!(current%3);if((fizz)&&(buzz)){console.log(`Fizz Buzz`)}else if(fizz){console.log(`Fizz`)}else if(buzz){console.log(`Buzz`)}else{console.log(current)};if(!((current==last))){return fizzbuzz((current+1),last)}});distributed.set(`fizzbuzz.clio/fizzbuzz`,fizzbuzz);fizzbuzz.parallel=distributed.get(`fizzbuzz.clio/fizzbuzz`)"
);
testFile(
  "express",
  'const express=await require("express.clio.js").exports(clio);const hello=tco((req,res)=>{return res.send(`Hello world`)});distributed.set(`express.clio/hello`,hello);hello.parallel=distributed.get(`express.clio/hello`);const setup=tco((app)=>{app.get(`/`,hello);return app.listen(3000)});distributed.set(`express.clio/setup`,setup);setup.parallel=distributed.get(`express.clio/setup`);const main=tco((argv)=>{const setup=express();return setup});distributed.set(`express.clio/main`,main);main.parallel=distributed.get(`express.clio/main`);clio.exports.main=main'
);
testFile(
  "hello",
  "const main=tco((argv)=>{return [`game`,`web`,`tools`,`science`,`systems`,`GUI`,`mobile`].map(((area)=>(console.log(f(`Hello, `,area,` developers!`)))))});distributed.set(`hello.clio/main`,main);main.parallel=distributed.get(`hello.clio/main`)"
);
testFile(
  "persons",
  "const person=tco((name,age)=>{return {name:name,age:age}});distributed.set(`persons.clio/person`,person);person.parallel=distributed.get(`persons.clio/person`);const people=[(person(`John`,45)),(person(`Kate`,30))];persons.map(((person)=>(f(person.name,` is `,person.age,` years old`)))).map(print)"
);
shouldThrow(
  "Unbalanced comment blocks",
  "+- +- -+ +-",
  "Unbalanced comment blocks"
);
shouldThrow(
  "Inconsistent indentation",
  "if a:\n   x\n y",
  "Inconsistent indentation"
);
shouldThrow("Unbalanced curly braces", "}{}}", "Unbalanced curly braces");
shouldThrow("Unbalanced square braces", "][]]", "Unbalanced square braces");
shouldThrow("Unbalanced parentheses", ")())", "Unbalanced parentheses");
shouldThrow("Unsupported character", "!", "Unsupported character !");
