# Build Instructions for Electron Genome Browser

## Overview

This document provides comprehensive instructions for building the Electron Genome Browser application with all recent enhancements including AI integration, enhanced visualization, and improved architecture.

## 🆕 Recent Updates

### **Enhanced Features**
- **Fixed AI Search Function Calling** - Corrected search behavior for better accuracy
- **SVG-based GC Content Visualization** - Crisp, scalable graphics with dynamic calculations
- **Improved Modular Architecture** - Better code organization and maintainability
- **Enhanced Configuration Management** - Centralized configuration with persistent storage
- **Better Error Handling** - Graceful degradation and user feedback

### **New Dependencies**
- **Enhanced AI Integration** - Updated LLM provider support
- **SVG Graphics** - Native SVG support for better visualization
- **Configuration Persistence** - File-based configuration management

## 📋 Prerequisites

### **System Requirements**
- **Node.js**: Version 18.0.0 or higher (LTS recommended)
- **npm**: Version 8.0.0 or higher (included with Node.js)
- **Operating System**: 
  - macOS 10.15 (Catalina) or higher
  - Windows 10 version 1903 or higher
  - Linux Ubuntu 18.04 or equivalent

### **Development Tools**
- **Git**: For version control and repository management
- **Code Editor**: VS Code, Atom, or similar (VS Code recommended)
- **Terminal/Command Prompt**: For running build commands

### **Optional Tools**
- **Electron Forge CLI**: For advanced building and packaging
- **Node Version Manager (nvm)**: For managing Node.js versions
- **Yarn**: Alternative package manager (optional)

## 🛠️ Installation Steps

### **1. Clone the Repository**
```bash
# Clone the repository
git clone https://github.com/your-username/electron-GenomeViewer.git
cd electron-GenomeViewer

# Check repository status
git status
git log --oneline -10  # View recent commits
```

### **2. Install Dependencies**
```bash
# Install all required packages
npm install

# Verify installation
npm list --depth=0
```

**Core Dependencies:**
- `electron`: ^27.0.0 - Main Electron framework
- `electron-builder`: ^24.6.4 - Building and packaging
- `fs-extra`: ^11.1.1 - Enhanced file system operations
- `path`: Native Node.js module for path operations

**Development Dependencies:**
- `electron-rebuild`: For native module compatibility
- `concurrently`: For running multiple scripts simultaneously
- `wait-on`: For waiting on services during development

### **3. Verify Installation**
```bash
# Check Node.js and npm versions
node --version
npm --version

# Verify Electron installation
npx electron --version

# Run basic tests (if available)
npm test
```

## 🔨 Build Process

### **Development Build**
```bash
# Start development server with hot reload
npm run dev

# Alternative: Start without hot reload
npm start

# Run in debug mode
npm run debug
```

### **Production Build**
```bash
# Build for current platform
npm run build

# Build for specific platforms
npm run build:mac     # macOS
npm run build:win     # Windows
npm run build:linux   # Linux

# Build for all platforms (requires appropriate OS or CI)
npm run build:all
```

### **Advanced Build Options**
```bash
# Build with specific Electron version
npm run build -- --electron-version=27.0.0

# Build for specific architecture
npm run build:mac -- --arch=x64     # Intel Macs
npm run build:mac -- --arch=arm64   # Apple Silicon Macs
npm run build:win -- --arch=x64     # 64-bit Windows
npm run build:win -- --arch=ia32    # 32-bit Windows

# Create installer packages
npm run dist
```

## ⚙️ Configuration

### **Application Configuration**
The application uses a centralized configuration system with the following structure:

```javascript
// Default configuration locations
~/.genome-browser/config.json          // Main configuration
~/.genome-browser/llm-config.json      // AI/LLM settings
~/.genome-browser/ui-preferences.json  // UI preferences
~/.genome-browser/chat-history.json    // Chat history
~/.genome-browser/app-settings.json    // Application settings
```

### **Build Configuration**
Edit `package.json` to customize build settings:

```json
{
  "build": {
    "appId": "com.yourcompany.genome-browser",
    "productName": "Electron Genome Browser",
    "directories": {
      "output": "dist",
      "buildResources": "build"
    },
    "files": [
      "src/**/*",
      "package.json",
      "!src/**/*.md",
      "!**/node_modules/**"
    ],
    "mac": {
      "category": "public.app-category.education",
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ]
    },
    "win": {
      "target": "nsis",
      "arch": ["x64"]
    },
    "linux": {
      "target": "AppImage",
      "category": "Science"
    }
  }
}
```

### **Environment Variables**
Set up environment variables for development:

```bash
# Create .env file (optional)
echo "NODE_ENV=development" > .env
echo "DEBUG=true" >> .env
echo "LOG_LEVEL=info" >> .env

# For production builds
export NODE_ENV=production
```

## 🔧 Development Workflow

