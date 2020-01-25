const chalk = require("chalk");
const { trace, error, warn, success, info, brightRed } = require("../colors");

describe("Colored messages", () => {
  const defaultConsoleError = console.error;
  const defaultConsoleTrace = console.trace;
  const defaultConsoleWarn = console.warn;
  const defaultConsoleLog = console.log;
  const defaultProcessExit = process.exit;

  beforeEach(() => {
    console.error = jest.fn();
    console.trace = jest.fn();
    console.warn = jest.fn();
    console.log = jest.fn();
    process.exit = jest.fn();
  });

  afterEach(() => {
    console.error = defaultConsoleError;
    console.trace = defaultConsoleTrace;
    console.warn = defaultConsoleWarn;
    console.log = defaultConsoleLog;
    process.exit = defaultProcessExit;
  });

  test("trace", () => {
    const error = new Error("Testing trace");
    trace(error);

    expect(console.trace).toHaveBeenCalledWith(
      brightRed("Error: Testing trace")
    );
  });

  test("error", () => {
    const err = new Error("Testing error");
    error(err);

    expect(console.error).toHaveBeenCalledWith(
      brightRed("Error: Testing error")
    );
    expect(process.exit).toHaveBeenCalled();
  });

  test("error with prefix", () => {
    const err = new Error("Testing error");
    error(err, "Foo");

    expect(console.error).toHaveBeenCalledWith(
      brightRed("Foo Error: Testing error")
    );
    expect(process.exit).toHaveBeenCalled();
  });

  test("warn", () => {
    warn("Hey, be careful.");

    expect(console.warn).toHaveBeenCalledWith(
      chalk.yellow("Warning: Hey, be careful.")
    );
  });

  test("success", () => {
    success("You did it!");

    expect(console.log).toHaveBeenCalledWith(
      chalk.green("Success: You did it!")
    );
  });

  test("info", () => {
    info("Just looking around.");

    expect(console.log).toHaveBeenCalledWith(
      chalk.blue("Info: Just looking around.")
    );
  });
});
