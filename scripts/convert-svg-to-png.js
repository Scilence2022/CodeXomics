#!/usr/bin/env node

/**
 * SVG to PNG Converter for DMG Background
 * 
 * Simple and reliable SVG to PNG conversion using sharp
 * 
 * @author CodeXomics Team
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '../build/dmg-background.svg');
const TIFF_PATH = path.join(__dirname, '../build/background.tiff');
const TIFF_RETINA_PATH = path.join(__dirname, '../build/background@2x.tiff');

/**
 * Convert SVG to TIFF for DMG Background (Native Format)
 */
async function convertSVGToTIFF() {
    try {
        console.log('🔄 Converting SVG to TIFF for maximum DMG compatibility...');

        // Check if SVG file exists
        if (!fs.existsSync(SVG_PATH)) {
            throw new Error(`SVG file not found: ${SVG_PATH}`);
        }

        // Function to generate TIFF at specific size
        const generateTIFF = async (outputPath, width, height, density) => {
            await sharp(SVG_PATH, {
                density: density
            })
                .flatten({ background: { r: 46, g: 79, b: 140 } })
                .resize(width, height, {
                    fit: 'fill',
                    position: 'center',
                    background: { r: 46, g: 79, b: 140 }
                })
                .tiff({
                    compression: 'lzw',
                    xres: 72,
                    yres: 72
                })
                .toFile(outputPath);

            const stats = fs.statSync(outputPath);
            console.log(`✅ Generated ${path.basename(outputPath)} (${(stats.size / 1024).toFixed(2)} KB)`);
        };

        // Generate 1x version (standard)
        await generateTIFF(TIFF_PATH, 660, 420, 72);

        // Generate 2x version (retina)
        await generateTIFF(TIFF_RETINA_PATH, 1320, 840, 144);

        console.log('🎉 TIFF conversion completed successfully!');

    } catch (error) {
        console.error('❌ SVG to TIFF conversion failed:', error.message);
        throw error;
    }
}

// Run conversion if called directly
if (require.main === module) {
    convertSVGToTIFF()
        .then(() => {
            process.exit(0);
        })
        .catch((error) => {
            console.error('Error:', error);
            process.exit(1);
        });
}

module.exports = { convertSVGToTIFF };