### **File Structure**
```
electron-GenomeViewer/
├── src/
│   ├── main/                    # Main process files
│   │   ├── main.js             # Main Electron process
│   │   └── menu.js             # Application menu
│   └── renderer/               # Renderer process files
│       ├── index.html          # Main HTML file
│       ├── styles.css          # Styles
│       ├── renderer-modular.js # Main application logic
│       └── modules/            # Modular architecture
│           ├── FileManager.js      # File operations
│           ├── TrackRenderer.js    # Visualization
│           ├── NavigationManager.js # Search & navigation
│           ├── UIManager.js        # Interface management
│           ├── SequenceUtils.js    # Sequence processing
│           ├── ChatManager.js      # AI assistant
│           ├── LLMConfigManager.js # AI configuration
│           └── ConfigManager.js    # Configuration management
├── assets/                     # Application assets
├── build/                      # Build resources
├── dist/                       # Build output
└── sample_data/               # Test data files
```

### **Code Style and Standards**
```bash
# Install linting tools (optional)
npm install --save-dev eslint prettier

# Run linting
npx eslint src/

# Format code
npx prettier --write src/
```

**Coding Standards:**
- Use ES6+ features consistently
- Follow modular architecture patterns
- Add JSDoc comments for functions
- Use meaningful variable names
- Handle errors gracefully

### **Testing**
```bash
# Run unit tests (if implemented)
npm test

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Generate coverage report
npm run test:coverage
```

## 📦 Packaging and Distribution

### **Create Distribution Packages**
```bash
# Create installers for all platforms
npm run dist

# Platform-specific distributions
npm run dist:mac    # Creates .dmg file
npm run dist:win    # Creates .exe installer
npm run dist:linux  # Creates .AppImage file
```

### **Output Files**
After successful build, find distribution files in:
```
dist/
├── mac/
│   └── Electron Genome Browser-1.0.0.dmg
├── win-unpacked/
│   └── Electron Genome Browser Setup 1.0.0.exe
└── linux-unpacked/
    └── Electron Genome Browser-1.0.0.AppImage
```

### **Code Signing (Production)**
For production releases, configure code signing:

```json
// In package.json build configuration
{
  "build": {
    "mac": {
      "identity": "Developer ID Application: Your Name (TEAM_ID)"
    },
    "win": {
      "certificateFile": "path/to/certificate.p12",
      "certificatePassword": "password"
    }
  }
}
```

## 🐛 Troubleshooting

### **Common Build Issues**

**Node.js Version Conflicts:**
```bash
# Use Node Version Manager
nvm install 18
nvm use 18

# Verify version
node --version
```

**Native Module Compilation:**
```bash
# Rebuild native modules
npm run electron-rebuild

# Alternative: Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Permission Issues (macOS/Linux):**
```bash
# Fix npm permissions
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) /usr/local/lib/node_modules
```

**Memory Issues During Build:**
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

### **Platform-Specific Issues**

**macOS:**
```bash
# Install Xcode Command Line Tools if needed
xcode-select --install

# Trust certificates for code signing
security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain certificate.crt
```

**Windows:**
```bash
# Install Windows Build Tools
npm install --global windows-build-tools

# Alternative: Install Visual Studio Build Tools
```

**Linux:**
```bash
# Install required libraries
sudo apt-get install build-essential libnss3-dev libgconf-2-4
```

### **Runtime Issues**

**Configuration Problems:**
- Check configuration file permissions
- Verify configuration directory exists: `~/.genome-browser/`
- Reset configuration: Delete config directory and restart

**AI Integration Issues:**
- Verify API keys are properly configured
- Check network connectivity for LLM providers
- Review LLM provider configuration in settings

**File Loading Problems:**
- Ensure sample data files are accessible
- Check file permissions and format compatibility
- Verify file paths in error messages

## 🚀 Performance Optimization

### **Build Optimization**
```json
// Optimize build performance in package.json
{
  "build": {
    "compression": "maximum",
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

### **Runtime Optimization**
- Enable hardware acceleration for SVG rendering
- Use efficient data structures for large genomic files
- Implement lazy loading for visualization components
- Optimize memory usage with proper cleanup

## 📚 Additional Resources

### **Documentation**
- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder Guide](https://www.electron.build/)
- [Node.js Documentation](https://nodejs.org/docs/)

### **Community Support**
- [Electron Discord](https://discord.gg/electron)
- [GitHub Issues](https://github.com/your-repo/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/electron)

### **Development Tools**
- [Electron DevTools Extension](https://github.com/MarshallOfSound/electron-devtools-installer)
- [Electron Fiddle](https://www.electronjs.org/fiddle) - For testing Electron code
- [Spectron](https://github.com/electron-userland/spectron) - For testing Electron apps

## 🔄 Continuous Integration

### **GitHub Actions Example**
```yaml
# .github/workflows/build.yml
name: Build and Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [macos-latest, windows-latest, ubuntu-latest]
    
    steps:
    - uses: actions/checkout@v3
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - run: npm ci
    - run: npm run build
    - run: npm run dist
    
    - name: Upload artifacts
      uses: actions/upload-artifact@v3
      with:
        name: ${{ matrix.os }}-build
        path: dist/
```

## 📝 Release Process

### **Version Management**
```bash
# Update version
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0

# Create git tag
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### **Release Checklist**
- [ ] Update version numbers in package.json
- [ ] Update CHANGELOG.md with new features
- [ ] Test on all target platforms
- [ ] Update documentation
- [ ] Create release notes
- [ ] Tag release in git
- [ ] Build and upload distribution packages
- [ ] Update download links
- [ ] Announce release

This comprehensive build guide ensures successful compilation and distribution of the enhanced Electron Genome Browser with all its advanced features and improvements. 