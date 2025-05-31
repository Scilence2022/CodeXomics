#!/bin/bash

# Create app icons from new_icon_design-Song.svg
echo "Creating app icons from new_icon_design-Song.svg..."

ICON_SVG="new_icon_design-Song.svg"

if [ ! -f "$ICON_SVG" ]; then
    echo "❌ Error: $ICON_SVG not found! Please ensure the SVG icon design exists."
    exit 1
fi

# Convert SVG to PNG using qlmanage (macOS built-in)
if command -v qlmanage &> /dev/null; then
    qlmanage -t -s 1024 -o . "$ICON_SVG"
    # qlmanage adds .png to the original filename.svg
    if [ -f "${ICON_SVG}.png" ]; then
        mv "${ICON_SVG}.png" icon_1024.png
        echo "✓ Created base PNG icon (icon_1024.png)"
    else
        echo "❌ qlmanage failed to create PNG from SVG."
        exit 1
    fi
else
    echo "❌ qlmanage not available. Cannot convert SVG to PNG automatically on this system."
    echo "Please manually convert $ICON_SVG to a 1024x1024 PNG named icon_1024.png"
    exit 1
fi

# Check if we have the base PNG
if [ -f "icon_1024.png" ]; then
    # Create macOS icns
    echo "Creating macOS .icns..."
    mkdir -p icon.iconset
    sips -z 16 16     icon_1024.png --out icon.iconset/icon_16x16.png
    sips -z 32 32     icon_1024.png --out icon.iconset/icon_16x16@2x.png # For 16x16@2x
    sips -z 32 32     icon_1024.png --out icon.iconset/icon_32x32.png
    sips -z 64 64     icon_1024.png --out icon.iconset/icon_32x32@2x.png # For 32x32@2x
    sips -z 128 128   icon_1024.png --out icon.iconset/icon_128x128.png
    sips -z 256 256   icon_1024.png --out icon.iconset/icon_128x128@2x.png # For 128x128@2x
    sips -z 256 256   icon_1024.png --out icon.iconset/icon_256x256.png
    sips -z 512 512   icon_1024.png --out icon.iconset/icon_256x256@2x.png # For 256x256@2x
    sips -z 512 512   icon_1024.png --out icon.iconset/icon_512x512.png
    cp icon_1024.png  icon.iconset/icon_512x512@2x.png # For 512x512@2x
    iconutil -c icns icon.iconset
    mv icon.icns build/
    rm -rf icon.iconset
    echo "✓ Created build/icon.icns"
    
    # Create Windows ICO (basic version from the largest PNG)
    # For a proper .ico, you'd ideally combine multiple sizes, but sips creates a single-image .ico
    sips -s format ico icon_1024.png --out build/icon.ico
    # If sips doesn't create a valid .ico, ImageMagick or other tools are better:
    # Example with ImageMagick: convert icon_1024.png -define icon:auto-resize=256,128,64,48,32,16 build/icon.ico
    echo "✓ Created build/icon.ico (basic version)"
    
    # Create Linux PNG icons
    echo "Creating Linux PNG icons..."
    mkdir -p build/icons # Ensure directory exists
    for size in 16 32 48 64 128 256 512; do
        sips -z $size $size icon_1024.png --out build/icons/${size}x${size}.png
    done
    echo "✓ Created Linux PNG icons in build/icons/"
    
    # Clean up base PNG
    rm icon_1024.png
    
    echo ""
    echo "✅ New app icons created successfully from $ICON_SVG!"
    echo "Contents of build directory:"
    ls -la build/
    echo ""
    echo "Contents of build/icons/:"
    ls -la build/icons/
    echo ""
    echo "You can now rebuild your application to use the new icons:"
    echo "  npm run build        # Build for current platform"
    echo "  npm run build:mac    # Build for macOS"
else
    echo "❌ Base PNG icon_1024.png was not created. Cannot proceed."
    exit 1
fi 