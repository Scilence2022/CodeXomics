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
const PNG_PATH = path.join(__dirname, '../build/dmg-background.png');

/**
 * Convert SVG to PNG using sharp
 */
async function convertSVGToPNG() {
    try {
        console.log('🔄 Converting SVG to PNG for DMG compatibility...');
        
        // Check if SVG file exists
        if (!fs.existsSync(SVG_PATH)) {
            throw new Error(`SVG file not found: ${SVG_PATH}`);
        }
        
        // Convert SVG to PNG with high quality
        // Use 72 DPI for screen display (DMG uses screen resolution, not print resolution)
        await sharp(SVG_PATH, {
            density: 72  // Screen DPI for proper DMG display
        })
            .flatten({ background: { r: 46, g: 79, b: 140 } })  // Flatten with deep blue background
            .resize(660, 420, {
                fit: 'fill',  // Fill exact dimensions
                position: 'center',
                background: { r: 46, g: 79, b: 140 }  // Deep blue background #2E4F8C
            })
            .png({
                quality: 100,
                compressionLevel: 6
            })
            .toFile(PNG_PATH);
        
        console.log('✅ Successfully converted using sharp');
        console.log('🎉 PNG conversion completed successfully!');
        console.log('📄 Output file:', PNG_PATH);
        
        // Validate the output
        const stats = fs.statSync(PNG_PATH);
        console.log('📊 File size:', (stats.size / 1024).toFixed(2), 'KB');
        
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