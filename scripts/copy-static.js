/**
 * Cross-platform script to copy static renderer files to build directory.
 * Replaces Windows-only 'copy' command for macOS/Linux compatibility.
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src', 'renderer');
const destDir = path.join(__dirname, '..', 'build', 'renderer');

const files = ['index.html', 'styles.css', 'bundle.js'];

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
