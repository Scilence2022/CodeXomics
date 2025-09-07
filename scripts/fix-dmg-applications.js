#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function fixDMGApplications() {
  const distDir = path.join(__dirname, '..', 'dist');
  
  if (!fs.existsSync(distDir)) {
    console.log('Dist directory does not exist, skipping DMG processing');
    return;
  }
  
  const dmgFiles = fs.readdirSync(distDir).filter(file => file.endsWith('.dmg'));
  
  if (dmgFiles.length === 0) {
    console.log('No DMG files found in dist directory');
    return;
  }
  
  console.log(`Found ${dmgFiles.length} DMG file(s) to process`);
  
  for (const dmgFile of dmgFiles) {
    const dmgPath = path.join(distDir, dmgFile);
    console.log(`Processing ${dmgFile}...`);
    
    let mountPoint = null;
    
    try {
      // Check if DMG is already mounted
      try {
        const mountCheck = execSync(`hdiutil info | grep "${dmgFile}"`, { encoding: 'utf8' });
        if (mountCheck.trim()) {
          console.log(`${dmgFile} is already mounted, skipping`);
          continue;
        }
      } catch (grepError) {
        // grep returns exit code 1 when no matches found, which is normal
        // Continue with mounting if no matches found
      }
      
      // Mount the DMG as read-write to allow modifications
      const mountOutput = execSync(`hdiutil attach "${dmgPath}" -readwrite -nobrowse`, { encoding: 'utf8' });
      const mountLine = mountOutput.split('\n').find(line => line.includes('/Volumes/'));
      
      if (!mountLine) {
        console.log(`Could not find mount point for ${dmgFile}`);
        continue;
      }
      
      mountPoint = mountLine.split('\t').pop().trim();
      console.log(`Mounted at: ${mountPoint}`);
      
      // Check if Applications link already exists
      const applicationsPath = path.join(mountPoint, 'Applications');
      
      if (fs.existsSync(applicationsPath)) {
        console.log(`Applications link already exists in ${dmgFile}`);
        // Unmount and continue
        execSync(`hdiutil detach "${mountPoint}"`);
        continue;
      }
      
      // Create Applications symlink
      execSync(`ln -s /Applications "${applicationsPath}"`);
      console.log(`Created Applications symlink in ${dmgFile}`);
      
      // Unmount the DMG
      execSync(`hdiutil detach "${mountPoint}"`);
      console.log(`Successfully processed ${dmgFile}`);
      
    } catch (error) {
      console.error(`Error processing ${dmgFile}:`, error.message);
      
      // Try to unmount if there was an error and we have a mount point
      if (mountPoint) {
        try {
          execSync(`hdiutil detach "${mountPoint}"`);
          console.log(`Unmounted ${mountPoint} after error`);
        } catch (unmountError) {
          console.log(`Could not unmount ${mountPoint}: ${unmountError.message}`);
        }
      }
    }
  }
}

if (require.main === module) {
  fixDMGApplications();
}

module.exports = { fixDMGApplications };
