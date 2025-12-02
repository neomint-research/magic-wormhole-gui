/**
 * Icon Conversion Script
 * 
 * Converts icon.svg to various formats needed for Electron app.
 * 
 * Prerequisites:
 *   npm install --save-dev sharp png-to-ico
 * 
 * Usage:
 *   npm run icons
 * 
 * Output:
 *   - assets/icon.png (512x512, Linux/README)
 *   - assets/icon.ico (Windows, multi-resolution)
 *   - assets/icon.icns (macOS - requires manual creation, see below)
 * 
 * For macOS icon.icns:
 *   On macOS: Use iconutil or online converter
 *   Online: https://cloudconvert.com/png-to-icns
 */

const sharp = require('sharp');
const pngToIco = require('png-to-ico');
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'assets');
const SVG_PATH = path.join(ASSETS_DIR, 'icon.svg');

async function main() {
  console.log('Icon Conversion Script');
  console.log('======================\n');

  // Check if source exists
  if (!fs.existsSync(SVG_PATH)) {
    console.error('Error: icon.svg not found in assets/');
    process.exit(1);
  }

  const sizes = [512, 256, 128, 64, 48, 32, 16];
  const pngBuffers = {};

  // Generate PNGs at various sizes
  console.log('Generating PNG files...');
  for (const size of sizes) {
    const outputPath = path.join(ASSETS_DIR, `icon-${size}.png`);
    await sharp(SVG_PATH)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    pngBuffers[size] = fs.readFileSync(outputPath);
    console.log(`  Created: icon-${size}.png`);
  }

  // Copy 512 as main icon.png
  fs.copyFileSync(
    path.join(ASSETS_DIR, 'icon-512.png'),
    path.join(ASSETS_DIR, 'icon.png')
  );
  console.log('  Created: icon.png (512x512)\n');

  // Generate ICO (Windows)
  console.log('Generating ICO file...');
  const icoSizes = [256, 128, 64, 48, 32, 16];
  const icoPngs = icoSizes.map(size => pngBuffers[size]);
  
  const icoBuffer = await pngToIco(icoPngs);
  fs.writeFileSync(path.join(ASSETS_DIR, 'icon.ico'), icoBuffer);
  console.log('  Created: icon.ico\n');

  // Linux needs specific filenames: NxN.png
  console.log('Creating Linux icon sizes...');
  for (const size of [512, 256, 128, 64, 48, 32, 16]) {
    const sourcePath = path.join(ASSETS_DIR, `icon-${size}.png`);
    const linuxPath = path.join(ASSETS_DIR, `${size}x${size}.png`);
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, linuxPath);
      fs.unlinkSync(sourcePath); // Remove icon-N.png, keep NxN.png
      console.log(`  Created: ${size}x${size}.png`);
    }
  }
  
  console.log('\nDone! Generated files:');
  console.log('  - assets/icon.svg        (source)');
  console.log('  - assets/icon.png        (512x512, main)');
  console.log('  - assets/icon.ico        (Windows, multi-resolution)');
  console.log('  - assets/NxN.png         (Linux, various sizes)');
  console.log('\nNote: For macOS, create icon.icns manually:');
  console.log('  https://cloudconvert.com/png-to-icns');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
