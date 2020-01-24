const tmp = require("tmp");
const { createPackage } = require('../../../cli/commands/new');
const { run } = require('../../../cli/commands/run');

test("Runs hello world", async () => {
  console.log = jest.fn();
  const dir = tmp.dirSync();
  await createPackage(dir.name);
  await run(dir.name);
  expect(console.log).toHaveBeenCalledWith('Hello World');
});
