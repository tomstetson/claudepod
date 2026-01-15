#!/usr/bin/env node
/**
 * Generate PWA icons from SVG
 * Requires: npm install sharp
 * Run: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.log('sharp not installed. Installing...');
  require('child_process').execSync('npm install sharp', { stdio: 'inherit' });
  sharp = require('sharp');
}

const svgPath = path.join(__dirname, '../public/icons/icon-192.svg');
const icon192Path = path.join(__dirname, '../public/icons/icon-192.png');
const icon512Path = path.join(__dirname, '../public/icons/icon-512.png');

async function generateIcons() {
  const svg = fs.readFileSync(svgPath);

  // Generate 192x192
  await sharp(svg)
    .resize(192, 192)
    .png()
    .toFile(icon192Path);
  console.log('Created icon-192.png');

  // Generate 512x512
  await sharp(svg)
    .resize(512, 512)
    .png()
    .toFile(icon512Path);
  console.log('Created icon-512.png');
}

generateIcons().catch(console.error);
