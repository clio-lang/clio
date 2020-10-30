module.exports.__clioModule = async clio => {
const { distributed } = clio;
const double = (n) => {return (n * 2)};
distributed.set("./clio/wrapped.clio/double", double);
double.parallel = distributed.get("./clio/wrapped.clio/double");
const foo = (n) => {return (n * ((10 - 1)))};
distributed.set("./clio/wrapped.clio/foo", foo);
foo.parallel = distributed.get("./clio/wrapped.clio/foo");
const main = (argv) => {return { eight: ((double(2)) + 4), nine: (5 + (double(2))), twentySeven: (((1 + 2)) * ((4 + 5))), ninety: foo(10) }};
distributed.set("./clio/wrapped.clio/main", main);
main.parallel = distributed.get("./clio/wrapped.clio/main");
exports.main = main;
return exports }