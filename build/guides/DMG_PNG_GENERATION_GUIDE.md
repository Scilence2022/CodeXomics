# DMG Background Generation

To generate the PNG file, please use one of these methods:

## Method 1: Install puppeteer
```bash
npm install puppeteer
node scripts/generate-dmg-background-png.js
```

## Method 2: Install canvas
```bash
npm install canvas
```

## Method 3: Manual screenshot
1. Open build/dmg-background-template.html in a browser
2. Set browser window to 660x420 pixels
3. Take a screenshot and save as build/dmg-background.png

## Method 4: Use existing SVG
The SVG file has been generated at: build/dmg-background.svg
You can convert it to PNG using online tools or:
```bash
# If you have ImageMagick installed:
convert build/dmg-background.svg build/dmg-background.png

# If you have Inkscape installed:
inkscape --export-png=build/dmg-background.png --export-width=660 --export-height=420 build/dmg-background.svg
```
