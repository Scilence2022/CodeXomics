# DMG Assets Setup Instructions

## Generated Files
- `dmg-background-template.html` - Template for DMG background

## Manual Steps Required

### 1. Create Icon (macOS only)
```bash
# Convert PNG to ICNS (requires macOS)
mkdir -p icon.iconset
sips -z 16 16     assets/icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     assets/icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     assets/icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     assets/icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   assets/icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   assets/icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   assets/icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   assets/icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   assets/icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 assets/icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o build/icon.icns
rm -rf icon.iconset
```

### 2. Create DMG Background
1. Open `build/dmg-background-template.html` in a browser
2. Set browser window to exactly 660x420 pixels
3. Take a screenshot and save as `build/dmg-background.png`

### 3. Alternative: Use Figma/Design Tool
Create a 660x420 background with:
- Gradient background (brand colors)
- App name and version
- "Drag to Applications" instruction
- Subtle branding elements

## Build Command
After creating the assets:
```bash
npm run build:mac
```

## DMG Configuration
The package.json has been updated with:
- Larger window size (660x420)
- Better icon positioning
- Background image support
- Improved title and naming
