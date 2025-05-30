# Genome Viewer - Build & Packaging Instructions

This guide explains how to package your Electron Genome Viewer app into installers for Mac, Windows, and Linux.

## Prerequisites

1. **Node.js and npm** (v16 or higher)
2. **Platform-specific requirements:**
   - **macOS**: Xcode Command Line Tools
   - **Windows**: No additional requirements
   - **Linux**: No additional requirements

## Quick Setup

1. Install dependencies:
```bash
npm install
```

2. Create app icons (see Icon Requirements section below)

## Build Commands

### Build for Current Platform
```bash
# Build installer for your current platform
npm run build

# Or use electron-builder directly
npx electron-builder
```

### Build for Specific Platforms
```bash
# Build for macOS (DMG + ZIP)
npm run build:mac

# Build for Windows (NSIS installer + Portable)
npm run build:win

# Build for Linux (AppImage, Snap, DEB, RPM)
npm run build:linux

# Build for all platforms
npm run build:all
```

### Development Builds (No installer, just packaged app)
```bash
# Package for current platform (no installer)
npm run pack

# Package for specific platforms
npm run pack:mac
npm run pack:win
npm run pack:linux
```

## Output Files

All built installers will be placed in the `dist/` directory:

### macOS
- `Genome Viewer-1.0.0.dmg` - DMG installer (recommended)
- `Genome Viewer-1.0.0-mac.zip` - ZIP archive
- Supports both Intel (x64) and Apple Silicon (arm64)

### Windows
- `Genome Viewer Setup 1.0.0.exe` - NSIS installer (recommended)
- `Genome Viewer 1.0.0.exe` - Portable executable
- Supports both 64-bit (x64) and 32-bit (ia32)

### Linux
- `Genome Viewer-1.0.0.AppImage` - AppImage (recommended, runs anywhere)
- `genome-viewer_1.0.0_amd64.snap` - Snap package
- `genome-viewer_1.0.0_amd64.deb` - Debian package
- `genome-viewer-1.0.0.x86_64.rpm` - RPM package

## Icon Requirements

You need to create app icons in multiple formats and place them in the `build/` directory:

### Required Icon Files

1. **macOS**: `build/icon.icns`
   - 1024x1024 pixels minimum
   - Apple Icon format (.icns)

2. **Windows**: `build/icon.ico`
   - Contains multiple sizes: 16x16, 32x32, 48x48, 256x256
   - Windows Icon format (.ico)

3. **Linux**: `build/icons/`
   - Create a folder with PNG files:
   - `16x16.png`, `32x32.png`, `48x48.png`, `64x64.png`, `128x128.png`, `256x256.png`, `512x512.png`

### Creating Icons from PNG

If you have a high-resolution PNG (1024x1024), you can convert it:

**For macOS (.icns):**
```bash
# Using built-in macOS tools
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
cp icon.png       icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
mv icon.icns build/
```

**For Windows (.ico):**
- Use online converters like [ConvertICO](https://convertio.co/png-ico/)
- Or use ImageMagick: `convert icon.png -resize 256x256 build/icon.ico`

**For Linux:**
```bash
# Create different sizes
mkdir -p build/icons
for size in 16 32 48 64 128 256 512; do
  sips -z $size $size icon.png --out build/icons/${size}x${size}.png
done
```

## Optional Assets

### DMG Background (macOS)
- Create `build/background.png` (540x380 pixels)
- Used as background image in the DMG installer

### App Store Requirements (if publishing)
- Update `appId` in package.json to your unique identifier
- Add proper code signing certificates
- Update author information

## Cross-Platform Building

### Building macOS apps on other platforms:
❌ Not possible - requires macOS

### Building Windows apps:
✅ Possible on all platforms (macOS, Linux, Windows)

### Building Linux apps:
✅ Possible on all platforms

## Code Signing (Production)

### macOS
```bash
# Set environment variables
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate_password"

# Build with signing
npm run build:mac
```

### Windows
```bash
# Set environment variables
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate_password"

# Build with signing
npm run build:win
```

## Publishing Options

You can configure auto-publishing to various platforms by modifying the `publish` section in package.json:

```json
"publish": [
  {
    "provider": "github",
    "owner": "yourusername",
    "repo": "electron-genome-viewer"
  }
]
```

## Troubleshooting

### Common Issues

1. **Node modules too large**: The build excludes test files and docs automatically
2. **Missing icons**: App will build but use default Electron icon
3. **Permission errors**: On macOS, run with `sudo` if needed
4. **Memory issues**: Use `--max_old_space_size=4096` for large apps

### Debug Build
```bash
# Enable debug output
DEBUG=electron-builder npm run build
```

### Clean Build
```bash
# Remove dist and node_modules, then reinstall
rm -rf dist node_modules
npm install
npm run build
```

## File Size Optimization

The current configuration excludes unnecessary files to reduce installer size:
- Development dependencies
- Documentation files
- Test files
- Cache directories
- Source maps

Total app size should be approximately:
- **macOS DMG**: ~150-200 MB
- **Windows NSIS**: ~100-150 MB  
- **Linux AppImage**: ~120-170 MB

## Distribution

After building, you can distribute your app by:

1. **Direct download**: Upload installers to your website
2. **GitHub Releases**: Attach to repository releases
3. **App Stores**: Submit to Mac App Store, Microsoft Store, Snap Store
4. **Package Managers**: Submit to Homebrew (Mac), Chocolatey (Windows), etc.

---

## Quick Reference

```bash
# Development
npm start                    # Run app in development
npm run dev                  # Run with dev flag

# Packaging
npm run pack                 # Package without installer
npm run build                # Build installer for current OS
npm run build:all           # Build for all platforms

# Platform-specific
npm run build:mac           # macOS DMG + ZIP
npm run build:win           # Windows NSIS + Portable
npm run build:linux         # Linux AppImage + DEB + RPM + Snap
``` 