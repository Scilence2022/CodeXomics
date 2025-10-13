#!/usr/bin/env node

/**
 * SVG to PNG Converter for DMG Background
 * 
 * Converts the generated SVG background to PNG for better DMG compatibility
 * Uses multiple fallback methods to ensure reliability without heavy dependencies
 * 
 * @author CodeXomics Team
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const SVG_PATH = path.join(__dirname, '../build/dmg-background.svg');
const PNG_PATH = path.join(__dirname, '../build/dmg-background.png');

/**
 * Try to convert SVG to PNG using available system tools
 */
async function convertSVGToPNG() {
    console.log('🔄 Converting SVG to PNG for DMG compatibility...');
    
    // Check if SVG file exists
    if (!fs.existsSync(SVG_PATH)) {
        throw new Error(`SVG file not found: ${SVG_PATH}`);
    }
    
    // Method 1: Try ImageMagick (convert command)
    try {
        await tryImageMagick();
        return;
    } catch (error) {
        console.log('⚠️  ImageMagick method 1 failed:', error.message);
    }
    
    // Method 1b: Try ImageMagick with solid background fallback
    try {
        await tryImageMagickWithBackground();
        return;
    } catch (error) {
        console.log('⚠️  ImageMagick method 2 failed:', error.message);
    }
    
    // Method 2: Try Inkscape
    try {
        await tryInkscape();
        return;
    } catch (error) {
        console.log('⚠️  Inkscape not available:', error.message);
    }
    
    // Method 3: Try rsvg-convert (librsvg)
    try {
        await tryRSVGConvert();
        return;
    } catch (error) {
        console.log('⚠️  rsvg-convert not available:', error.message);
    }
    
    // Method 4: Try online conversion service (last resort)
    try {
        await tryOnlineConversion();
        return;
    } catch (error) {
        console.log('⚠️  Online conversion failed:', error.message);
    }
    
    // Method 5: Fallback - create installation guide
    createInstallationGuide();
}

/**
 * Try ImageMagick convert command with solid background
 */
function tryImageMagickWithBackground() {
    return new Promise((resolve, reject) => {
        // Use solid background to ensure gradients render properly
        const cmd = `convert "${SVG_PATH}" -background "#4A90E2" -flatten -density 300 -resize 660x420! "${PNG_PATH}"`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(new Error('ImageMagick with background command failed'));
                return;
            }
            if (fs.existsSync(PNG_PATH)) {
                console.log('✅ Successfully converted using ImageMagick with background');
                resolve();
            } else {
                reject(new Error('ImageMagick with background did not create output file'));
            }
        });
    });
}

/**
 * Try ImageMagick convert command
 */
function tryImageMagick() {
    return new Promise((resolve, reject) => {
        // Use improved ImageMagick settings to preserve gradients and background
        const cmd = `convert "${SVG_PATH}" -background none -density 300 -resize 660x420! "${PNG_PATH}"`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(new Error('ImageMagick convert command failed'));
                return;
            }
            if (fs.existsSync(PNG_PATH)) {
                console.log('✅ Successfully converted using ImageMagick');
                resolve();
            } else {
                reject(new Error('ImageMagick did not create output file'));
            }
        });
    });
}

/**
 * Try Inkscape command
 */
function tryInkscape() {
    return new Promise((resolve, reject) => {
        const cmd = `inkscape --export-png="${PNG_PATH}" --export-width=660 --export-height=420 --export-background-opacity=1 "${SVG_PATH}"`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(new Error('Inkscape command failed'));
                return;
            }
            if (fs.existsSync(PNG_PATH)) {
                console.log('✅ Successfully converted using Inkscape');
                resolve();
            } else {
                reject(new Error('Inkscape did not create output file'));
            }
        });
    });
}

/**
 * Try rsvg-convert (librsvg)
 */
function tryRSVGConvert() {
    return new Promise((resolve, reject) => {
        const cmd = `rsvg-convert -w 660 -h 420 -f png -o "${PNG_PATH}" "${SVG_PATH}"`;
        exec(cmd, (error, stdout, stderr) => {
            if (error) {
                reject(new Error('rsvg-convert command failed'));
                return;
            }
            if (fs.existsSync(PNG_PATH)) {
                console.log('✅ Successfully converted using rsvg-convert');
                resolve();
            } else {
                reject(new Error('rsvg-convert did not create output file'));
            }
        });
    });
}

/**
 * Try online conversion service (fallback)
 */
async function tryOnlineConversion() {
    // For now, this is a placeholder - we could implement a simple HTTP request
    // to a conversion service, but it's better to avoid external dependencies
    throw new Error('Online conversion not implemented');
}

/**
 * Create installation guide as fallback
 */
function createInstallationGuide() {
    const guide = `# SVG to PNG Conversion Guide

The SVG background was generated successfully, but automatic PNG conversion failed.
Please convert manually using one of these methods:

## Method 1: Install ImageMagick
\`\`\`bash
# macOS
brew install imagemagick

# Then convert
convert "${SVG_PATH}" -background transparent -density 150 "${PNG_PATH}"
\`\`\`

## Method 2: Install Inkscape
\`\`\`bash
# macOS
brew install inkscape

# Then convert
inkscape --export-png="${PNG_PATH}" --export-width=660 --export-height=420 "${SVG_PATH}"
\`\`\`

## Method 3: Install librsvg
\`\`\`bash
# macOS
brew install librsvg

# Then convert
rsvg-convert -w 660 -h 420 -f png -o "${PNG_PATH}" "${SVG_PATH}"
\`\`\`

## Method 4: Online Conversion
1. Open ${SVG_PATH} in a web browser
2. Take a screenshot at 660x420 resolution
3. Save as ${PNG_PATH}

## Method 5: Use Online Tools
1. Visit https://cloudconvert.com/svg-to-png
2. Upload ${SVG_PATH}
3. Download and save as ${PNG_PATH}

After conversion, run the build command again.
`;

    const guidePath = path.join(__dirname, '../build/SVG_TO_PNG_CONVERSION_GUIDE.md');
    fs.writeFileSync(guidePath, guide);
    
    console.log('📋 Created conversion guide:', guidePath);
    console.log('💡 Please install one of the conversion tools and run the conversion manually');
    console.log('🔧 Recommended: brew install imagemagick');
}

/**
 * Check if PNG file exists and is valid
 */
function validatePNGFile() {
    if (!fs.existsSync(PNG_PATH)) {
        return false;
    }
    
    const stats = fs.statSync(PNG_PATH);
    return stats.size > 1000; // Basic size check
}

// Run conversion if called directly
if (require.main === module) {
    convertSVGToPNG()
        .then(() => {
            if (validatePNGFile()) {
                console.log('🎉 PNG conversion completed successfully!');
                console.log('📄 Output file:', PNG_PATH);
            } else {
                console.log('❌ PNG conversion may have failed - file missing or too small');
                process.exit(1);
            }
        })
        .catch((error) => {
            console.error('❌ SVG to PNG conversion failed:', error.message);
            process.exit(1);
        });
}

module.exports = { convertSVGToPNG, validatePNGFile };