#!/usr/bin/env node

/**
 * Simple DMG Background Creator for CodeXomics
 * 
 * Creates a HTML page that can be screenshot to create the DMG background
 * Automatically updates version information from version.js
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
 * Generate HTML template for DMG background
 */
function generateHTMLTemplate() {
    console.log('🎨 Generating HTML template for CodeXomics', VERSION_INFO.displayVersion);
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CodeXomics ${VERSION_INFO.displayVersion} - DMG Background</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            width: ${DMG_WIDTH}px;
            height: ${DMG_HEIGHT}px;
            background: linear-gradient(135deg, #4A90E2 0%, #7B68EE 30%, #9370DB 70%, #8A2BE2 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            position: relative;
            overflow: hidden;
        }
        
        /* Subtle texture overlay */
        body::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image: 
                radial-gradient(circle at 15% 25%, rgba(255,255,255,0.08) 1px, transparent 1px),
                radial-gradient(circle at 45% 15%, rgba(255,255,255,0.05) 0.5px, transparent 0.5px),
                radial-gradient(circle at 75% 35%, rgba(255,255,255,0.06) 0.8px, transparent 0.8px),
                radial-gradient(circle at 25% 65%, rgba(255,255,255,0.04) 0.6px, transparent 0.6px),
                radial-gradient(circle at 85% 75%, rgba(255,255,255,0.07) 1px, transparent 1px),
                radial-gradient(circle at 35% 85%, rgba(255,255,255,0.03) 0.4px, transparent 0.4px);
            background-size: 100px 100px, 80px 80px, 120px 120px, 90px 90px, 110px 110px, 70px 70px;
            pointer-events: none;
        }
        
        .header {
            position: absolute;
            top: 40px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            z-index: 10;
        }
        
        .app-name {
            font-size: 42px;
            font-weight: bold;
            margin: 0 0 8px 0;
            text-shadow: 0 2px 8px rgba(0,0,0,0.3);
            letter-spacing: -0.5px;
        }
        
        .version {
            font-size: 18px;
            font-weight: 300;
            margin: 0 0 8px 0;
            opacity: 0.9;
            text-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        
        .subtitle {
            font-size: 16px;
            font-weight: 300;
            opacity: 0.8;
            text-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        
        .drag-instruction {
            position: absolute;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            text-align: center;
            z-index: 10;
        }
        
        .instruction-text {
            font-size: 16px;
            font-weight: 400;
            opacity: 0.9;
            text-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }
        
        .drag-arrow {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -40%);
            display: flex;
            align-items: center;
            opacity: 0.6;
            z-index: 5;
        }
        
        .arrow-left, .arrow-right {
            font-size: 24px;
            font-weight: bold;
        }
        
        .dots {
            margin: 0 15px;
            display: flex;
            gap: 4px;
        }
        
        .dot {
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: white;
            opacity: 0.6;
        }
        
        .icon-placeholder {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            width: 100px;
            height: 100px;
            border: 2px dashed rgba(255,255,255,0.3);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            opacity: 0.5;
            text-align: center;
        }
        
        .app-placeholder {
            left: 130px;
        }
        
        .apps-placeholder {
            right: 130px;
        }
        
        /* DNA helix decoration */
        .dna-decoration {
            position: absolute;
            top: 20px;
            right: 20px;
            width: 120px;
            height: 80px;
            opacity: 0.1;
            pointer-events: none;
        }
        
        .helix-line {
            position: absolute;
            width: 100%;
            height: 2px;
            background: linear-gradient(90deg, transparent, white, transparent);
            border-radius: 1px;
        }
        
        .helix-line:nth-child(1) { top: 20px; animation: float 4s ease-in-out infinite; }
        .helix-line:nth-child(2) { top: 40px; animation: float 4s ease-in-out infinite 0.5s; }
        .helix-line:nth-child(3) { top: 60px; animation: float 4s ease-in-out infinite 1s; }
        
        @keyframes float {
            0%, 100% { transform: translateX(-10px) scaleX(0.8); }
            50% { transform: translateX(10px) scaleX(1.2); }
        }
        
        /* Bottom DNA decoration */
        .dna-bottom {
            position: absolute;
            bottom: 80px;
            left: 20px;
            width: 100px;
            height: 60px;
            opacity: 0.08;
        }
        
        .dna-strand {
            position: absolute;
            width: 80px;
            height: 1px;
            background: white;
            border-radius: 1px;
            animation: wave 6s ease-in-out infinite;
        }
        
        .dna-strand:nth-child(1) { top: 20px; }
        .dna-strand:nth-child(2) { top: 40px; animation-delay: 1s; }
        
        @keyframes wave {
            0%, 100% { transform: rotate(5deg); }
            50% { transform: rotate(-5deg); }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="app-name">CodeXomics</h1>
        <p class="version">${VERSION_INFO.displayVersion} Beta</p>
        <p class="subtitle">AI-Powered Bioinformatics Platform</p>
    </div>
    
    <div class="drag-arrow">
        <span class="arrow-left">←</span>
        <div class="dots">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
        <span class="arrow-right">→</span>
    </div>
    
    <div class="icon-placeholder app-placeholder">
        App Icon
    </div>
    
    <div class="icon-placeholder apps-placeholder">
        Applications
    </div>
    
    <div class="drag-instruction">
        <p class="instruction-text">Drag the app icon to Applications folder to install</p>
    </div>
    
    <div class="dna-decoration">
        <div class="helix-line"></div>
        <div class="helix-line"></div>
        <div class="helix-line"></div>
    </div>
    
    <div class="dna-bottom">
        <div class="dna-strand"></div>
        <div class="dna-strand"></div>
    </div>
</body>
</html>`;

    // Save the HTML template
    const htmlPath = path.join(__dirname, '../build/dmg-background-template.html');
    fs.writeFileSync(htmlPath, html);
    
    console.log('✅ HTML template generated successfully:', htmlPath);
    console.log('📐 Dimensions:', DMG_WIDTH, 'x', DMG_HEIGHT);
    console.log('📝 Version:', VERSION_INFO.displayVersion);
    
    // Also generate instructions
    const instructions = `# DMG Background Generation Instructions

## Generated Files:
- HTML Template: ${htmlPath}

## To create the PNG background:

### Method 1: Using Browser Screenshot
1. Open the HTML file in a browser
2. Set browser window to exactly ${DMG_WIDTH}x${DMG_HEIGHT} pixels
3. Take a screenshot and save as 'dmg-background.png' in the build/ folder

### Method 2: Using Puppeteer (if available)
\`\`\`bash
npm install puppeteer
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({width: ${DMG_WIDTH}, height: ${DMG_HEIGHT}});
  await page.goto('file://${htmlPath.replace(/\\/g, '/')}');
  await page.screenshot({path: '${path.join(__dirname, '../build/dmg-background.png')}', fullPage: false});
  await browser.close();
})();
"
\`\`\`

### Method 3: Using wkhtmltopdf/wkhtmltoimage
\`\`\`bash
# Install wkhtmltopdf (includes wkhtmltoimage)
# macOS: brew install wkhtmltopdf
# Ubuntu: sudo apt-get install wkhtmltopdf

wkhtmltoimage --width ${DMG_WIDTH} --height ${DMG_HEIGHT} --format png "${htmlPath}" "${path.join(__dirname, '../build/dmg-background.png')}"
\`\`\`

## Version Information:
- App Name: ${VERSION_INFO.appName}
- Version: ${VERSION_INFO.displayVersion}
- Full Version: ${VERSION_INFO.fullVersion}

The HTML template automatically includes the current version information.
`;

    const instructionsPath = path.join(__dirname, '../build/DMG_GENERATION_INSTRUCTIONS.md');
    fs.writeFileSync(instructionsPath, instructions);
    
    console.log('📋 Instructions saved to:', instructionsPath);
    
    return { htmlPath, instructionsPath };
}

// Run the generator if called directly
if (require.main === module) {
    try {
        const { htmlPath, instructionsPath } = generateHTMLTemplate();
        
        console.log('\n🎨 DMG Background Template Generation Complete!');
        console.log('📂 Files generated:');
        console.log('   HTML Template:', htmlPath);
        console.log('   Instructions:', instructionsPath);
        console.log('\n💡 Next steps:');
        console.log('   1. Open the HTML file in a browser');
        console.log('   2. Screenshot at', DMG_WIDTH, 'x', DMG_HEIGHT, 'pixels');
        console.log('   3. Save as build/dmg-background.png');
        console.log('\n🚀 Version automatically included:', VERSION_INFO.displayVersion);
        
    } catch (error) {
        console.error('❌ Error generating DMG background template:', error.message);
        process.exit(1);
    }
}

module.exports = { generateHTMLTemplate };