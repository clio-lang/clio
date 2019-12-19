const tmp = require("tmp");
const path = require('path');
const { createPackage } = require('../../../cli/commands/new');
const { run } = require('../../../cli/commands/run');

test("Runs hello world", async () => {
  console.log = jest.fn();
  const dir = tmp.dirSync();
  await createPackage(dir.name, true);
  const source = path.join(dir.name, 'index.clio');
  await run(source);
  expect(console.log).toBeCalledWith('Hello World');
});
