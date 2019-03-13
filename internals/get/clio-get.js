const decompress = require('decompress');
const tmp = require('tmp');
const fs = require('fs');
const fetch = require("node-fetch");
const gitHubRegex = /^github\.com(\/\w+|\d|_|-){2}/gm;

async function get(argv) {
  return argv.match(gitHubRegex) 
         ? fetchGitHub(argv) 
         : fetchFile(argv)
}

async function fetchFile(argv) {
  const url = argv.url;
  const file = await fetch(url);
  const array_buffer = await file.arrayBuffer();
  const buffer = Buffer.from(array_buffer);
  const tmpobj = tmp.fileSync();
  fs.writeFileSync(tmpobj.name, buffer, 'binary');
  await decompress(tmpobj.name, 'clio_env')
  tmpobj.removeCallback();
}

async function fetchGitHub(argv) {
  fetchFile({
    url: `https://${argv}/archive/master.zip`
  })
}

get("github.com/micheleriva/vscode-clio")