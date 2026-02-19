#!/usr/bin/env node

/**
 * SVG-based DMG Background Generator for CodeXomics
 * 
 * This script generates a modern, clean DMG background as SVG
 * with automatically updated version information from version.js
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
 * Generate modern SVG DMG background with dynamic version info
 */
function generateSVGBackground() {
    console.log('🎨 Generating SVG DMG background for CodeXomics', VERSION_INFO.displayVersion);
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${DMG_WIDTH}" height="${DMG_HEIGHT}" viewBox="0 0 ${DMG_WIDTH} ${DMG_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <!-- Modern gradient background -->
        <linearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#4A90E2;stop-opacity:1" />
            <stop offset="30%" style="stop-color:#7B68EE;stop-opacity:1" />
            <stop offset="70%" style="stop-color:#9370DB;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#8A2BE2;stop-opacity:1" />
        </linearGradient>
        
        <!-- Subtle noise pattern -->
        <pattern id="noisePattern" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="25" r="0.5" fill="white" opacity="0.08"/>
            <circle cx="45" cy="15" r="0.3" fill="white" opacity="0.05"/>
            <circle cx="75" cy="35" r="0.4" fill="white" opacity="0.06"/>
            <circle cx="25" cy="65" r="0.3" fill="white" opacity="0.04"/>
            <circle cx="85" cy="75" r="0.5" fill="white" opacity="0.07"/>
            <circle cx="35" cy="85" r="0.2" fill="white" opacity="0.03"/>
            <circle cx="65" cy="55" r="0.4" fill="white" opacity="0.05"/>
            <circle cx="5" cy="45" r="0.3" fill="white" opacity="0.04"/>
        </pattern>
        
        <!-- DNA helix pattern -->
        <pattern id="dnaPattern" x="0" y="0" width="60" height="40" patternUnits="userSpaceOnUse">
            <path d="M5 20 Q30 10 55 20 Q30 30 5 20" stroke="white" stroke-width="1" fill="none" opacity="0.08"/>
            <circle cx="15" cy="15" r="1" fill="white" opacity="0.1"/>
            <circle cx="45" cy="25" r="1" fill="white" opacity="0.1"/>
        </pattern>
        
        <!-- Text shadow filter -->
        <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
        </filter>
    </defs>
    
    <!-- Background -->
    <rect width="100%" height="100%" fill="url(#backgroundGradient)"/>
    <rect width="100%" height="100%" fill="url(#noisePattern)"/>
    
    <!-- DNA pattern decoration (top-right) -->
    <rect x="500" y="20" width="140" height="80" fill="url(#dnaPattern)"/>
    
    <!-- Main title -->
    <text x="${DMG_WIDTH / 2}" y="85" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" 
          font-size="42" font-weight="bold" text-anchor="middle" fill="white" filter="url(#textShadow)">
        CodeXomics
    </text>
    
    <!-- Version info -->
    <text x="${DMG_WIDTH / 2}" y="115" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" 
          font-size="18" font-weight="300" text-anchor="middle" fill="rgba(255,255,255,0.9)" filter="url(#textShadow)">
        ${VERSION_INFO.displayVersion} Beta
    </text>
    
    <!-- Subtitle -->
    <text x="${DMG_WIDTH / 2}" y="140" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" 
          font-size="16" font-weight="300" text-anchor="middle" fill="rgba(255,255,255,0.8)">
        AI-Powered Bioinformatics Platform
    </text>
    
    <!-- Icon placeholders -->
    <!-- App icon circle (left) -->
    <circle cx="180" cy="${DMG_HEIGHT / 2}" r="50" fill="none" stroke="rgba(255,255,255,0.3)" 
            stroke-width="2" stroke-dasharray="8,4"/>
    
    <!-- Applications folder circle (right) -->
    <circle cx="480" cy="${DMG_HEIGHT / 2}" r="50" fill="none" stroke="rgba(255,255,255,0.3)" 
            stroke-width="2" stroke-dasharray="8,4"/>
    
    <!-- Drag arrow indicator -->
    <g stroke="rgba(255,255,255,0.6)" stroke-width="2" fill="rgba(255,255,255,0.6)">
        <!-- Left arrow -->
        <path d="M${DMG_WIDTH / 2 - 60} ${DMG_HEIGHT / 2 + 20} L${DMG_WIDTH / 2 - 40} ${DMG_HEIGHT / 2 + 12}"/>
        <path d="M${DMG_WIDTH / 2 - 60} ${DMG_HEIGHT / 2 + 20} L${DMG_WIDTH / 2 - 40} ${DMG_HEIGHT / 2 + 28}"/>
        <line x1="${DMG_WIDTH / 2 - 60}" y1="${DMG_HEIGHT / 2 + 20}" x2="${DMG_WIDTH / 2 - 20}" y2="${DMG_HEIGHT / 2 + 20}"/>
        
        <!-- Right arrow -->
        <path d="M${DMG_WIDTH / 2 + 60} ${DMG_HEIGHT / 2 + 20} L${DMG_WIDTH / 2 + 40} ${DMG_HEIGHT / 2 + 12}"/>
        <path d="M${DMG_WIDTH / 2 + 60} ${DMG_HEIGHT / 2 + 20} L${DMG_WIDTH / 2 + 40} ${DMG_HEIGHT / 2 + 28}"/>
        <line x1="${DMG_WIDTH / 2 + 60}" y1="${DMG_HEIGHT / 2 + 20}" x2="${DMG_WIDTH / 2 + 20}" y2="${DMG_HEIGHT / 2 + 20}"/>
        
        <!-- Center dots -->
        <circle cx="${DMG_WIDTH / 2 - 5}" cy="${DMG_HEIGHT / 2 + 20}" r="2"/>
        <circle cx="${DMG_WIDTH / 2}" cy="${DMG_HEIGHT / 2 + 20}" r="2"/>
        <circle cx="${DMG_WIDTH / 2 + 5}" cy="${DMG_HEIGHT / 2 + 20}" r="2"/>
    </g>
    
    <!-- Installation instruction -->
    <text x="${DMG_WIDTH / 2}" y="${DMG_HEIGHT - 35}" font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif" 
          font-size="16" font-weight="400" text-anchor="middle" fill="rgba(255,255,255,0.9)" filter="url(#textShadow)">
        Drag the app icon to Applications folder to install
    </text>
    
    <!-- Subtle DNA helix decoration (bottom-left) -->
    <g opacity="0.1" stroke="white" stroke-width="1" fill="none">
        <path d="M20 350 Q50 340 80 350 Q50 360 20 350"/>
        <path d="M30 360 Q60 350 90 360 Q60 370 30 360"/>
        <circle cx="35" cy="345" r="1.5" fill="white"/>
        <circle cx="75" cy="355" r="1.5" fill="white"/>
    </g>
</svg>`;

    // Save the SVG
    const svgPath = path.join(__dirname, '../build/dmg-background.svg');
    fs.writeFileSync(svgPath, svg);
    
    console.log('✅ SVG DMG background generated successfully:', svgPath);
    console.log('📐 Dimensions:', DMG_WIDTH, 'x', DMG_HEIGHT);
    console.log('📝 Version:', VERSION_INFO.displayVersion);
    
    return svgPath;
}

/**
 * Convert SVG to PNG using built-in tools (requires conversion)
 */
function convertSVGToPNG() {
    const svgPath = path.join(__dirname, '../build/dmg-background.svg');
    const pngPath = path.join(__dirname, '../build/dmg-background.png');
    
    console.log('🔄 Converting SVG to PNG...');
    console.log('📝 Note: You may need to manually convert SVG to PNG for DMG compatibility');
    console.log('📝 SVG file ready at:', svgPath);
    console.log('📝 Convert using: rsvg-convert -w 660 -h 420 dmg-background.svg > dmg-background.png');
    
    return { svgPath, pngPath };
}

// Run the generator if called directly
if (require.main === module) {
    try {
        const svgPath = generateSVGBackground();
        const { pngPath } = convertSVGToPNG();
        
        console.log('\n🎨 DMG Background Generation Complete!');
        console.log('📂 Files generated:');
        console.log('   SVG:', svgPath);
        console.log('   PNG:', pngPath, '(manual conversion may be needed)');
        console.log('\n💡 To convert SVG to PNG automatically, install rsvg-convert:');
        console.log('   macOS: brew install librsvg');
        console.log('   Ubuntu: sudo apt-get install librsvg2-bin');
        console.log('   Then run: rsvg-convert -w 660 -h 420 build/dmg-background.svg > build/dmg-background.png');
        
    } catch (error) {
        console.error('❌ Error generating DMG background:', error.message);
        process.exit(1);
    }
}

module.exports = { generateSVGBackground, convertSVGToPNG };