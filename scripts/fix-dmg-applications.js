#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function fixDMGApplications() {
  const distDir = path.join(__dirname, '..', 'dist');
  const dmgFiles = fs.readdirSync(distDir).filter(file => file.endsWith('.dmg'));
  
  for (const dmgFile of dmgFiles) {
    const dmgPath = path.join(distDir, dmgFile);
    console.log(`Processing ${dmgFile}...`);
    
    try {
      // Mount the DMG
      const mountOutput = execSync(`hdiutil attach "${dmgPath}" -readonly`, { encoding: 'utf8' });
      const mountPoint = mountOutput.split('\n').find(line => line.includes('/Volumes/')).split('\t')[2];
      
      if (!mountPoint) {
        console.log(`Could not find mount point for ${dmgFile}`);
        continue;
      }
      
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
      
      // Try to unmount if there was an error
      try {
        execSync(`hdiutil detach "${mountPoint}"`);
      } catch (unmountError) {
        // Ignore unmount errors
      }
    }
  }
}

if (require.main === module) {
  fixDMGApplications();
}

module.exports = { fixDMGApplications };
