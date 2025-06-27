#!/bin/bash

# GenomeExplorer Plugin Marketplace Server Starter
# This script starts the local plugin marketplace server for development

echo "🚀 GenomeExplorer Plugin Marketplace Server"
echo "==========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
REQUIRED_VERSION="14.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Node.js version $REQUIRED_VERSION or higher required. Found: v$NODE_VERSION"
    exit 1
fi

echo "✅ Node.js v$NODE_VERSION detected"

# Check if package.json exists
if [ ! -f "marketplace-server-package.json" ]; then
    echo "❌ marketplace-server-package.json not found"
    echo "   Please ensure you're running this script from the GenomeExplorer directory"
    exit 1
fi

# Create marketplace data directory
mkdir -p marketplace-data/plugins
echo "📁 Created marketplace data directory"

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    cp marketplace-server-package.json package.json
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✅ Dependencies installed"
else
    echo "✅ Dependencies already installed"
fi

# Check if port 3001 is already in use
if lsof -i :3001 &> /dev/null; then
    echo "⚠️  Port 3001 is already in use"
    echo "   You can:"
    echo "   1. Stop the existing service using port 3001"
    echo "   2. Or modify the PORT in plugin-marketplace-server.js"
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Start the server
echo "🌐 Starting Plugin Marketplace Server..."
echo "   Server will be available at: http://localhost:3001"
echo "   API endpoints:"
echo "   • GET  /api/v1/plugins     - Search plugins"
echo "   • GET  /api/v1/plugins/:id - Get plugin details"
echo "   • GET  /api/v1/categories  - Get categories"
echo "   • GET  /api/v1/stats       - Get statistics"
echo "   • GET  /api/v1/health      - Health check"
echo ""
echo "   Press Ctrl+C to stop the server"
echo ""

# Start with nodemon if available, otherwise use node
if command -v npx &> /dev/null && npx nodemon --version &> /dev/null; then
    echo "🔄 Starting with auto-reload (nodemon)..."
    npx nodemon plugin-marketplace-server.js
else
    echo "▶️  Starting server..."
    node plugin-marketplace-server.js
fi
