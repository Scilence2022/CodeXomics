const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Convert HTML to PNG using built-in tools
async function generateDMGBackgroundPNG() {
  try {
    console.log('Starting DMG background PNG generation...');
    
    const htmlPath = path.join(__dirname, '../build/dmg-background-template.html');
    const outputPath = path.join(__dirname, '../build/dmg-background.png');
    
    // Check if wkhtmltoimage is available
    const wkhtmltoimage = spawn('which', ['wkhtmltoimage']);
    
    wkhtmltoimage.on('close', async (code) => {
      if (code === 0) {
        // Use wkhtmltoimage
        console.log('Using wkhtmltoimage for PNG generation...');
        const convert = spawn('wkhtmltoimage', [
          '--width', '660',
          '--height', '420',
          '--disable-plugins',
          '--disable-javascript',
          htmlPath,
          outputPath
        ]);
        
        convert.on('close', (convertCode) => {
          if (convertCode === 0) {
            console.log('✅ DMG background PNG generated successfully:', outputPath);
          } else {
            console.error('❌ Error with wkhtmltoimage conversion');
            generateSimplePNG();
          }
        });
      } else {
        // Fallback to simple method
        console.log('wkhtmltoimage not found, using simple method...');
        generateSimplePNG();
      }
    });
    
  } catch (error) {
    console.error('❌ Error generating DMG background PNG:', error);
    generateSimplePNG();
  }
}

// Simple PNG generation without external dependencies
function generateSimplePNG() {
  try {
    console.log('Creating simple PNG placeholder...');
    
    // Create a simple PNG data manually (this is a basic approach)
    const outputPath = path.join(__dirname, '../build/dmg-background.png');
    
    // For now, let's create a message file that indicates manual generation is needed
    const messageContent = `# DMG Background Generation

To generate the PNG file, please use one of these methods:

## Method 1: Install puppeteer
\`\`\`bash
npm install puppeteer
node scripts/generate-dmg-background-png.js
\`\`\`

## Method 2: Install canvas
\`\`\`bash
npm install canvas
\`\`\`

## Method 3: Manual screenshot
1. Open build/dmg-background-template.html in a browser
2. Set browser window to 660x420 pixels
3. Take a screenshot and save as build/dmg-background.png

## Method 4: Use existing SVG
The SVG file has been generated at: build/dmg-background.svg
You can convert it to PNG using online tools or:
\`\`\`bash
# If you have ImageMagick installed:
convert build/dmg-background.svg build/dmg-background.png

# If you have Inkscape installed:
inkscape --export-png=build/dmg-background.png --export-width=660 --export-height=420 build/dmg-background.svg
\`\`\`
`;
    
    fs.writeFileSync(path.join(__dirname, '../build/DMG_PNG_GENERATION_GUIDE.md'), messageContent);
    console.log('📝 Created generation guide: build/DMG_PNG_GENERATION_GUIDE.md');
    console.log('✅ SVG file is ready to use: build/dmg-background.svg');
    
  } catch (error) {
    console.error('❌ Error creating generation guide:', error);
  }
}

// Alternative method using canvas for environments without puppeteer
async function generateDMGBackgroundPNGCanvas() {
  try {
    const { createCanvas } = require('canvas');
    const canvas = createCanvas(660, 420);
    const ctx = canvas.getContext('2d');
    
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 660, 420);
    gradient.addColorStop(0, '#4A90E2');
    gradient.addColorStop(0.3, '#7B68EE');
    gradient.addColorStop(0.7, '#9370DB');
    gradient.addColorStop(1, '#8A2BE2');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 660, 420);
    
    // Add text
    ctx.fillStyle = 'white';
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, SF Pro Display, Helvetica Neue, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillText('CodeXomics', 330, 90);
    
    ctx.font = '300 18px -apple-system, BlinkMacSystemFont, SF Pro Display, Helvetica Neue, sans-serif';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    ctx.fillText('v0.522beta Beta', 330, 115);
    
    ctx.font = '300 16px -apple-system, BlinkMacSystemFont, SF Pro Display, Helvetica Neue, sans-serif';
    ctx.fillText('AI-Powered Bioinformatics Platform', 330, 135);
    
    // Add placeholders (simplified)
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    
    // App icon placeholder
    ctx.strokeRect(130, 160, 100, 100);
    ctx.font = '12px -apple-system, BlinkMacSystemFont, SF Pro Display, Helvetica Neue, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText('App Icon', 180, 215);
    
    // Applications placeholder
    ctx.strokeRect(430, 160, 100, 100);
    ctx.fillText('Applications', 480, 215);
    
    // Drag instruction
    ctx.font = '400 16px -apple-system, BlinkMacSystemFont, SF Pro Display, Helvetica Neue, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('Drag the app icon to Applications folder to install', 330, 380);
    
    // Drag arrow (simplified)
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = 'bold 24px -apple-system';
    ctx.fillText('← ••• →', 330, 215);
    
    // Save canvas to PNG
    const outputPath = path.join(__dirname, '../build/dmg-background.png');
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    
    console.log('✅ DMG background PNG generated successfully (Canvas method):', outputPath);
    
  } catch (error) {
    console.error('❌ Error generating DMG background PNG with Canvas:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  generateDMGBackgroundPNG();
}