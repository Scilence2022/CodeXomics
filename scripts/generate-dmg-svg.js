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
    const svg = `<svg width="${DMG_WIDTH}" height="${DMG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4A90E2;stop-opacity:1" />
      <stop offset="30%" style="stop-color:#7B68EE;stop-opacity:1" />
      <stop offset="70%" style="stop-color:#9370DB;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8A2BE2;stop-opacity:1" />
    </linearGradient>
    
    <!-- Simple texture pattern -->
    <pattern id="texturePattern" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="0.5" fill="white" opacity="0.1"/>
      <circle cx="30" cy="30" r="0.3" fill="white" opacity="0.08"/>
      <circle cx="40" cy="15" r="0.4" fill="white" opacity="0.06"/>
    </pattern>
  </defs>
  
  <!-- Main background -->
  <rect width="${DMG_WIDTH}" height="${DMG_HEIGHT}" fill="url(#mainGradient)"/>
  
  <!-- Texture overlay -->
  <rect width="${DMG_WIDTH}" height="${DMG_HEIGHT}" fill="url(#texturePattern)"/>
  
  <!-- Header text - Using simple styling for maximum compatibility -->
  <text x="330" y="85" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="36" font-weight="bold">CodeXomics</text>
  
  <text x="330" y="110" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="16" opacity="0.9">${VERSION_INFO.displayVersion} Beta</text>
  
  <text x="330" y="130" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" opacity="0.8">AI-Powered Bioinformatics Platform</text>
  
  <!-- Simple placeholders -->
  <rect x="130" y="160" width="100" height="100" fill="none" stroke="white" stroke-width="2" stroke-dasharray="5,5" stroke-opacity="0.5" rx="15"/>
  <text x="180" y="215" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="11" opacity="0.6">App Icon</text>
  
  <rect x="430" y="160" width="100" height="100" fill="none" stroke="white" stroke-width="2" stroke-dasharray="5,5" stroke-opacity="0.5" rx="15"/>
  <text x="480" y="215" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="11" opacity="0.6">Applications</text>
  
  <!-- Simple arrow design -->
  <g opacity="0.7">
    <!-- Left arrow -->
    <polygon points="290,210 300,205 300,215" fill="white" opacity="0.8"/>
    <line x1="300" y1="210" x2="320" y2="210" stroke="white" stroke-width="2" opacity="0.6"/>
    
    <!-- Dots -->
    <circle cx="330" cy="210" r="2" fill="white" opacity="0.6"/>
    <circle cx="340" cy="210" r="2" fill="white" opacity="0.6"/>
    <circle cx="350" cy="210" r="2" fill="white" opacity="0.6"/>
    
    <!-- Right arrow -->
    <line x1="360" y1="210" x2="380" y2="210" stroke="white" stroke-width="2" opacity="0.6"/>
    <polygon points="380,210 370,205 370,215" fill="white" opacity="0.8"/>
  </g>
  
  <!-- Bottom instruction -->
  <text x="330" y="375" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="14" opacity="0.9">Drag the app icon to Applications folder to install</text>
  
  <!-- Simple decoration elements -->
  <g opacity="0.1">
    <circle cx="580" cy="60" r="15" fill="white"/>
    <circle cx="600" cy="80" r="10" fill="white"/>
    <circle cx="50" cy="350" r="12" fill="white"/>
    <circle cx="30" cy="370" r="8" fill="white"/>
  </g>
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