#!/usr/bin/env node

/**
 * SVG DMG Background Generator for CodeXomics
 *
 * Creates a SVG background for DMG installation interface
 * Automatically reads version information from version.js
 *
 * @author CodeXomics Team
 */

const fs = require('fs');
const path = require('path');

// Import version information
const VERSION_INFO = require('../src/version.js');

const DMG_WIDTH = 660;
const DMG_HEIGHT = 420;

/**
 * Generate SVG background for DMG
 */
function generateSVGBackground() {
  console.log('🎨 Generating SVG background for CodeXomics', VERSION_INFO.displayVersion);

  // Create a simplified SVG for better DMG compatibility
  // Create a simplified high-contrast SVG for DMG compatibility
  const svg = `<svg width="${DMG_WIDTH}" height="${DMG_HEIGHT}" viewBox="0 0 ${DMG_WIDTH} ${DMG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <!-- Solid background to ensure visibility -->
  <rect x="0" y="0" width="${DMG_WIDTH}" height="${DMG_HEIGHT}" fill="#4A90E2"/>
  
  <!-- Header text -->
  <text x="330" y="80" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="36" font-weight="bold">CodeXomics</text>
  <text x="330" y="110" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18">${VERSION_INFO.displayVersion} Beta</text>
  <text x="330" y="135" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14">The AI-native genome browser</text>
  
  <!-- Icon Placeholders (Visual guides only) -->
  <rect x="120" y="160" width="120" height="120" rx="20" fill="white" fill-opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="5,5"/>
  <text x="180" y="220" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12">App Icon</text>
  
  <rect x="420" y="160" width="120" height="120" rx="20" fill="white" fill-opacity="0.2" stroke="white" stroke-width="2" stroke-dasharray="5,5"/>
  <text x="480" y="220" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="12">Applications</text>
  
  <!-- Arrow -->
  <g transform="translate(290, 210)">
    <line x1="10" y1="0" x2="70" y2="0" stroke="white" stroke-width="4" stroke-linecap="round"/>
    <polygon points="60,-10 80,0 60,10" fill="white"/>
  </g>
  
  <!-- Instructions -->
  <text x="330" y="360" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14">Drag CodeXomics to Applications to install</text>
  
  <!-- Footer -->
  <text x="330" y="400" text-anchor="middle" fill="white" fill-opacity="0.6" font-family="Arial, sans-serif" font-size="10">© ${VERSION_INFO.buildYear} CodeXomics Team</text>
</svg>`;

  // Save the SVG file
  const svgPath = path.join(__dirname, '../build/dmg-background.svg');
  fs.writeFileSync(svgPath, svg);

  console.log('✅ SVG background generated successfully:', svgPath);
  console.log('📐 Dimensions:', DMG_WIDTH, 'x', DMG_HEIGHT);
  console.log('📝 Version:', VERSION_INFO.displayVersion);

  return svgPath;
}

// Run the generator if called directly
if (require.main === module) {
  try {
    const svgPath = generateSVGBackground();

    console.log('\n🎨 DMG Background SVG Generation Complete!');
    console.log('📄 File generated:', svgPath);
    console.log('\n🚀 Version automatically included:', VERSION_INFO.displayVersion);
    console.log('✅ Ready for DMG build process!');
  } catch (error) {
    console.error('❌ Error generating DMG background SVG:', error.message);
    process.exit(1);
  }
}

module.exports = { generateSVGBackground };
