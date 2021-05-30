const { AutoComplete } = require("./prompt");
const chalk = require("chalk");

async function configPrompt(configs) {
  const prompt = new AutoComplete({
    name: "config",
    message: "Choose a config file to run",
    choices: configs,
    footer: chalk.gray("* Use the --config flag to bypass this prompt"),
  });
  const answer = await prompt.run();
  prompt.clear();
  return answer;
}

module.exports.configPrompt = configPrompt;
