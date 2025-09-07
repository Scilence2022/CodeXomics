#!/bin/bash

# 生成Mac风格图标的脚本
# 需要安装: brew install librsvg

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}开始生成Mac风格图标...${NC}"

# 检查依赖
if ! command -v rsvg-convert &> /dev/null; then
    echo -e "${RED}错误: 需要安装 librsvg${NC}"
    echo "请运行: brew install librsvg"
    exit 1
fi

# 创建临时目录
TEMP_DIR=$(mktemp -d)
echo -e "${YELLOW}使用临时目录: $TEMP_DIR${NC}"

# 源SVG文件
SOURCE_SVG="build/icons/icon_final.svg"

# 检查源文件是否存在
if [ ! -f "$SOURCE_SVG" ]; then
    echo -e "${RED}错误: 源SVG文件不存在: $SOURCE_SVG${NC}"
    exit 1
fi

# 生成不同尺寸的PNG文件
echo -e "${GREEN}生成PNG文件...${NC}"

sizes=(16 32 64 128 256 512 1024)

for size in "${sizes[@]}"; do
    echo "生成 ${size}x${size} PNG..."
    rsvg-convert -h $size -w $size "$SOURCE_SVG" -o "$TEMP_DIR/icon_${size}x${size}.png"
done

# 复制到build/icons目录
echo -e "${GREEN}复制PNG文件到build/icons目录...${NC}"
cp "$TEMP_DIR"/*.png build/icons/

# 生成.icns文件
echo -e "${GREEN}生成.icns文件...${NC}"

# 创建iconset目录
ICONSET_DIR="$TEMP_DIR/GenomeAIStudio.iconset"
mkdir -p "$ICONSET_DIR"

# 复制不同尺寸的文件到iconset目录
cp "$TEMP_DIR/icon_16x16.png" "$ICONSET_DIR/icon_16x16.png"
cp "$TEMP_DIR/icon_32x32.png" "$ICONSET_DIR/icon_16x16@2x.png"
cp "$TEMP_DIR/icon_32x32.png" "$ICONSET_DIR/icon_32x32.png"
cp "$TEMP_DIR/icon_64x64.png" "$ICONSET_DIR/icon_32x32@2x.png"
cp "$TEMP_DIR/icon_128x128.png" "$ICONSET_DIR/icon_128x128.png"
cp "$TEMP_DIR/icon_256x256.png" "$ICONSET_DIR/icon_128x128@2x.png"
cp "$TEMP_DIR/icon_256x256.png" "$ICONSET_DIR/icon_256x256.png"
cp "$TEMP_DIR/icon_512x512.png" "$ICONSET_DIR/icon_256x256@2x.png"
cp "$TEMP_DIR/icon_512x512.png" "$ICONSET_DIR/icon_512x512.png"
cp "$TEMP_DIR/icon_1024x1024.png" "$ICONSET_DIR/icon_512x512@2x.png"

# 生成.icns文件
iconutil -c icns "$ICONSET_DIR" -o "build/icon.icns"

echo -e "${GREEN}图标生成完成！${NC}"
echo -e "${YELLOW}生成的文件:${NC}"
echo "- build/icon.icns (主图标文件)"
echo "- build/icons/icon_*.png (各种尺寸的PNG文件)"

# 清理临时目录
rm -rf "$TEMP_DIR"
echo -e "${GREEN}清理完成！${NC}"

echo -e "${GREEN}✅ Mac风格图标生成成功！${NC}"
