import { brightRed, error, info, success, trace, warn } from "../colors.js";

import chalk from "chalk";
import { jest } from "@jest/globals";

const { blue, green, yellow } = chalk;

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

  test("error with string", () => {
    const err = "err";
    error(err);

    expect(console.error).toHaveBeenCalledWith(brightRed("Error: err"));
  });

  test("warn", () => {
    warn("Hey, be careful.");

    expect(console.warn).toHaveBeenCalledWith(
      yellow("Warning: Hey, be careful.")
    );
  });

  test("success", () => {
    success("You did it!");

    expect(console.log).toHaveBeenCalledWith(green("Success: You did it!"));
  });

  test("info", () => {
    info("Just looking around.");

    expect(console.log).toHaveBeenCalledWith(
      blue("Info: Just looking around.")
    );
  });
});
