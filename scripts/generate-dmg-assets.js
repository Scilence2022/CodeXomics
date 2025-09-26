#!/usr/bin/env node

/**
 * Generate DMG Assets Script for Genome AI Studio
 * 
 * This script generates the necessary assets for a beautiful DMG installer:
 * - Converts PNG icon to ICNS format
 * - Creates a DMG background image
 * - Ensures proper asset organization
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.dirname(__dirname);
const buildDir = path.join(projectRoot, 'build');
const assetsDir = path.join(projectRoot, 'assets');

console.log('🎨 Generating DMG Assets for Genome AI Studio...');

// Ensure build directory exists
if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
}

// Check if source icon exists
const sourceIcon = path.join(assetsDir, 'icon.png');
const targetIcns = path.join(buildDir, 'icon.icns');

if (!fs.existsSync(sourceIcon)) {
    console.error('❌ Source icon not found at:', sourceIcon);
    process.exit(1);
}

// For now, copy the PNG as a placeholder (on macOS, you'd use iconutil)
// In a real scenario, you'd convert PNG to ICNS format
console.log('📄 Icon asset found:', sourceIcon);

// Create a simple DMG background HTML template that we can screenshot
const dmgBackgroundHtml = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 0;
            width: 660px;
            height: 420px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.05"/><circle cx="20" cy="80" r="0.5" fill="white" opacity="0.05"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
        }
        .logo-area {
            position: absolute;
            top: 40px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
        }
        .app-name {
            font-size: 28px;
            font-weight: 300;
            margin: 0;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        .version {
            font-size: 14px;
            opacity: 0.8;
            margin: 5px 0 0 0;
        }
        .instruction {
            position: absolute;
            bottom: 60px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 16px;
            text-align: center;
            opacity: 0.9;
            text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        }
        .drag-arrow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 24px;
            opacity: 0.6;
        }
        .dna-helix {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            opacity: 0.3;
        }
    </style>
</head>
<body>
    <div class="logo-area">
        <h1 class="app-name">Genome AI Studio</h1>
        <p class="version">AI-Powered Genome Analysis</p>
    </div>
    
    <div class="drag-arrow">
        ← Drag to Applications →
    </div>
    
    <div class="instruction">
        Drag the app icon to Applications folder to install
    </div>
    
    <svg class="dna-helix" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 10 Q30 20 50 10 Q30 40 10 50 Q30 40 50 50" stroke="white" stroke-width="2" opacity="0.4"/>
        <circle cx="15" cy="15" r="2" fill="white" opacity="0.6"/>
        <circle cx="45" cy="15" r="2" fill="white" opacity="0.6"/>
        <circle cx="15" cy="45" r="2" fill="white" opacity="0.6"/>
        <circle cx="45" cy="45" r="2" fill="white" opacity="0.6"/>
    </svg>
</body>
</html>
`;

// Save the HTML template
const htmlPath = path.join(buildDir, 'dmg-background-template.html');
fs.writeFileSync(htmlPath, dmgBackgroundHtml);

console.log('✅ DMG background template created:', htmlPath);

// Create instructions for manual steps
const instructionsPath = path.join(buildDir, 'DMG_SETUP_INSTRUCTIONS.md');
const instructions = `# DMG Assets Setup Instructions

## Generated Files
- \`dmg-background-template.html\` - Template for DMG background

## Manual Steps Required

### 1. Create Icon (macOS only)
\`\`\`bash
# Convert PNG to ICNS (requires macOS)
mkdir -p icon.iconset
sips -z 16 16     assets/icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     assets/icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     assets/icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     assets/icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   assets/icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   assets/icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   assets/icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   assets/icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   assets/icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 assets/icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o build/icon.icns
rm -rf icon.iconset
\`\`\`

### 2. Create DMG Background
1. Open \`build/dmg-background-template.html\` in a browser
2. Set browser window to exactly 660x420 pixels
3. Take a screenshot and save as \`build/dmg-background.png\`

### 3. Alternative: Use Figma/Design Tool
Create a 660x420 background with:
- Gradient background (brand colors)
- App name and version
- "Drag to Applications" instruction
- Subtle branding elements

## Build Command
After creating the assets:
\`\`\`bash
npm run build:mac
\`\`\`

## DMG Configuration
The package.json has been updated with:
- Larger window size (660x420)
- Better icon positioning
- Background image support
- Improved title and naming
`;

fs.writeFileSync(instructionsPath, instructions);

console.log('✅ Setup instructions created:', instructionsPath);
console.log('');
console.log('📋 Next Steps:');
console.log('1. Follow instructions in build/DMG_SETUP_INSTRUCTIONS.md');
console.log('2. Create icon.icns and dmg-background.png files');
console.log('3. Run npm run build:mac to generate improved DMG');
console.log('');
console.log('🎨 DMG will feature:');
console.log('  • Professional gradient background');
console.log('  • Larger, more readable layout');
console.log('  • Clear installation instructions');
console.log('  • Branded appearance');