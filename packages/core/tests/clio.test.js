const { compile } = require("../index");
const fs = require("fs");

const testStr = (name, src, expected, file = "<mem>") => {
  return test(name, () => {
    const { code } = compile(src, file);
    expected =
      "module.exports.exports=async(clio)=>{const{emitter,channel,range,slice,remote,register,man,includes,f}=clio;" +
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
  "const add=register(`<mem>/add`,(a,b)=>{return a+b})"
);
testStr(
  "Functions (With Man)",
  "-- Adds a and b!\nfn add a b:\n  a + b",
  "const add=register(`<mem>/add`,(a,b)=>{return a+b});add.__man__=`-- Adds a and b!`"
);
testStr(
  "Functions (With Block Man)",
  "+- Adds a and b!-+\nfn add a b:\n  a + b",
  "const add=register(`<mem>/add`,(a,b)=>{return a+b});add.__man__=`+- Adds a and b!-+`"
);
testStr(
  "Functions (With Nested Block Man)",
  "+- Adds +- a -+ and b!-+\nfn add a b:\n  a + b",
  "const add=register(`<mem>/add`,(a,b)=>{return a+b});add.__man__=`+- Adds +- a -+ and b!-+`"
);
testStr(
  "Functions (Expression)",
  "fn add a b: a + b",
  "const add=register(`<mem>/add`,(a,b)=>{return a+b})"
);
testStr(
  "Functions (Return Assignment)",
  "fn add a b:\n  c = a + b",
  "const add=register(`<mem>/add`,(a,b)=>{const c=a+b;return c})"
);
testStr(
  "Functions (Return Flow Assignment)",
  "fn add a b:\n  a + b => c",
  "const add=register(`<mem>/add`,(a,b)=>{const c=a+b;return c})"
);
testStr(
  "Functions (Return Mixed Assignment)",
  "fn add a b:\n  c = a + b => sum -> mul 4",
  "const add=register(`<mem>/add`,(a,b)=>{const sum=a+b;const c=mul(sum,4);return c})"
);
testStr(
  "Functions (Async)",
  `fn test a b:
  await |add| a b`,
  "const test=register(`<mem>/test`,async(a,b)=>{return (await add.parallel(a,b))})"
);
testStr(
  "Functions (Nested Async)",
  `fn outer x:
  fn inner a b:
  await |add| a b`,
  "const outer=register(`<mem>/outer`,(x)=>{const inner=register(`<mem>/inner`,async(a,b)=>{return (await add.parallel(a,b))});return inner})"
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
testStr("In (Hash)", "key in # key value", "includes(key,{key:value})");
testStr("Conditionals", "if a > b:\n  c", "if((a>b)){c}");
testStr(
  "Conditionals (If In)",
  "if key in # key value: console.log true",
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
  "const testStr=register(`<mem>/testStr`,(a,b)=>{if((a>b)){return c}else if((a==b)){return d}else{return x}})"
);
testStr(
  "Quick Fn (return)",
  "fn add a:\n  a + @b",
  "const add=register(`<mem>/add`,(a)=>{return ((b)=>a+b)})"
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
  "const test=register(`<mem>/test`,(a,b)=>{return add(a,b)});clio.exports.test=test"
);
testStr(
  "Export (Function With Man)",
  `-- Adds a and b!\nexport fn test a b:\n  add a b`,
  "const test=register(`<mem>/test`,(a,b)=>{return add(a,b)});test.__man__=`-- Adds a and b!`;clio.exports.test=test"
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
testStr("Correctly compiles groups", `await filter [a]`, "(await filter([a]))");
testStr(
  "Ignore \\r",
  "fn add a b:\r\n  a + b",
  "const add=register(`<mem>/add`,(a,b)=>{return a+b})"
);
testStr(
  "Ignore \\n at start and end of file",
  "\nfn add a b:\r\n  a + b\n",
  "const add=register(`<mem>/add`,(a,b)=>{return a+b})"
);
testFile(
  "fib",
  "const fib=register(`fib.clio/fib`,(n)=>{if((n<=2)){return n}else{return (fib(n-1))+(fib(n-2))}})"
);
testFile(
  "fib.parallel",
  "const fib=register(`fib.parallel.clio/fib`,(n)=>{if((n<2)){return n}else{return (fib(n-1))+(fib(n-2))}});const main=register(`fib.parallel.clio/main`,async(argv)=>{return (await Promise.all([39,40,41,42].map(fib.parallel))).map(((it)=>(console.log(it))))});clio.exports.main=main"
);
testFile(
  "fizzbuzz",
  "const fizzbuzz=register(`fizzbuzz.clio/fizzbuzz`,(current,last)=>{const buzz=!(current%5);const fizz=!(current%3);if((fizz)&&(buzz)){console.log(`Fizz Buzz`)}else if(fizz){console.log(`Fizz`)}else if(buzz){console.log(`Buzz`)}else{console.log(current)};if(!((current==last))){return fizzbuzz((current+1),last)}})"
);
testFile(
  "express",
  'const express=await require("express.clio.js").exports(clio);const hello=register(`express.clio/hello`,(req,res)=>{return res.send(`Hello world`)});const setup=register(`express.clio/setup`,(app)=>{app.get(`/`,hello);return app.listen(3000)});const main=register(`express.clio/main`,(argv)=>{const setup=express();return setup});clio.exports.main=main'
);
testFile(
  "hello",
  "const main=register(`hello.clio/main`,(argv)=>{return [`game`,`web`,`tools`,`science`,`systems`,`GUI`,`mobile`].map(((area)=>(console.log(f(`Hello, `,area,` developers!`)))))})"
);
testFile(
  "persons",
  "const person=register(`persons.clio/person`,(name,age)=>{return {name:name,age:age}});const people=[(person(`John`,45)),(person(`Kate`,30))];persons.map(((person)=>(f(person.name,` is `,person.age,` years old`)))).map(print)"
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
