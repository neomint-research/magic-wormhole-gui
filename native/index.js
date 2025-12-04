const { existsSync } = require('fs');
const { join } = require('path');

const moduleName = 'wormhole-native';

// Platform-specific binary names
const platforms = [
  `${moduleName}.win32-x64-msvc.node`,
  `${moduleName}.darwin-x64.node`,
  `${moduleName}.darwin-arm64.node`,
  `${moduleName}.linux-x64-gnu.node`,
  `${moduleName}.node`
];

// Search paths: development (__dirname) and packaged app (resourcesPath)
function getSearchPaths() {
  const paths = [__dirname];
  
  // In packaged Electron app, binaries are in resources/native/
  if (process.resourcesPath) {
    paths.push(join(process.resourcesPath, 'native'));
  }
  
  return paths;
}

let nativeBinding = null;
const searchPaths = getSearchPaths();
const triedPaths = [];

outer:
for (const searchPath of searchPaths) {
  for (const platform of platforms) {
    const bindingPath = join(searchPath, platform);
    triedPaths.push(bindingPath);
    if (existsSync(bindingPath)) {
      nativeBinding = require(bindingPath);
      break outer;
    }
  }
}

if (!nativeBinding) {
  throw new Error(`Failed to load native binding.\nTried paths:\n${triedPaths.join('\n')}`);
}

module.exports = nativeBinding;
