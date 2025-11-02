# Export Config Dialog Visibility Fix

## Problem

The Export Configuration dialog was being created successfully (as shown in console logs) but was not visible to users, indicating a z-index or positioning issue where the dialog was being hidden behind other elements.

## Root Cause Analysis

1. **Z-index Conflict**: Other modals in GenomeExplorer use z-index: 10000
2. **Positioning Issues**: Modal overlay might not have explicit positioning
3. **Style Conflicts**: Existing CSS might override dialog styles

## Solution

### 1. Enhanced Z-index Strategy
```javascript
// Increased z-index to ensure dialog appears above all other elements
<div id="exportConfigDialog" class="modal-overlay" 
     style="display: flex; z-index: 15000; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.5);">
```

### 2. Forced Visibility Verification
```javascript
// Added visibility check and forced display
setTimeout(() => {
    const dialog = document.getElementById('exportConfigDialog');
    if (dialog) {
        const isVisible = dialog.offsetWidth > 0 && dialog.offsetHeight > 0;
        if (!isVisible) {
            // Force visibility with inline styles
            dialog.style.display = 'flex';
            dialog.style.position = 'fixed';
            dialog.style.zIndex = '20000';
            // ... other forced styles
        }
    }
}, 100);
```

### 3. Enhanced CSS with !important
```css
.modal-overlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 15000 !important;
    /* ... other styles with !important */
}
```

## Files Modified

- **`src/renderer/modules/ExportManager.js`**
  - Enhanced dialog HTML with explicit positioning and z-index
  - Added visibility verification and forced display logic
  - Updated CSS styles with !important declarations

## Testing

After this fix:
1. Click Export As → Configure
2. Console should show creation logs
3. Dialog should now be visible with dark overlay
4. Configuration options should be accessible

If dialog is still not visible, check browser console for the visibility check logs that will help diagnose the specific issue.

## Debug Commands

If issues persist, use these console commands:
```javascript
// Check if dialog exists
document.getElementById('exportConfigDialog')

// Force open dialog
window.genomeBrowser.exportManager.showExportConfigDialog()

// Check z-index conflicts
Array.from(document.querySelectorAll('*')).filter(el => parseInt(window.getComputedStyle(el).zIndex) > 10000)
```
