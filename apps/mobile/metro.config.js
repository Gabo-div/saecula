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

// These packages MUST be a single instance in the bundle. Since adding the
// web workspace, bun installs a second physical copy of each at the repo root,
// and Metro's hierarchical lookup would otherwise resolve them to different
// copies depending on who imports them — two React reconcilers means the
// Fabric renderer fails to patch React's (now duplicated) internals
// ("property is not writable"), leaving ReactFabric.default undefined and a
// black screen. Anchor every one of these requires to apps/mobile's copy.
const singletons = new Set([
  'react',
  'react-dom',
  'react-native',
  'scheduler',
  'react-native-reanimated',
]);
const anchor = path.join(projectRoot, 'index.ts');
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const pkg = moduleName.startsWith('@')
    ? moduleName.split('/').slice(0, 2).join('/')
    : moduleName.split('/')[0];
  const ctx =
    singletons.has(pkg) && context.originModulePath !== anchor
      ? { ...context, originModulePath: anchor }
      : context;
  return defaultResolveRequest
    ? defaultResolveRequest(ctx, moduleName, platform)
    : ctx.resolveRequest(ctx, moduleName, platform);
};

module.exports = config;
