#!/bin/bash

# GenomeExplorer Plugin Marketplace Server Startup Script
# This script sets up and starts the plugin marketplace server with submission support

echo "🚀 Starting GenomeExplorer Plugin Marketplace Server..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ Node.js version 14 or higher is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Set working directory to the marketplace server location
cd "$(dirname "$0")"

# Check if package.json exists, if not, create it
if [ ! -f "marketplace-server-package.json" ]; then
    echo "❌ marketplace-server-package.json not found!"
    exit 1
fi

echo "📦 Installing dependencies..."

# Install dependencies using the marketplace package.json
if ! npm install --prefix . --package-lock-only=false --package-lock=false --production --only=prod express cors multer; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Check if marketplace server script exists
if [ ! -f "plugin-marketplace-server.js" ]; then
    echo "❌ plugin-marketplace-server.js not found!"
    exit 1
fi

# Create marketplace data directory if it doesn't exist
mkdir -p marketplace-data/plugins
mkdir -p marketplace-data/uploads

echo "📁 Marketplace data directories created"

# Check for port conflicts (3001 for marketplace, 3000 for MCP)
MCP_PORT=3000
MARKETPLACE_PORT=3001

echo "🔍 Checking port availability..."

# Check MCP port
if lsof -Pi :$MCP_PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  Port $MCP_PORT (MCP Server) is already in use"
    echo "📌 This is expected if MCP Server is running"
else
    echo "✅ Port $MCP_PORT (MCP Server) is available"
fi

# Check marketplace port
if lsof -Pi :$MARKETPLACE_PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Port $MARKETPLACE_PORT (Marketplace Server) is already in use"
    echo "🔧 Please stop the existing service or change the port"
    
    # Try to find what's using the port
    echo "🔍 Process using port $MARKETPLACE_PORT:"
    lsof -Pi :$MARKETPLACE_PORT -sTCP:LISTEN
    
    read -p "Do you want to kill the existing process? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        PID=$(lsof -ti:$MARKETPLACE_PORT)
        if [ ! -z "$PID" ]; then
            kill -9 $PID
            echo "✅ Killed process $PID"
            sleep 2
        fi
    else
        echo "❌ Cannot start server. Port $MARKETPLACE_PORT is in use."
        exit 1
    fi
else
    echo "✅ Port $MARKETPLACE_PORT (Marketplace Server) is available"
fi

# Set environment variables
export PORT=$MARKETPLACE_PORT
export NODE_ENV=development

# Display startup information
echo ""
echo "🎯 Server Configuration:"
echo "   📡 Marketplace Server Port: $MARKETPLACE_PORT"
echo "   🔧 MCP Server Port: $MCP_PORT"
echo "   📁 Data Directory: $(pwd)/marketplace-data"
echo "   🌐 Environment: $NODE_ENV"
echo ""

# Check if nodemon is available for development
if command -v nodemon &> /dev/null; then
    echo "🔄 Starting server with nodemon (auto-restart enabled)..."
    echo "💡 To stop the server, press Ctrl+C"
    echo ""
    
    # Start with nodemon for development
    nodemon plugin-marketplace-server.js
else
    echo "🚀 Starting server with node..."
    echo "💡 To stop the server, press Ctrl+C"
    echo ""
    
    # Start with regular node
    node plugin-marketplace-server.js
fi
