# 🚀 Release Guide for CodeXomics v0.522beta

## ✅ Release Status: READY

All preparations for the v0.522beta release have been completed successfully!

---

## 📋 What Has Been Done

### ✓ Git Tag Created and Pushed

- **Tag:** `v0.522beta`
- **Commit:** `00265a7`
- **Message:** "Release v0.522beta - Beta release with ProGenFixer integration and improved LLM model organization"
- **Status:** ✅ Pushed to GitHub

### ✓ Documentation Created

- **CHANGELOG.md** - Permanent changelog for the project
- **RELEASE_NOTES_v0.522beta.md** - Detailed release notes for this version
- **Status:** ✅ Committed and pushed

### ✓ Build Artifacts Generated

All distribution packages have been built successfully:

#### macOS

- ✅ `CodeXomics-0.522.0-beta-x64.dmg` (139 MB) - Intel Mac
- ✅ `CodeXomics-0.522.0-beta-arm64.dmg` (134 MB) - Apple Silicon
- ✅ `CodeXomics-0.522.0-beta-mac.zip` (133 MB) - Universal zip
- ✅ `CodeXomics-0.522.0-beta-arm64-mac.zip` (129 MB) - ARM64 zip

#### Windows

- ✅ `CodeXomics Setup 0.522.0-beta.exe` (207 MB) - Installer
- ✅ `CodeXomics 0.522.0-beta.exe` (207 MB) - Portable

#### Linux

- ✅ `CodeXomics-0.522.0-beta.AppImage` (144 MB) - AppImage
- ✅ `codexomics_0.522.0-beta_amd64.deb` (93 MB) - Debian package
- ✅ `codexomics_0.522.0-beta_amd64.snap` (124 MB) - Snap package

**Location:** `/Users/song/Github-Repos/GenomeAIStudio/dist/`

---

## 🎯 Next Steps: Create GitHub Release

Since GitHub CLI (`gh`) is not installed, you'll need to create the release manually through the GitHub web interface.

### Step-by-Step Guide:

#### 1. Go to GitHub Releases Page

Open your browser and navigate to:

```
https://github.com/Scilence2022/CodeXomics/releases/new
```

#### 2. Fill in Release Information

