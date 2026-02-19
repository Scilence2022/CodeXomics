#!/usr/bin/env node

/**
 * Dynamic DMG Background Generator for CodeXomics
 * 
 * This script generates a modern, clean DMG background image with
 * automatically updated version information from version.js
 * 
 * @author CodeXomics Team
 */

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

// Import version information
const VERSION_INFO = require('../src/version.js');

const DMG_WIDTH = 660;
const DMG_HEIGHT = 420;

/**
 * Generate modern DMG background with dynamic version info
 */
async function generateDMGBackground() {
    console.log('🎨 Generating DMG background for CodeXomics', VERSION_INFO.displayVersion);
    
    const canvas = createCanvas(DMG_WIDTH, DMG_HEIGHT);
    const ctx = canvas.getContext('2d');
    
    // Modern gradient background - CodeXomics brand colors
    const gradient = ctx.createLinearGradient(0, 0, DMG_WIDTH, DMG_HEIGHT);
    gradient.addColorStop(0, '#4A90E2');      // Professional blue
    gradient.addColorStop(0.3, '#7B68EE');   // Medium slate blue  
    gradient.addColorStop(0.7, '#9370DB');   // Medium purple
    gradient.addColorStop(1, '#8A2BE2');     // Blue violet
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, DMG_WIDTH, DMG_HEIGHT);
    
    // Subtle noise/texture overlay for premium look
    addNoiseTexture(ctx);
    
    // DNA helix pattern - subtle background decoration
    drawDNAPattern(ctx);
    
    // Main title - CodeXomics
    ctx.fillStyle = 'white';
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "SF Pro Display"';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.fillText('CodeXomics', DMG_WIDTH / 2, 80);
    
    // Subtitle - version and description
    ctx.font = '300 18px -apple-system, BlinkMacSystemFont, "SF Pro Display"';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowBlur = 2;
    ctx.fillText(`${VERSION_INFO.displayVersion} Beta`, DMG_WIDTH / 2, 110);
    
    ctx.font = '300 16px -apple-system, BlinkMacSystemFont, "SF Pro Display"';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText('AI-Powered Bioinformatics Platform', DMG_WIDTH / 2, 135);
    
    // Installation instruction
    ctx.font = '400 16px -apple-system, BlinkMacSystemFont, "SF Pro Display"';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.shadowBlur = 1;
    ctx.fillText('Drag the app icon to Applications folder to install', DMG_WIDTH / 2, DMG_HEIGHT - 40);
    
    // Drag arrow indicator
    drawDragArrow(ctx);
    
    // Logo placeholder circles (where icons will be positioned)
    drawIconPlaceholders(ctx);
    
    // Save the generated background
    const buffer = canvas.toBuffer('image/png');
    const outputPath = path.join(__dirname, '../build/dmg-background.png');
    fs.writeFileSync(outputPath, buffer);
    
    console.log('✅ DMG background generated successfully:', outputPath);
    console.log('📐 Dimensions:', DMG_WIDTH, 'x', DMG_HEIGHT);
    console.log('📝 Version:', VERSION_INFO.displayVersion);
    
    return outputPath;
}

/**
 * Add subtle noise texture for premium look
 */
function addNoiseTexture(ctx) {
    const imageData = ctx.createImageData(DMG_WIDTH, DMG_HEIGHT);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 4) {
        const noise = Math.random() * 10 - 5; // -5 to +5
        data[i] = Math.min(255, Math.max(0, data[i] + noise));     // R
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise)); // G
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise)); // B
        data[i + 3] = 8; // Very subtle alpha
    }
    
    ctx.globalCompositeOperation = 'overlay';
    ctx.putImageData(imageData, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
}

/**
 * Draw subtle DNA helix pattern
 */
function drawDNAPattern(ctx) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    
    // Draw DNA helix - top right corner
    ctx.beginPath();
    for (let x = 0; x < 100; x += 2) {
        const y1 = 50 + Math.sin(x * 0.1) * 15;
        const y2 = 50 + Math.sin(x * 0.1 + Math.PI) * 15;
        ctx.moveTo(DMG_WIDTH - 120 + x, y1);
        ctx.lineTo(DMG_WIDTH - 120 + x + 2, y1);
        ctx.moveTo(DMG_WIDTH - 120 + x, y2);
        ctx.lineTo(DMG_WIDTH - 120 + x + 2, y2);
    }
    ctx.stroke();
    
    // Draw connection lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < 100; x += 10) {
        const y1 = 50 + Math.sin(x * 0.1) * 15;
        const y2 = 50 + Math.sin(x * 0.1 + Math.PI) * 15;
        ctx.beginPath();
        ctx.moveTo(DMG_WIDTH - 120 + x, y1);
        ctx.lineTo(DMG_WIDTH - 120 + x, y2);
        ctx.stroke();
    }
}

/**
 * Draw drag arrow indicator
 */
function drawDragArrow(ctx) {
    const centerX = DMG_WIDTH / 2;
    const centerY = DMG_HEIGHT / 2 + 20;
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2;
    
    // Left arrow
    ctx.beginPath();
    ctx.moveTo(centerX - 60, centerY);
    ctx.lineTo(centerX - 40, centerY - 8);
    ctx.moveTo(centerX - 60, centerY);
    ctx.lineTo(centerX - 40, centerY + 8);
    ctx.moveTo(centerX - 60, centerY);
    ctx.lineTo(centerX - 20, centerY);
    ctx.stroke();
    
    // Right arrow
    ctx.beginPath();
    ctx.moveTo(centerX + 60, centerY);
    ctx.lineTo(centerX + 40, centerY - 8);
    ctx.moveTo(centerX + 60, centerY);
    ctx.lineTo(centerX + 40, centerY + 8);
    ctx.moveTo(centerX + 60, centerY);
    ctx.lineTo(centerX + 20, centerY);
    ctx.stroke();
    
    // Dots in the middle
    for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(centerX - 5 + i * 5, centerY, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

/**
 * Draw icon placeholder circles
 */
function drawIconPlaceholders(ctx) {
    // App icon placeholder (left side)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(180, DMG_HEIGHT / 2, 50, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Applications folder placeholder (right side)
    ctx.beginPath();
    ctx.arc(480, DMG_HEIGHT / 2, 50, 0, Math.PI * 2);
    ctx.stroke();
}

// Run the generator if called directly
if (require.main === module) {
    // Check if canvas package is available
    try {
        require('canvas');
    } catch (error) {
        console.log('⚠️  Canvas package not found. Installing...');
        console.log('Run: npm install canvas');
        console.log('Note: This requires native dependencies. On macOS: brew install pkg-config cairo pango libpng jpeg giflib librsvg');
        process.exit(1);
    }
    
    generateDMGBackground().catch(console.error);
}

module.exports = { generateDMGBackground };