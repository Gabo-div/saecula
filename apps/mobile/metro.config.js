const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// The monorepo root holds bun workspaces (packages/*). Let Metro watch and
// resolve modules outside apps/mobile so local packages (e.g. @saecula/contracts)
// are bundled and resolved correctly.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
