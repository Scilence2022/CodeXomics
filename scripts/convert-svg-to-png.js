#!/usr/bin/env node

/**
 * SVG to PNG Converter for DMG Background
 * 
 * Converts SVG to PNG format for maximum DMG compatibility
 * PNG format has better universal support than TIFF on modern macOS
 * 
 * @author CodeXomics Team
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '../build/dmg-background.svg');
const PNG_PATH = path.join(__dirname, '../build/background.png');
const PNG_RETINA_PATH = path.join(__dirname, '../build/background@2x.png');

/**
 * Convert SVG to PNG for DMG Background
 */
async function convertSVGToPNG() {
    try {
        console.log('🔄 Converting SVG to PNG for maximum DMG compatibility...');

        // Check if SVG file exists
        if (!fs.existsSync(SVG_PATH)) {
            throw new Error(`SVG file not found: ${SVG_PATH}`);
        }

        // Function to generate PNG at specific size
        const generatePNG = async (outputPath, width, height, density) => {
            await sharp(SVG_PATH, {
                density: density
            })
                .flatten({ background: { r: 46, g: 79, b: 140 } })
                .resize(width, height, {
                    fit: 'fill',
                    position: 'center',
                    background: { r: 46, g: 79, b: 140 }
                })
                .png({
                    compressionLevel: 9,
                    quality: 100
                })
                .toFile(outputPath);

            const stats = fs.statSync(outputPath);
            console.log(`✅ Generated ${path.basename(outputPath)} (${(stats.size / 1024).toFixed(2)} KB)`);
        };

        // Generate 1x version (standard)
        await generatePNG(PNG_PATH, 660, 420, 72);

        // Generate 2x version (retina)
        await generatePNG(PNG_RETINA_PATH, 1320, 840, 144);

        console.log('🎉 PNG conversion completed successfully!');

    } catch (error) {
        console.error('❌ SVG to PNG conversion failed:', error.message);
        throw error;
    }
}

// Run conversion if called directly
if (require.main === module) {
    convertSVGToPNG()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = { convertSVGToPNG };