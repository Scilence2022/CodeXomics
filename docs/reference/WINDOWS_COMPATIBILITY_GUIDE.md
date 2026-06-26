# Windows Compatibility and Troubleshooting Guide

## Overview

This guide addresses two main issues with CodeXomics on the Windows operating system:

1. **BLAST database creation path issue**
2. **Protein 3D Structure Viewer WebGL compatibility issue**

## 🧬 BLAST Database Solution

### Problem Description

The original implementation had the following problems:

- Used a hard-coded macOS path `/Users/song/blast/db`
- Used the Unix-specific `mkdir -p` command
- Had no cross-platform path-handling logic

### Solution Features

#### 1. Smart Path Selection

- **Priority 1**: the directory of the currently open genome file
- **Priority 2**: the user data directory (adapted per operating system)

#### 2. Cross-Platform Path Support

| Operating system | Default database path                               |
| ---------------- | --------------------------------------------------- |
| **Windows**      | `%LOCALAPPDATA%\CodeXomics\blast\db`                |
| **macOS**        | `~/Library/Application Support/CodeXomics/blast/db` |
| **Linux**        | `~/.local/share/CodeXomics/blast/db`                |

#### 3. Current File Directory Takes Priority

- If a genome file is open, the database is created at `<file directory>/blast_db`
- This keeps the data and the database together

### How to Use

1. **Open a genome file**

   ```
   Load any supported genome file (.fasta, .gb, .genbank, etc.)
   ```

2. **Create a BLAST database**
   - Go to the BLAST search interface
   - Select the "Local" service
   - Click "Database Management"
   - The database is created automatically in the current file's directory

3. **Verify the database location**
   - The database files appear in a `blast_db` subfolder in the same directory as the genome file

## 🧪 Protein 3D Structure Viewer Solution

### Problem Description

On Windows, WebGL can be affected by the following factors:

- Graphics driver version
- Browser security settings
- Hardware acceleration settings
- Antivirus software restrictions

### Solution Features

#### 1. WebGL Compatibility Detection

- Automatically detects WebGL support at startup
- Provides detailed system-information feedback
- Identifies software-rendering warnings

#### 2. Graceful Degradation

When WebGL is unavailable, the following alternatives are provided:

| Feature                      | Description                                           |
| ---------------------------- | ----------------------------------------------------- |
| **📁 Download the PDB file** | Download the structure file directly to your computer |
| **ℹ️ Show structure info**   | Display protein metadata and links                    |
| **🌐 View on RCSB PDB**      | View the structure on the official website            |

#### 3. Detailed Error Diagnostics

- WebGL support status
- Graphics renderer information
- Browser compatibility hints
- Specific resolution suggestions

### Resolution Steps on Windows

#### 1. Update the Graphics Driver

```powershell
# NVIDIA users
# Visit https://www.nvidia.com/drivers/
# Download and install the latest driver

# AMD users
# Visit https://www.amd.com/support/
# Download and install the latest driver

# Intel users
# Visit https://www.intel.com/content/www/us/en/support/
# Download and install the latest driver
```

#### 2. Browser Settings

**Chrome/Edge:**

1. Enter `chrome://flags/` in the address bar
2. Search for "webgl"
3. Enable all WebGL-related options

**Firefox:**

1. Enter `about:config` in the address bar
2. Search for `webgl.force-enabled`
3. Set it to `true`

#### 3. Windows Hardware Acceleration

1. **Windows Settings**
   - Settings → System → Display → Graphics settings
   - Enable "Hardware-accelerated GPU scheduling"

2. **Per-application settings**
   - Add the CodeXomics application
   - Choose the "High performance" GPU

## 💡 Best Practices

### BLAST Database Management

1. **Keep an organized structure**

   ```
   project-folder/
   ├── genome.fasta          # genome file
   ├── annotations.gff       # annotation file
   └── blast_db/             # auto-created database directory
       ├── genome.nhr
       ├── genome.nin
       └── genome.nsq
   ```

2. **Back up important databases**
   - Creating large databases is time-consuming
   - Back up the `blast_db` directory regularly

### Protein 3D Viewer Optimization

1. **Use the latest browser**
   - Chrome 90+ / Edge 90+
   - Firefox 85+

2. **Check system requirements**
   - 4 GB+ RAM recommended
   - Dedicated graphics card (recommended)
   - OpenGL 2.1+ support

## 🐛 Troubleshooting

### BLAST Database Issues

**Problem**: the `makeblastdb` command is not found

```bash
Solution:
1. Make sure BLAST+ is installed correctly
2. Check the PATH environment variable
3. Specify the BLAST+ install location with an absolute path
```

**Problem**: permission-denied error

```bash
Solution:
1. Run the application with administrator privileges
2. Check folder write permissions
3. Choose a different database storage location
```

### WebGL Issues

**Problem**: WebGL is not supported

```
Solution:
1. Update the graphics driver
2. Enable browser hardware acceleration
3. Check antivirus software settings
4. Use the degraded viewing options
```

**Problem**: slow performance

```
Solution:
1. Close other GPU-intensive applications
2. Lower the browser zoom level
3. Use a dedicated graphics card (if available)
```

## 🔧 Developer Information

### Modified Files

- `src/renderer/modules/BlastManager.js`: cross-platform path handling
- `src/renderer/modules/ProteinStructureViewer.js`: WebGL compatibility

### New Features

- Operating-system detection and path adaptation
- WebGL support detection
- Graceful degradation
- Detailed error diagnostics

### API Changes

- `BlastManager.getPlatformDbPath()`: get the platform-specific database path
- `ProteinStructureViewer.checkWebGLSupport()`: detect WebGL support
- `ProteinStructureViewer.showWebGLErrorDialog()`: error-handling dialog

## 📞 Support

If you run into other problems:

1. **Collect system information**
   - Operating system version
   - Browser version
   - Graphics card model and driver version

2. **Check the console log**
   - Press F12 to open the developer tools
   - Review the error messages in the Console tab

3. **Provide error details**
   - The specific error message
   - Steps to reproduce
   - System configuration information

With these improvements, CodeXomics now offers better compatibility and a better user experience on the Windows platform.
