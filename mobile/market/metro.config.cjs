const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { FileStore } = require("metro-cache");
const root = __dirname;
const repository = path.resolve(root, "../..");
const config = getDefaultConfig(root);
config.cacheStores = [new FileStore({ root: path.join(repository, ".tmp/mobile-expo-metro-cache") })];
config.watchFolders = [
  path.join(repository, "contracts/mobile-read"),
  path.join(repository, "packages/schemas"),
  path.join(repository, "packages/ui/src"),
];
config.resolver.nodeModulesPaths = [path.join(root, "node_modules")];
// Authoritative TypeScript sources use ESM .js specifiers for their compiled output.
config.resolver.resolveRequest = (context, name, platform) => {
  if (name.startsWith(".") && name.endsWith(".js")) {
    try { return context.resolveRequest(context, name.slice(0, -3), platform); }
    catch { /* Preserve normal resolution and its diagnostics if no TS source exists. */ }
  }
  return context.resolveRequest(context, name, platform);
};
module.exports = config;
