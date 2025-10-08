/**
 * Unified Version Management for CodeXomics
 * 
 * This file centralizes all version-related information to ensure consistency
 * across the application. All other files should import from this file.
 * 
 * @author CodeXomics Team
 * @version 0.522
 */

// Core application version
const VERSION_MAJOR = 0;
const VERSION_MINOR = 522;
const VERSION_PATCH = 0;
const VERSION_PRERELEASE = null;

// Build version string
const VERSION_STRING = `${VERSION_MAJOR}.${VERSION_MINOR}.${VERSION_PATCH}`;
const VERSION_FULL = VERSION_PRERELEASE ? `${VERSION_STRING}-${VERSION_PRERELEASE}` : VERSION_STRING;

// Display versions
const VERSION_DISPLAY = `v${VERSION_MAJOR}.${VERSION_MINOR}`;
const VERSION_DISPLAY_FULL = `v${VERSION_FULL}`;

// Application information
const APP_NAME = 'CodeXomics';
const APP_TITLE = `${APP_NAME} ${VERSION_DISPLAY}`;
const APP_TITLE_FULL = `${APP_NAME} ${VERSION_DISPLAY_FULL}`;

// Build information
const BUILD_DATE = new Date().toISOString();
const BUILD_YEAR = new Date().getFullYear();

// API versions
const API_VERSION = 'v1';
const CONFIG_VERSION = '1.0';
const PLUGIN_API_VERSION = '2.0.0';

// Export all version information
const VERSION_INFO = {
    // Core version components
    major: VERSION_MAJOR,
    minor: VERSION_MINOR,
    patch: VERSION_PATCH,
    prerelease: VERSION_PRERELEASE,
    
    // Version strings
    version: VERSION_STRING,
    fullVersion: VERSION_FULL,
    displayVersion: VERSION_DISPLAY,
    displayFullVersion: VERSION_DISPLAY_FULL,
    
    // Application info
    appName: APP_NAME,
    appTitle: APP_TITLE,
    appTitleFull: APP_TITLE_FULL,
    
    // Build info
    buildDate: BUILD_DATE,
    buildYear: BUILD_YEAR,
    
    // API versions
    apiVersion: API_VERSION,
    configVersion: CONFIG_VERSION,
    pluginApiVersion: PLUGIN_API_VERSION,
    
    // Utility methods
    toString() {
        return VERSION_FULL;
    },
    
    toDisplayString() {
        return VERSION_DISPLAY;
    },
    
    getAppTitle() {
        return APP_TITLE;
    },
    
    getBuildInfo() {
        return {
            version: VERSION_FULL,
            buildDate: BUILD_DATE,
            buildYear: BUILD_YEAR
        };
    },
    
    // Semantic version comparison
    compareVersion(otherVersion) {
        const parseVersion = (version) => {
            const [main, pre] = version.split('-');
            const [major, minor, patch] = main.split('.').map(Number);
            return { major, minor, patch, prerelease: pre };
        };
        
        const current = parseVersion(VERSION_FULL);
        const other = parseVersion(otherVersion);
        
        if (current.major !== other.major) return current.major - other.major;
        if (current.minor !== other.minor) return current.minor - other.minor;
        if (current.patch !== other.patch) return current.patch - other.patch;
        
        // Handle prerelease comparison
        if (current.prerelease && !other.prerelease) return -1;
        if (!current.prerelease && other.prerelease) return 1;
        if (current.prerelease && other.prerelease) {
            return current.prerelease.localeCompare(other.prerelease);
        }
        
        return 0;
    }
};

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VERSION_INFO;
}

// For browser environments
if (typeof window !== 'undefined') {
    window.VERSION_INFO = VERSION_INFO;
}

// For ES6 modules (when supported)
if (typeof exports !== 'undefined') {
    // Export individual components for destructuring
    exports.version = VERSION_INFO.version;
    exports.fullVersion = VERSION_INFO.fullVersion;
    exports.displayVersion = VERSION_INFO.displayVersion;
    exports.displayFullVersion = VERSION_INFO.displayFullVersion;
    exports.appName = VERSION_INFO.appName;
    exports.appTitle = VERSION_INFO.appTitle;
    exports.appTitleFull = VERSION_INFO.appTitleFull;
    exports.buildDate = VERSION_INFO.buildDate;
    exports.buildYear = VERSION_INFO.buildYear;
    exports.apiVersion = VERSION_INFO.apiVersion;
    exports.configVersion = VERSION_INFO.configVersion;
    exports.pluginApiVersion = VERSION_INFO.pluginApiVersion;
} 