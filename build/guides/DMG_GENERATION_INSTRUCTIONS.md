# DMG Background Generation Instructions

## Generated Files:
- HTML Template: /Users/song/Github-Repos/GenomeAIStudio/build/dmg-background-template.html

## To create the PNG background:

### Method 1: Using Browser Screenshot
1. Open the HTML file in a browser
2. Set browser window to exactly 660x420 pixels
3. Take a screenshot and save as 'dmg-background.png' in the build/ folder

### Method 2: Using Puppeteer (if available)
```bash
npm install puppeteer
node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({width: 660, height: 420});
  await page.goto('file:///Users/song/Github-Repos/GenomeAIStudio/build/dmg-background-template.html');
  await page.screenshot({path: '/Users/song/Github-Repos/GenomeAIStudio/build/dmg-background.png', fullPage: false});
  await browser.close();
})();
"
```

### Method 3: Using wkhtmltopdf/wkhtmltoimage
```bash
# Install wkhtmltopdf (includes wkhtmltoimage)
# macOS: brew install wkhtmltopdf
# Ubuntu: sudo apt-get install wkhtmltopdf

wkhtmltoimage --width 660 --height 420 --format png "/Users/song/Github-Repos/GenomeAIStudio/build/dmg-background-template.html" "/Users/song/Github-Repos/GenomeAIStudio/build/dmg-background.png"
```

## Version Information:
- App Name: CodeXomics
- Version: v0.522beta
- Full Version: 0.522.0-beta

The HTML template automatically includes the current version information.
