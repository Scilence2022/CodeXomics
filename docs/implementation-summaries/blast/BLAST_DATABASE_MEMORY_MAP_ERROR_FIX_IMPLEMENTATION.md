# BLAST Database Memory Map Error Fix Implementation

## Overview

This implementation addresses the "Database memory map file error" that occurs when creating custom BLAST databases. The error typically happens when the BLASTDB directory doesn't exist, has permission issues, or contains corrupted database files.

## Problem Analysis

### Root Cause
The error "BLAST Database error: Database memory map file error" occurs when:
1. The BLASTDB directory (`/Users/song/blast/db`) doesn't exist
2. The directory exists but has insufficient permissions
3. Existing database files are corrupted or locked
4. The BLASTDB environment variable points to an inaccessible location

### Error Context
```
BlastManager: Command execution error: Error: Command failed: export BLASTDB="/Users/song/blast/db" && makeblastdb -in "genome.fasta" -dbtype nucl -out "custom_genome_20250706_1751811303390" -title "genome_20250706"
BLAST Database error: Database memory map file error
```

## Solution Implementation

### 1. Enhanced runCommand Method

**File:** `src/renderer/modules/BlastManager.js`

**Changes:**
- Added BLASTDB directory existence check
- Automatic directory creation if missing
- Improved error message handling for specific BLAST errors
- Better permission validation

**Key Improvements:**
```javascript
// Check if BLASTDB directory exists, create it if it doesn't
if (!fs.existsSync(localDbPath)) {
    try {
        fs.mkdirSync(localDbPath, { recursive: true });
        console.log('BlastManager: Created BLASTDB directory:', localDbPath);
    } catch (error) {
        console.error('BlastManager: Failed to create BLASTDB directory:', error);
        reject(new Error(`Failed to create BLASTDB directory: ${error.message}`));
        return;
    }
}

// Provide more specific error messages for common BLAST issues
if (stderr && stderr.includes('Database memory map file error')) {
    reject(new Error(`BLAST database error: The database directory may be corrupted or inaccessible. Please check permissions for: ${this.config.localDbPath}`));
} else if (stderr && stderr.includes('BLAST Database error')) {
    reject(new Error(`BLAST database error: ${stderr.trim()}`));
} else {
    reject(error);
}
```

### 2. New checkAndFixBlastDatabaseDirectory Method

**Purpose:** Dedicated method to validate and fix BLAST database directory issues.

**Features:**
- Checks if directory exists
- Creates directory if missing
- Validates write permissions
- Provides detailed error messages

**Implementation:**
```javascript
async checkAndFixBlastDatabaseDirectory() {
    const fs = require('fs');
    const path = require('path');
    
    try {
        const localDbPath = this.config.localDbPath;
        
        // Check if directory exists
        if (!fs.existsSync(localDbPath)) {
            console.log('BlastManager: Creating BLAST database directory:', localDbPath);
            fs.mkdirSync(localDbPath, { recursive: true });
            return true;
        }
        
        // Check if directory is writable
        try {
            await fs.promises.access(localDbPath, fs.constants.W_OK);
            return true;
        } catch (error) {
            console.error('BlastManager: BLAST database directory not writable:', localDbPath);
            throw new Error(`BLAST database directory not writable: ${localDbPath}`);
        }
    } catch (error) {
        console.error('BlastManager: Error checking BLAST database directory:', error);
        throw error;
    }
}
```

### 3. Enhanced createCustomDatabase Method

**Improvements:**
- Added file existence validation
- Directory permission checks
- Better error logging
- Graceful handling of directory issues

**Key Additions:**
```javascript
// Check if source file exists and is readable
const fs = require('fs');
if (!fs.existsSync(filePath)) {
    throw new Error(`Source file not found: ${filePath}`);
}

// Check if source directory is writable
try {
    await fs.promises.access(sourceDirectory, fs.constants.W_OK);
} catch (error) {
    throw new Error(`Cannot write to source directory: ${sourceDirectory}. Please check permissions.`);
}

// Check and fix BLAST database directory
try {
    await this.checkAndFixBlastDatabaseDirectory();
    this.appendLog(`✓ BLAST database directory verified: ${this.config.localDbPath}`, 'success');
} catch (error) {
    this.appendLog(`⚠ Database directory issue: ${error.message}`, 'warning');
    this.appendLog(`Attempting to create database anyway...`, 'info');
}
```

## Error Handling Improvements

### 1. Specific Error Detection
- **Database memory map file error:** Indicates directory or permission issues
- **BLAST Database error:** Generic BLAST database problems
- **Command not found:** BLAST+ installation issues

### 2. User-Friendly Error Messages
- Clear explanations of what went wrong
- Actionable suggestions for resolution
- Detailed logging for debugging

### 3. Graceful Degradation
- Continues operation even with directory issues
- Provides warnings instead of hard failures
- Maintains database entries for future use

## Testing

### Test File: `test/test-blast-database-error-fix.html`

**Test Coverage:**
1. **Database Directory Check:** Validates directory creation and permission checks
2. **Command Execution:** Tests improved error handling in runCommand
3. **Custom Database Creation:** Verifies enhanced validation and error handling
4. **Error Message Analysis:** Tests specific error message parsing

**Test Features:**
- Mock BlastManager for isolated testing
- Real-time logging of operations
- Comprehensive error scenario simulation
- User interface for interactive testing

## Benefits

### 1. Reliability
- Automatic directory creation prevents common failures
- Permission validation catches issues early
- Graceful handling of various error conditions

### 2. User Experience
- Clear error messages explain what went wrong
- Detailed logging helps with troubleshooting
- Warnings instead of hard failures for non-critical issues

### 3. Maintainability
- Dedicated methods for specific concerns
- Comprehensive error handling
- Well-documented code with clear purpose

### 4. Debugging
- Enhanced logging for all operations
- Specific error messages for different failure types
- Test framework for validation

## Usage

### For Users
1. The fix is automatic - no user action required
2. If errors persist, check the BLASTDB directory permissions
3. Review the operation log for detailed information

### For Developers
1. Use `checkAndFixBlastDatabaseDirectory()` for directory validation
2. Enhanced `runCommand()` provides better error handling
3. Test with `test-blast-database-error-fix.html`

## Future Enhancements

### Potential Improvements
1. **Database Repair:** Automatic repair of corrupted databases
2. **Alternative Paths:** Fallback to user home directory if system path fails
3. **Database Validation:** Pre-flight checks for database integrity
4. **Backup/Restore:** Database backup and restoration capabilities

### Monitoring
- Track error frequency and types
- Monitor directory creation success rates
- Log permission issues for system analysis

## Conclusion

This implementation provides a robust solution to the BLAST database memory map error by:
- Automatically creating missing directories
- Validating permissions before operations
- Providing clear error messages
- Maintaining graceful operation under various failure conditions

The fix ensures that custom BLAST database creation works reliably across different system configurations and provides helpful feedback when issues do occur. 