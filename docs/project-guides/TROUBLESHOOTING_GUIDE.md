# Troubleshooting Guide

This guide helps you resolve common issues encountered while using **Genome AI Studio v0.3 beta**.

## 🚨 Common Installation Issues

### Application Won't Start

**Symptoms**: Application fails to launch or shows a white screen

**Solutions**:
1. **Check system requirements**:
   - Ensure you have sufficient RAM (6GB minimum)
   - Verify your operating system is supported
   - Update to the latest OS version if needed

2. **Clear application data**:
   ```bash
   # macOS
   rm -rf ~/Library/Application\ Support/genome-ai-studio
   
   # Windows
   del /s "%APPDATA%\genome-ai-studio"
   
   # Linux
   rm -rf ~/.config/genome-ai-studio
   ```

3. **Reinstall the application**:
   - Completely uninstall the current version
   - Download the latest release
   - Install with administrator privileges

### Permission Errors

**Symptoms**: "Permission denied" or "Access is denied" errors

**Solutions**:
1. **Run as administrator** (Windows) or with `sudo` (Linux/macOS)
2. **Check file permissions** for your data directory
3. **Disable antivirus temporarily** during installation
4. **Add application to firewall exceptions**

### Electron Framework Issues

**Symptoms**: "Failed to load Electron" or framework-related errors

**Solutions**:
1. **Update Node.js** to the latest LTS version
2. **Clear npm cache**:
   ```bash
   npm cache clean --force
   ```
3. **Reinstall dependencies**:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

## 🔧 Runtime Issues

### Version Management Errors

**Symptoms**: `SyntaxError: Unexpected token 'export'` or version-related errors

**Solutions**:
1. **Update to latest version** that includes the unified version management system
2. **Clear module cache**:
   ```bash
   npm run version-sync
   npm run version-validate
   ```
3. **Check for mixed module syntax** in custom plugins

### Memory Issues

**Symptoms**: Application becomes slow or crashes with large files

**Solutions**:
1. **Increase system memory** allocation
2. **Close other applications** to free up RAM
3. **Use streaming mode** for files larger than 500MB
4. **Enable Simple Mode** for better performance:
   - Go to View → Simple Mode

### Plugin System Issues

**Symptoms**: Plugins not loading or marketplace errors

**Solutions**:
1. **Check plugin compatibility** with current version
2. **Clear plugin cache**:
   ```bash
   rm -rf ~/.genome-ai-studio/plugins
   ```
3. **Verify plugin marketplace server** is accessible
4. **Check plugin dependencies** are installed

## 🤖 AI Assistant Issues

### AI Assistant Not Responding

**Symptoms**: Chat doesn't work or returns errors

**Solutions**:
1. **Check API key configuration**:
   - Go to Options → Configure LLMs
   - Verify API key is correct and active
   - Test connection using "Test Connection" button

2. **Verify internet connection**:
   - Ensure stable internet for cloud providers
   - Check firewall settings for API access

3. **Try different AI provider**:
   - Switch between OpenAI, Anthropic, or Google
   - Use local LLM (Ollama) for offline operation

### Conversation Evolution Issues

**Symptoms**: Conversation history not recording or analysis errors

**Solutions**:
1. **Check conversation recording settings**:
   - Open developer console (F12)
   - Look for conversation recording errors
   - Restart application to reset recording

2. **Verify storage permissions**:
   - Check write permissions in user data directory
   - Clear conversation history to reset storage

3. **Reset conversation system**:
   ```javascript
   // In developer console
   window.conversationEvolutionManager.resetSystem();
   ```

## 📁 File Loading Issues

### Large File Performance

**Symptoms**: Application becomes unresponsive with large genomic files

**Solutions**:
1. **Use file streaming** for files > 100MB
2. **Enable BAM file handling** for sequencing data
3. **Reduce visible track count** for large genomes
4. **Use indexed file formats** when available

### File Format Issues

**Symptoms**: Files not loading or parsing errors

**Solutions**:
1. **Verify file format** is supported:
   - FASTA, GenBank, GFF/GTF, BED, VCF, SAM/BAM, WIG, KGML
2. **Check file integrity**:
   - Ensure files are not corrupted
   - Verify proper line endings (Unix vs Windows)
3. **Convert file format** if needed

### Path Resolution Issues

**Symptoms**: "File not found" errors with valid files

**Solutions**:
1. **Use absolute paths** instead of relative paths
2. **Check for special characters** in file names
3. **Verify file permissions** are readable
4. **Move files to project directory** for better management

## 🖥️ User Interface Issues

### Track Rendering Problems

**Symptoms**: Tracks not displaying correctly or visual glitches

**Solutions**:
1. **Refresh track display**:
   - Right-click track → Refresh
   - Or reload the current view

2. **Check track settings**:
   - Verify track height settings
   - Reset track order if needed
   - Toggle track visibility

3. **Clear graphics cache**:
   - Restart application
   - Reset window positions

### Menu Issues

**Symptoms**: Menu items not working or menu height errors

