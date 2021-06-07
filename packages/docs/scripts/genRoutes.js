import fs from "fs";
import path from "path";

const isDir = (name) => fs.lstatSync(name).isDirectory();
const isSvelte = (name) =>
  !path.basename(name).startsWith("_") && name.endsWith(".svelte");

const readdir = (dir) =>
  fs.readdirSync(dir).map((file) => path.join(dir, file));

const getSvelteFiles = (files) => files.filter(isSvelte);
const getSubdirs = (files) => files.filter(isDir);

const getTitle = (src) => src.match(/<Title>(.*?)<\/Title>/)?.[1];
const getMeta = (src) => src.match(/<Meta(.*?)\/>/)?.[0];
const getOrder = (src) => {
  const meta = getMeta(src);
  if (!meta) return null;
  return parseInt(meta.match(/order=\{(\d+)\}/)?.[1]);
};

const getRoute = (file) => {
  const content = fs.readFileSync(file).toString();
  return { src: file, title: getTitle(content), order: getOrder(content) };
};
const getRoutes = (files) => files.map(getRoute);

const generate = (dir) => {
  const files = readdir(dir);
  const svelteFiles = getSvelteFiles(files);
  const subdirs = getSubdirs(files);
  return [...getRoutes(svelteFiles), ...subdirs.map(generate)];
};

const cleanup = (routes) =>
  routes.map(({ src, ...rest }) => ({
    src: "." + path.sep + src.slice(14, -7),
    ...rest,
  }));

const set = (tree, parts, data) => {
  const part = parts.shift();
  if (!parts.length) {
    tree[part] = { __meta: data };
  } else {
    tree[part] = tree[part] || { __subtree: {} };
    set(tree[part].__subtree, parts, data);
  }
};

const treeify = (routes) => {
  const tree = {};
  for (const route of routes) {
    const parts = route.src.split(path.sep);
    const { src: _, ...data } = route;
    set(tree, parts, data);
  }
  return tree;
};

const routes = generate("../src/routes");
const tree = treeify(cleanup(routes));

fs.writeFileSync("../src/routes.json", JSON.stringify(tree, null, 2));
