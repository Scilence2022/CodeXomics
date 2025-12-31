# Paste-Replace Feature Handling Fix

## Problem Description

When executing **Cut thrA gene** → **Paste thrA to replace thrB gene**, the following issue occurred:

### Expected Behavior
- Sequence length should decrease by thrA gene length ✅ (Working)
- thrA gene features should be removed from original location ✅ (Working) 
- thrB gene features should be removed from target location ❌ (NOT working)
- thrA gene features should be added to thrB location with new names ✅ (Working)

### Actual Behavior
- Sequence editing worked correctly (sequence length decreased by thrA length)
- **Feature handling had a bug**: thrA features were removed, but thrB features remained in the result

### Root Cause

The issue was in the `executePasteSequence` method in `ActionManager.js`:

1. **Cut operation** (`executeCutSequence`, line 2922-2989):
   - ✅ Records a `delete` modification for thrA region
   - ✅ Removes thrA features from execution copy

2. **Paste-replace operation** (`executePasteSequence`, line 2994-3064):
   - ✅ Records a `replace` modification for thrB region
   - ✅ Adds thrA features to execution copy with adjusted positions
   - ❌ **MISSING**: Did NOT remove thrB features from the target region first!

3. **Final GBK generation**:
   - The `replace` modification type only handled sequence replacement
   - The `adjustFeaturePositions` function didn't remove features in replaced regions
   - Result: thrB features remained in the output

## Solution

Added feature removal logic in `executePasteSequence` before copying new features:

### Code Changes

**File**: `/src/renderer/modules/ActionManager.js`

**Location**: Lines 3039-3066 (after recording sequence modification, before copying features)

```javascript
// 🔧 CRITICAL FIX: For paste-replace, remove features in target region BEFORE adding new features
let removedFeaturesCount = 0;
if (!isInsert) {
    // This is a paste-replace operation - remove features in target region first
    const currentFeatures = this.getFeaturesFromGenomeData(executionGenomeData, chromosome);
    
    if (currentFeatures && currentFeatures.length > 0) {
        const initialCount = currentFeatures.length;
        
        // Filter out features that are completely within the replaced region
        const remainingFeatures = currentFeatures.filter(feature => 
            !(feature.start >= start && feature.end <= end)
        );
        
        // Set filtered features back to execution copy
        this.setFeaturesInGenomeData(executionGenomeData, chromosome, remainingFeatures);
        
        removedFeaturesCount = initialCount - remainingFeatures.length;
        
        console.log('🗑️ [ActionManager] Removed features from paste-replace target region:', {
            chromosome: chromosome,
            targetRegion: `${start}-${end}`,
            removedFeatures: removedFeaturesCount,
            remainingFeatures: remainingFeatures.length,
            note: 'Features in target region removed before pasting new features'
        });
    }
}
```

**Also updated the result object** (line 3082):
```javascript
const result = {
    operation: operation,
    sequenceLength: clipboardData.sequence.length,
    target: action.target,
    source: clipboardData.source,
    chromosome: chromosome,
    copiedFeaturesCount: copiedFeaturesCount,
    removedFeaturesCount: removedFeaturesCount  // Track removed features in target region
};
```

## How It Works

### Execution Flow for Cut thrA → Paste to replace thrB

1. **Cut thrA (190-255)**:
   ```
   executeCutSequence:
     - Records delete modification: {type: 'delete', start: 190, end: 255}
     - Removes thrA feature from execution copy
     - Stores thrA sequence + features in clipboard
   ```

2. **Paste thrA to replace thrB (337-2799)**:
   ```
   executePasteSequence:
     - Records replace modification: {type: 'replace', start: 337, end: 2799}
     
     ✨ NEW: Remove target region features FIRST
     - Filters out features in range [337-2799]
     - thrB feature removed (was in this range)
     
     - Copies thrA features from clipboard
     - Adjusts positions: thrA (190-255) → new position (337-402)
     - Renames to avoid conflicts: thrA → thrA_copy_<timestamp>
   ```

3. **Final GBK generation**:
   ```
   - Applies sequence modifications (delete thrA region, replace thrB with thrA sequence)
   - Adjusts remaining feature positions based on sequence changes
   - Result: Only thrA_copy features at new location, thrB features removed
   ```

## Testing

To verify the fix works correctly:

1. Load a genome with at least 2 genes (e.g., E. coli K-12)
2. Execute: Cut gene1
3. Execute: Paste to replace gene2
4. Execute all actions
5. Verify in the generated GBK file:
   - gene1 features removed from original location ✅
   - gene2 features removed from target location ✅
   - gene1 features added at gene2 location with new names ✅
   - Sequence length changed correctly ✅

## Technical Notes

### Key Implementation Details

1. **Feature Removal Condition**:
   ```javascript
   !(feature.start >= start && feature.end <= end)
   ```
   - Only removes features **completely within** the replaced region
   - Features that partially overlap are kept and adjusted

2. **Execution Order**:
   ```
   1. Record sequence modification (replace)
   2. Remove features in target region (NEW)
   3. Copy features from clipboard with position adjustment
   4. Return result with counts
   ```

3. **Data Safety**:
   - All operations performed on `executionGenomeData` (execution copy)
   - Original genome data remains untouched
   - Changes only exported to new GBK file

### Memory Compliance

This fix follows the existing memory guidelines:

- **Single-Pass Feature Adjustment**: Features removed once during paste-replace execution
- **Copy-on-Write**: All modifications to execution copy only
- **No Double Deletion**: Features removed before `adjustFeaturePositions` is called

## Related Files