**Solutions**:
1. **Restart application** to reset menu state
2. **Check for menu conflicts** between windows
3. **Reset UI preferences**:
   ```bash
   rm ~/.genome-ai-studio/ui-preferences.json
   ```

### Project Manager Issues

**Symptoms**: Project Manager not loading or view mode problems

**Solutions**:
1. **Check project file integrity**:
   - Verify .prj.GAI file is valid XML
   - Check for missing project files

2. **Reset view mode**:
   - Switch between Grid/List/Details views
   - Restart Project Manager window

3. **Clear project cache**:
   ```bash
   rm ~/.genome-ai-studio/projects.json
   ```

## 🔬 Analysis Tool Issues

### BLAST Tool Problems

**Symptoms**: BLAST tools not working or database errors

**Solutions**:
1. **Install BLAST+ tools**:
   - Use Tools → Install BLAST+
   - Or install manually from NCBI

2. **Check database configuration**:
   - Verify database paths are correct
   - Update database configurations

3. **Memory map errors**:
   - Increase system memory limits
   - Use smaller database segments

### KGML Pathway Viewer Issues

**Symptoms**: Pathway viewer not loading or cytoscape errors

**Solutions**:
1. **Check internet connection** for CDN resources
2. **Clear browser cache** in developer tools
3. **Verify KGML file format** is valid XML
4. **Restart pathway viewer** tool

### STRING Networks Problems

**Symptoms**: "cytoscape is not defined" errors

**Solutions**:
1. **Check CDN availability**:
   - Verify internet connection
   - Wait for library loading timeout

2. **Use fallback CDN sources**:
   - Application automatically tries backup sources
   - Check developer console for loading status

3. **Restart network visualization** tool

## 🔧 Advanced Troubleshooting

### Developer Console Debugging

**Access Developer Console**:
- Press **F12** or **Ctrl+Shift+I**
- Look for error messages in Console tab
- Check Network tab for failed requests

**Common Error Patterns**:
1. **Module loading errors**: Check script loading order
2. **API call failures**: Verify network connectivity
3. **Memory errors**: Monitor memory usage in Performance tab

### Log File Analysis

**Log Locations**:
- **macOS**: `~/Library/Logs/genome-ai-studio/`
- **Windows**: `%APPDATA%\genome-ai-studio\logs\`
- **Linux**: `~/.config/genome-ai-studio/logs/`

**Key Log Files**:
- `main.log`: Main process errors
- `renderer.log`: UI and visualization errors
- `plugin.log`: Plugin-related issues

### Performance Optimization

**For Large Datasets**:
1. **Enable hardware acceleration** in system settings
2. **Increase Node.js memory limit**:
   ```bash
   export NODE_OPTIONS="--max-old-space-size=8192"
   ```
3. **Use Simple Mode** for reduced UI complexity
4. **Close unused tracks** and tools

**For Slow Performance**:
1. **Check system resource usage** (CPU, Memory)
2. **Disable unnecessary features** temporarily
3. **Restart application** to clear caches
4. **Update graphics drivers**

## 📞 Getting Additional Help

### Before Reporting Issues

1. **Update to latest version** of Genome AI Studio
2. **Check existing issues** on GitHub
3. **Gather system information**:
   - Operating system and version
   - Available memory and storage
   - Error messages and logs

### Reporting Bugs

**Include in Bug Reports**:
- Detailed steps to reproduce the issue
- Expected vs actual behavior
- System specifications
- Error messages and stack traces
- Screenshots or screen recordings

**Where to Report**:
- **GitHub Issues**: For bugs and feature requests
- **Email Support**: For sensitive or complex issues
- **Community Forums**: For general questions

### Emergency Recovery

**Complete Reset** (last resort):
1. **Backup important projects** and data
2. **Uninstall application** completely
3. **Clear all application data** directories
4. **Reinstall latest version**
5. **Restore project data** if needed

## 🔍 Diagnostic Commands

### Version Validation
```bash
npm run version-validate
```

### System Health Check
```bash
# Check Node.js version
node --version

# Check npm version
npm --version

# Check available memory
# macOS/Linux
free -h

# Windows
wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /format:list
```

### Plugin System Check
```bash
# Validate plugin system
npm run test:plugins

# Check plugin marketplace connectivity
curl -I https://genome-ai-studio-marketplace.com/api/health
```

## 📋 Quick Reference

### Common Keyboard Shortcuts
- **F12**: Open Developer Console
- **Ctrl+Shift+R**: Hard reload
- **Ctrl+Shift+O**: Open project
- **Ctrl+F**: Search
- **Ctrl+Plus/Minus**: Zoom

### Emergency Actions
- **Force quit**: Ctrl+Alt+T (Task Manager)
- **Safe mode**: Start with `--safe-mode` flag
- **Reset settings**: Delete config directory
- **Clear cache**: Restart application

---

**Still having issues?** Contact our support team with detailed information about your problem, including system specifications and error messages.

*This guide covers Genome AI Studio v0.3.0-beta. Check for updates to both the application and this documentation.* 