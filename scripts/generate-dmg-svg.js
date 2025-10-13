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
    
    const svg = `<svg width="${DMG_WIDTH}" height="${DMG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#4A90E2;stop-opacity:1" />
      <stop offset="30%" style="stop-color:#7B68EE;stop-opacity:1" />
      <stop offset="70%" style="stop-color:#9370DB;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8A2BE2;stop-opacity:1" />
    </linearGradient>
    
    <!-- Texture pattern -->
    <pattern id="texturePattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
      <circle cx="15" cy="25" r="1" fill="white" opacity="0.08"/>
      <circle cx="45" cy="15" r="0.5" fill="white" opacity="0.05"/>
      <circle cx="75" cy="35" r="0.8" fill="white" opacity="0.06"/>
      <circle cx="25" cy="65" r="0.6" fill="white" opacity="0.04"/>
      <circle cx="85" cy="75" r="1" fill="white" opacity="0.07"/>
      <circle cx="35" cy="85" r="0.4" fill="white" opacity="0.03"/>
    </pattern>
    
    <!-- DNA decoration styles -->
    <linearGradient id="helixGradient" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:white;stop-opacity:0" />
      <stop offset="50%" style="stop-color:white;stop-opacity:0.1" />
      <stop offset="100%" style="stop-color:white;stop-opacity:0" />
    </linearGradient>
    
    <!-- Text shadow filter -->
    <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
    
    <filter id="lightTextShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="1" stdDeviation="2" flood-color="rgba(0,0,0,0.3)"/>
    </filter>
  </defs>
  
  <!-- Main background -->
  <rect width="${DMG_WIDTH}" height="${DMG_HEIGHT}" fill="url(#mainGradient)"/>
  
  <!-- Texture overlay -->
  <rect width="${DMG_WIDTH}" height="${DMG_HEIGHT}" fill="url(#texturePattern)"/>
  
  <!-- Header text -->
  <text x="330" y="90" text-anchor="middle" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" font-size="42" font-weight="bold" filter="url(#textShadow)">CodeXomics</text>
  
  <text x="330" y="115" text-anchor="middle" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" font-size="18" font-weight="300" opacity="0.9" filter="url(#lightTextShadow)">${VERSION_INFO.displayVersion} Beta</text>
  
  <text x="330" y="135" text-anchor="middle" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" font-size="16" font-weight="300" opacity="0.8" filter="url(#lightTextShadow)">AI-Powered Bioinformatics Platform</text>
  
  <!-- App icon placeholder -->
  <rect x="130" y="160" width="100" height="100" fill="none" stroke="white" stroke-width="2" stroke-dasharray="8,4" stroke-opacity="0.3" rx="20"/>
  <text x="180" y="215" text-anchor="middle" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" font-size="12" opacity="0.5">App Icon</text>
  
  <!-- Applications placeholder -->
  <rect x="430" y="160" width="100" height="100" fill="none" stroke="white" stroke-width="2" stroke-dasharray="8,4" stroke-opacity="0.3" rx="20"/>
  <text x="480" y="215" text-anchor="middle" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" font-size="12" opacity="0.5">Applications</text>
  
  <!-- Drag arrow -->
  <g opacity="0.6" transform="translate(330, 210)">
    <text x="-40" y="5" text-anchor="middle" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" font-size="24" font-weight="bold">←</text>
    <circle cx="-15" cy="0" r="2" fill="white" opacity="0.6"/>
    <circle cx="0" cy="0" r="2" fill="white" opacity="0.6"/>
    <circle cx="15" cy="0" r="2" fill="white" opacity="0.6"/>
    <text x="40" y="5" text-anchor="middle" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" font-size="24" font-weight="bold">→</text>
  </g>
  
  <!-- Bottom instruction -->
  <text x="330" y="380" text-anchor="middle" fill="white" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif" font-size="16" font-weight="400" opacity="0.9" filter="url(#lightTextShadow)">Drag the app icon to Applications folder to install</text>
  
  <!-- DNA helix decoration (top right) -->
  <g opacity="0.1" transform="translate(540, 40)">
    <rect x="0" y="20" width="120" height="2" fill="url(#helixGradient)" rx="1"/>
    <rect x="0" y="40" width="120" height="2" fill="url(#helixGradient)" rx="1"/>
    <rect x="0" y="60" width="120" height="2" fill="url(#helixGradient)" rx="1"/>
  </g>
  
  <!-- DNA bottom decoration -->
  <g opacity="0.08" transform="translate(20, 340)">
    <rect x="0" y="20" width="80" height="1" fill="white" rx="1"/>
    <rect x="0" y="40" width="80" height="1" fill="white" rx="1"/>
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