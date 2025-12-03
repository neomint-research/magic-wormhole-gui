/**
 * Cross-platform script to copy static renderer files to build directory.
 * Note: bundle.js is now built by esbuild from TypeScript source.
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'renderer');
const destDir = path.join(__dirname, '..', 'build', 'renderer');

// Only static files - bundle.js is built from TypeScript
const files = ['index.html', 'styles.css'];

// Ensure destination directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy each file
for (const file of files) {
  const src = path.join(srcDir, file);
  const dest = path.join(destDir, file);
  
  if (!fs.existsSync(src)) {
    console.error(`Source file not found: ${src}`);
    process.exit(1);
  }
  
  fs.copyFileSync(src, dest);
  console.log(`Copied: ${file}`);
}

console.log('Static files copied successfully.');
