# CodeXomics DMG Installation Interface Design Guide

## Design Philosophy

### 1. Clean and Elegant
- **Modern Gradient Background**: Uses brand blue-purple tones, professional yet gentle
- **Clean Layout**: Clear information hierarchy, avoiding visual distractions
- **Apple Design Language**: Follows native macOS design standards

### 2. Brand Consistency
- **Color System**: Maintains consistency with CodeXomics main brand colors
- **Font Selection**: Uses system font SF Pro Display
- **Icon Style**: Clean scientific element decorations

### 3. User Experience
- **Clear Guidance**: Explicit drag-and-drop installation instructions
- **Visual Guidance**: Arrows and dotted connection lines guide operations
- **Version Information**: Dynamically displays current version number

## Design Specifications

### Size Parameters
- **Window Size**: 660 x 420 pixels
- **Icon Positions**:
  - App Icon: (180, 210)
  - Applications Folder: (480, 210)
- **Icon Size**: 90 pixels

### Color Scheme
```css
/* Main gradient background */
background: linear-gradient(135deg, 
    #4A90E2 0%,     /* Professional Blue */
    #7B68EE 30%,    /* Medium Slate Blue */
    #9370DB 70%,    /* Medium Purple */
    #8A2BE2 100%    /* Blue Violet */
);

/* Text Colors */
Main Title: white (100% opacity)
Version Info: rgba(255,255,255,0.9)
Description Text: rgba(255,255,255,0.8)
Instruction Text: rgba(255,255,255,0.9)
```

### Font Specifications
```css
/* Main Title - CodeXomics */
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display'
font-size: 42px
font-weight: bold
text-shadow: 0 2px 8px rgba(0,0,0,0.3)

/* Version Information */
font-size: 18px
font-weight: 300

/* Description Text */
font-size: 16px
font-weight: 300

/* Installation Instructions */
font-size: 16px
font-weight: 400
```

## Automatic Version Update Mechanism

### Implementation Principle
1. **Version Source**: Reads version information from `src/version.js`
2. **Dynamic Generation**: Automatically generates background with current version during build
3. **Build Integration**: Integrated into npm build scripts

### Build Process
```bash
# Generate DMG background template
npm run generate-dmg-bg

# macOS build (automatically generates background)
npm run build:mac

# Multi-platform build
npm run build:all
```

### Version Information Display
- **Main Version**: v0.522beta
- **Full Version**: 0.522.0-beta
- **Auto Sync**: Stays consistent with package.json and version.js

## Decorative Elements

### DNA Helix Decoration
- **Position**: Top-right and bottom-left corners
- **Style**: Semi-transparent white lines
- **Animation**: Subtle floating effects
- **Meaning**: Reflects bioinformatics characteristics

### Texture Effects
- **Noise Texture**: Adds subtle grain texture
- **Transparency**: Very low transparency for premium feel
- **Distribution**: Random dot distribution

### Visual Guidance
- **Drag Arrows**: Bidirectional arrows + dotted connections
- **Icon Placeholders**: Dashed circles mark positions
- **Text Shadows**: Enhance readability

## File Structure

```
build/
├── dmg-background.png          # Final background image
├── dmg-background-template.html # HTML template (auto-generated)
├── DMG_DESIGN_GUIDE.md        # This design guide
└── DMG_GENERATION_INSTRUCTIONS.md # Generation instructions

scripts/
├── create-simple-dmg-background.js # Background generation script
├── generate-dmg-background-svg.js  # SVG generation script
└── generate-dmg-background.js      # Canvas generation script
```

## Generation Steps

### 1. Automatic Generation (Recommended)
```bash
# Generate HTML template
npm run generate-dmg-bg

# Build macOS version (automatically generates background)
npm run build:mac
```

### 2. Manual Generation
1. Run script to generate HTML template
2. Open template file in browser
3. Adjust window size to 660x420 pixels
4. Screenshot and save as `build/dmg-background.png`

### 3. Tool-based Generation
```bash
# Using Puppeteer (requires installation)
npm install puppeteer
# Then use commands from generated documentation

# Using wkhtmltoimage (requires installation)
brew install wkhtmltopdf
# Then follow documentation instructions
```

## Design Principles

### 1. Simplicity
- Avoid excessive decorative elements
- Clear information hierarchy
- Prominent visual focus

### 2. Professionalism
- Professional feel for scientific research field
- Modern software quality
- Consistent brand image

### 3. Usability
- Installation steps at a glance
- Clear visual guidance
- Simple user operations

### 4. Maintainability
- Automatic version information updates
- Automated build process
- Configurable design parameters

## Update History

- **v0.522beta**: Redesigned clean and elegant installation interface
- Implemented automatic version number update mechanism
- Adopted modern macOS design language
- Added bioinformatics-themed decorative elements

## Technical Implementation

### HTML + CSS Solution
- Uses modern CSS features
- Supports gradients and shadow effects
- Responsive fonts and layouts
- Automatically reads version information

### Build Integration
- Integrated into electron-builder workflow
- Automatically triggers background generation
- Version information synchronized updates
- Cross-platform compatibility

This design solution ensures that CodeXomics' macOS installation interface is both clean and elegant, while automatically updating version information to provide users with a professional first impression.