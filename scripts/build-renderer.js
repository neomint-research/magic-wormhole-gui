/**
 * Build script for renderer TypeScript using esbuild.
 * Compiles src/renderer/index.ts to build/renderer/bundle.js
 */

const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.join(__dirname, '..', 'src', 'renderer', 'index.ts')],
  bundle: true,
  outfile: path.join(__dirname, '..', 'build', 'renderer', 'bundle.js'),
  platform: 'browser',
  target: ['chrome120'],
  format: 'iife',
  sourcemap: true,
  minify: process.env.NODE_ENV === 'production',
  logLevel: 'info',
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('Renderer build complete.');
    }
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

build();
