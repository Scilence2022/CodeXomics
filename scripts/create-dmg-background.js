#!/usr/bin/env node

/**
 * Create DMG Background Image programmatically
 * Creates a simple PNG background for the DMG installer
 */

const fs = require('fs');
const path = require('path');

// Simple SVG to PNG conversion approach
const createSvgBackground = () => {
    return `<svg width="660" height="420" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#8b5cf6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#a855f7;stop-opacity:1" />
    </linearGradient>
    <pattern id="grain" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="10" cy="10" r="0.8" fill="white" opacity="0.08"/>
      <circle cx="30" cy="30" r="0.8" fill="white" opacity="0.08"/>
      <circle cx="20" cy="5" r="0.4" fill="white" opacity="0.05"/>
      <circle cx="35" cy="15" r="0.4" fill="white" opacity="0.05"/>
    </pattern>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/> 
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background gradient -->
  <rect width="660" height="420" fill="url(#grad1)"/>
  <rect width="660" height="420" fill="url(#grain)"/>
  
  <!-- Subtle geometric shapes -->
  <circle cx="100" cy="80" r="40" fill="white" opacity="0.03"/>
  <circle cx="560" cy="340" r="60" fill="white" opacity="0.02"/>
  <rect x="500" y="50" width="30" height="30" fill="white" opacity="0.04" rx="5"/>
  
  <!-- App Name with glow -->
  <text x="330" y="75" text-anchor="middle" fill="white" font-family="SF Pro Display, -apple-system, sans-serif" font-size="36" font-weight="200" opacity="0.98" filter="url(#glow)">
    CodeXomics
  </text>
  
  <!-- Subtitle -->
  <text x="330" y="105" text-anchor="middle" fill="white" font-family="SF Pro Display, -apple-system, sans-serif" font-size="15" font-weight="300" opacity="0.75">
    AI-Powered Genome Analysis Platform
  </text>
  
  <!-- Version badge -->
  <rect x="285" y="115" width="90" height="20" fill="white" opacity="0.15" rx="10"/>
  <text x="330" y="127" text-anchor="middle" fill="white" font-family="SF Pro Display, -apple-system, sans-serif" font-size="11" font-weight="500" opacity="0.9">
    v0.3.4 Beta
  </text>
  
  <!-- Drag instruction with better positioning -->
  <text x="330" y="230" text-anchor="middle" fill="white" font-family="SF Pro Display, -apple-system, sans-serif" font-size="22" font-weight="300" opacity="0.85">
    ←  Drag to Applications  →
  </text>
  
  <!-- Enhanced instruction -->
  <text x="330" y="380" text-anchor="middle" fill="white" font-family="SF Pro Display, -apple-system, sans-serif" font-size="16" font-weight="300" opacity="0.8">
    Drag the app icon to Applications folder to install
  </text>
  
  <!-- DNA Helix decoration - enhanced -->
  <g transform="translate(70, 40)" opacity="0.25">
    <path d="M0 0 Q15 15 30 0 Q15 30 0 45 Q15 30 30 45 Q15 60 0 75" stroke="white" stroke-width="2.5" fill="none"/>
    <circle cx="8" cy="8" r="2.5" fill="white" opacity="0.7"/>
    <circle cx="22" cy="8" r="2.5" fill="white" opacity="0.7"/>
    <circle cx="8" cy="37" r="2.5" fill="white" opacity="0.7"/>
    <circle cx="22" cy="37" r="2.5" fill="white" opacity="0.7"/>
    <circle cx="8" cy="67" r="2.5" fill="white" opacity="0.7"/>
    <circle cx="22" cy="67" r="2.5" fill="white" opacity="0.7"/>
  </g>
  
  <!-- Additional DNA decoration on right -->
  <g transform="translate(560, 150) rotate(180)" opacity="0.2">
    <path d="M0 0 Q10 10 20 0 Q10 20 0 30 Q10 20 20 30" stroke="white" stroke-width="2" fill="none"/>
    <circle cx="5" cy="5" r="2" fill="white" opacity="0.6"/>
    <circle cx="15" cy="5" r="2" fill="white" opacity="0.6"/>
    <circle cx="5" cy="25" r="2" fill="white" opacity="0.6"/>
    <circle cx="15" cy="25" r="2" fill="white" opacity="0.6"/>
  </g>
  
  <!-- Subtle grid pattern overlay -->
  <defs>
    <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
      <path d="M 50 0 L 0 0 0 50" fill="none" stroke="white" stroke-width="0.5" opacity="0.05"/>
    </pattern>
  </defs>
  <rect width="660" height="420" fill="url(#grid)"/>
</svg>`;
};

const projectRoot = path.dirname(__dirname);
const buildDir = path.join(projectRoot, 'build');

// Create the SVG
const svgContent = createSvgBackground();
const svgPath = path.join(buildDir, 'dmg-background.svg');

fs.writeFileSync(svgPath, svgContent);

console.log('✅ DMG background SVG created:', svgPath);
console.log('');
console.log('📋 To convert to PNG (requires additional tools):');
console.log('1. Install Inkscape: brew install inkscape');
console.log('2. Convert: inkscape --export-type=png --export-filename=build/dmg-background.png build/dmg-background.svg');
console.log('');
console.log('Alternative: Open the SVG in any design tool and export as PNG (660x420)');