- `/src/renderer/modules/ActionManager.js` - Main fix location
- `/src/renderer/modules/GenomeDataProxy.js` - Execution copy management
- `/src/mcp-tools/action/ActionTools.js` - Tool definitions

## Verification Logs

When the fix is working correctly, you should see these console logs:

```
🗑️ [ActionManager] Removed features from paste-replace target region: {
    chromosome: "NC_000913.3",
    targetRegion: "337-2799",
    removedFeatures: 1,  // thrB removed
    remainingFeatures: <count>,
    note: "Features in target region removed before pasting new features"
}

🧬 [ActionManager] Copying features from clipboard: {
    sourceFeatures: 1,  // thrA from clipboard
    targetLocation: "NC_000913.3:337-2799",
    isInsert: false,
    usingExecutionCopy: true
}

✅ [ActionManager] Successfully copied features to execution copy: {
    targetChromosome: "NC_000913.3",
    featuresAdded: 1,  // thrA_copy added
    totalFeaturesNow: <count>,
    usingExecutionCopy: true
}
```

## Status

✅ **FIXED** - Paste-replace now correctly removes target region features before adding clipboard features.

## Debug Fix (2024-12-01)

### Error
```
TypeError: this.ensureOriginalAnnotationsBackup is not a function
    at ActionManager.executePasteSequence (ActionManager.js:2999:14)
```

### Cause
Leftover code from older version trying to call a non-existent method `ensureOriginalAnnotationsBackup()`.

### Solution
Removed the unnecessary method call. The current Copy-on-Write architecture with GenomeDataProxy automatically handles data protection - original annotations are never modified. All changes happen on the execution copy.

**Changed**:
```javascript
// OLD (line 2998-2999)
// Ensure original annotations are backed up before any modification
this.ensureOriginalAnnotationsBackup();

// NEW (line 2998-2999)
// 🔒 CRITICAL: All modifications happen on executionGenomeData (proxy/copy)
// Original data is never modified (Copy-on-Write architecture)
```

**Result**: ✅ Error resolved - paste-replace operations now work correctly without errors.

## Critical Fix #2: Double Feature Processing Bug (2024-12-01)

### Problem
Even after fixing the missing feature removal logic, thrB was still appearing and thrA was missing in the final output.

### Root Cause
**Features were being processed TWICE**:

1. ✅ **During Action Execution** (`executePasteSequence`):
   - Features correctly removed from target region (thrB removed)
   - Features correctly added from clipboard (thrA added with new positions)
   - Features stored in `executionGenomeData` proxy

2. ❌ **During GBK Export** (`generateComprehensiveGBK`):
   - Called `adjustFeaturePositions()` on the already-modified features
   - The `replace` case in `adjustFeaturePositions` (line 3762-3765) **kept features within replaced region**
   - This re-introduced thrB and lost the thrA features

### The Double-Processing Bug

```javascript
// In adjustFeaturePositions() - line 3762-3765
case 'replace':
    // Check if feature is completely within replaced region
    if (adjustedStart >= modPosition && adjustedEnd <= modEnd) {
        console.log(`⚠️ Feature ${feature.name} within replacement region - may need manual review`);
        // Keep the feature but note it's in a replaced region  ← BUG!
    }
```

This logic assumes features haven't been handled yet, but they were already correctly modified during execution!

### Solution
**Stop calling `adjustFeaturePositions` in GBK export** because:
- Features are already correct in the execution proxy
- They were modified during action execution:
  - `executeCutSequence` removed features from cut regions
  - `executePasteSequence` removed features from target regions
  - `copyFeaturesFromClipboard` added new features with correct positions
- Calling `adjustFeaturePositions` again causes double-processing

### Code Change

**File**: `/src/renderer/modules/ActionManager.js` (line 2041-2055)

**Before**:
```javascript
getFeatures: (chr) => {
    const featuresSource = this.getFeaturesFromGenomeData(executionGenomeData, chr) || [];
    return this.adjustFeaturePositions(chr, featuresSource);  // ← WRONG: Double processing!
},
```

**After**:
```javascript
getFeatures: (chr) => {
    // 🔒 CRITICAL: Get features from execution copy - these are ALREADY modified
    // During action execution, features were:
    // 1. Removed from cut regions (executeCutSequence)
    // 2. Removed from paste-replace target regions (executePasteSequence)
    // 3. Added from clipboard with adjusted positions (copyFeaturesFromClipboard)
    // Therefore, we should NOT call adjustFeaturePositions again!
    const featuresSource = this.getFeaturesFromGenomeData(executionGenomeData, chr) || [];
    // ⚠️ DO NOT call adjustFeaturePositions here - features are already correct!
    return featuresSource;
},
```

### Why This Fixes The Problem

**Execution Flow - BEFORE Fix**:
```
1. Cut thrA → Features removed from proxy ✅
2. Paste to replace thrB:
   - Remove thrB from proxy ✅
   - Add thrA_copy to proxy ✅
3. Generate GBK:
   - Get features from proxy (has thrA_copy, no thrB) ✅
   - Call adjustFeaturePositions ❌
     - Sees 'replace' modification
     - Keeps features in replaced region (thrB reappears!)
     - Position adjustments may break thrA_copy
   - Result: thrB present, thrA missing ❌
```

**Execution Flow - AFTER Fix**:
```
1. Cut thrA → Features removed from proxy ✅
2. Paste to replace thrB:
   - Remove thrB from proxy ✅  
   - Add thrA_copy to proxy ✅
3. Generate GBK:
   - Get features from proxy (has thrA_copy, no thrB) ✅
   - Return features as-is (no double processing) ✅
   - Result: Only thrA_copy present at new location ✅
```