**Choose a tag:** Select `v0.522beta` from the dropdown (it's already pushed)

**Release title:**

```
CodeXomics v0.522beta - Beta Release
```

**Release description:** Copy the content from `RELEASE_NOTES_v0.522beta.md` file, or use this:

```markdown
# CodeXomics v0.522beta Release Notes

## 🎉 Beta Release

This is a beta release featuring new external tool integrations, improved LLM model organization, and enhanced testing infrastructure.

## ✨ New Features

### 🔧 ProGenFixer Integration

- Added **ProGenFixer** external tool for protein engineering and sequence optimization
- Direct access via Tools menu with keyboard shortcut `Cmd/Ctrl+Shift+P`
- URL: https://progenfixer.biodesign.ac.cn

### 🤖 LLM Model Improvements

- **Reorganized SiliconFlow models** by source and parameter size
- Added **Kimi K2 Pro** model: `Pro/moonshotai/Kimi-K2-Instruct-0905`
- Grouped models by provider with emoji identifiers:
  - 🌐 Qwen Series (Alibaba Cloud)
  - 🧠 DeepSeek Series
  - 🌙 Kimi Series (Moonshot AI)
  - 💡 GLM Series (Zhipu AI)
  - 🎯 Yi Series (01.AI)

### 📊 Enhanced Testing

- Improved benchmark UI with accurate test count display
- Enhanced tool parsing detection for flexible success cases
- Added comprehensive data export workflow tests

## 🐛 Bug Fixes

- Fixed LLM configuration persistence across multiple files
- Resolved benchmark UI test count inconsistencies
- Enhanced data export workflow edge case handling
- Deep cleanup of deprecated `searchProteinByGene` legacy code

## 🔄 Improvements

- Updated version display to show beta designation: **v0.522beta**
- Synchronized version information across all config files
- Refactored manual test suite organization
- Enhanced log parsing for better debugging

## ⚠️ Known Issues

This is a **beta release** and may contain bugs. Please report issues at:
https://github.com/Scilence2022/CodeXomics/issues

## 📦 Installation

Download the appropriate package for your platform from the Assets section below.

### macOS

- **Intel (x64):** CodeXomics-0.522.0-beta-x64.dmg
- **Apple Silicon (arm64):** CodeXomics-0.522.0-beta-arm64.dmg

### Windows

- **Installer:** CodeXomics Setup 0.522.0-beta.exe
- **Portable:** CodeXomics 0.522.0-beta.exe

### Linux

- **AppImage:** CodeXomics-0.522.0-beta.AppImage
- **Debian:** codexomics_0.522.0-beta_amd64.deb
- **Snap:** codexomics_0.522.0-beta_amd64.snap

---

**Full Changelog:** https://github.com/Scilence2022/CodeXomics/blob/main/CHANGELOG.md
```

#### 3. Upload Build Artifacts

Click "Attach binaries by dropping them here or selecting them" and upload these files from the `dist/` folder:

**macOS:**

- `CodeXomics-0.522.0-beta-x64.dmg`
- `CodeXomics-0.522.0-beta-arm64.dmg`
- `CodeXomics-0.522.0-beta-mac.zip`
- `CodeXomics-0.522.0-beta-arm64-mac.zip`

**Windows:**

- `CodeXomics Setup 0.522.0-beta.exe`
- `CodeXomics 0.522.0-beta.exe`

**Linux:**

- `CodeXomics-0.522.0-beta.AppImage`
- `codexomics_0.522.0-beta_amd64.deb`
- `codexomics_0.522.0-beta_amd64.snap`

#### 4. Release Options

- ✅ Check **"This is a pre-release"** (since this is a beta version)
- ✅ Check **"Set as the latest release"** (if you want this to be the default download)

#### 5. Publish Release

Click the green **"Publish release"** button.

---

## 🔧 Alternative: Using GitHub CLI (Optional)

If you want to install GitHub CLI for future releases:

```bash
# Install GitHub CLI on macOS
brew install gh

# Authenticate
gh auth login

# Create release with artifacts (example for future use)
gh release create v0.522beta \
  dist/CodeXomics-0.522.0-beta-x64.dmg \
  dist/CodeXomics-0.522.0-beta-arm64.dmg \
  dist/CodeXomics-0.522.0-beta-mac.zip \
  dist/CodeXomics-0.522.0-beta-arm64-mac.zip \
  "dist/CodeXomics Setup 0.522.0-beta.exe" \
  "dist/CodeXomics 0.522.0-beta.exe" \
  dist/CodeXomics-0.522.0-beta.AppImage \
  dist/codexomics_0.522.0-beta_amd64.deb \
  dist/codexomics_0.522.0-beta_amd64.snap \
  --title "CodeXomics v0.522beta - Beta Release" \
  --notes-file RELEASE_NOTES_v0.522beta.md \
  --prerelease
```

---

## 📊 Release Checklist

- [x] Version updated in package.json and version.js
- [x] Git tag created (`v0.522beta`)
- [x] Tag pushed to GitHub
- [x] CHANGELOG.md created and committed
- [x] Release notes created
- [x] Build artifacts generated (all platforms)
- [ ] GitHub release created (manual step - see above)
- [ ] Release artifacts uploaded
- [ ] Release published

---

## 📝 Release Statistics

**Total Commits in This Release:** 9 major commits
**Files Changed:** 10+
**Build Artifacts:** 9 packages
**Total Size:** ~1.4 GB (all platforms combined)

---

## 🔗 Important Links

- **Repository:** https://github.com/Scilence2022/CodeXomics
- **Release Page:** https://github.com/Scilence2022/CodeXomics/releases
- **Issues:** https://github.com/Scilence2022/CodeXomics/issues
- **Changelog:** https://github.com/Scilence2022/CodeXomics/blob/main/CHANGELOG.md

---

## 🎉 Release is Ready!

Everything is prepared. Just go to GitHub and create the release following the steps above!

**Thank you for using CodeXomics!** 🧬✨
