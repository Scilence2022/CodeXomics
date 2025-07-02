# Track Duplication Fix Test

## Issue Description
After loading NGS reads or multiple WIG files, duplicated tracks of Genes & Features, GC Content & Skew, VCF Variants, and Aligned Reads wrongly emerged. After navigating to a different position, these duplicated tracks disappeared.

## Root Cause
1. **Multiple Auto-Enable Calls**: `autoEnableTracksForFileType()` was called multiple times:
   - Once for each WIG file during `parseWIG()`
   - Once more in `loadMultipleWIGFiles()` 
   - Similar issues with VCF and SAM files

2. **Race Conditions**: Multiple simultaneous calls to `updateVisibleTracks()` → `displayGenomeView()` caused track rendering to overlap

3. **No Duplicate Protection**: No checks to prevent enabling already-enabled tracks

## Fixes Implemented

### 1. Enhanced `autoEnableTracksForFileType()`
- Added checks to prevent duplicate track enabling
- Only calls `updateVisibleTracks()` if tracks were actually enabled
- Provides feedback when tracks are already enabled

### 2. Multiple WIG Files Protection
- Added `_isLoadingMultipleWIGFiles` flag
- Prevents individual `parseWIG()` calls from auto-enabling during batch loading
- Auto-enables tracks only once after all files are processed

### 3. Rendering Race Condition Protection  
- Added `_isRenderingView` guard in `displayGenomeView()`
- Prevents multiple simultaneous rendering operations
- Ensures only one track rendering happens at a time

### 4. Debounced Track Updates
- Added 50ms debouncing to `updateVisibleTracks()` and `updateVisibleTracksFromSidebar()`
- Prevents rapid successive calls during file loading

## How to Test

### Test Case 1: Multiple WIG Files
1. Load multiple WIG files using "File → WIG Tracks"
2. Select 2-3 WIG files at once
3. Verify that tracks appear only once (no duplicates)
4. Navigate to different positions - tracks should remain single

### Test Case 2: NGS Reads Loading
1. Load a SAM file using "File → NGS Reads" 
2. Verify Aligned Reads track appears only once
3. Navigate to different positions - no duplicates should appear

### Test Case 3: VCF Loading
1. Load a VCF file using "File → Variants"
2. Verify VCF Variants track appears only once
3. Navigate to different positions - track should remain single

### Test Case 4: Sequential File Loading
1. Load a FASTA file first
2. Then load a VCF file
3. Then load multiple WIG files
4. Then load a SAM file
5. Verify all tracks appear correctly without duplicates

## Expected Behavior After Fix
- ✅ Tracks are enabled only once per file type
- ✅ No duplicate tracks appear after loading multiple files
- ✅ Navigation doesn't cause tracks to disappear/reappear
- ✅ Status messages indicate when tracks are "already enabled"
- ✅ All track functionality (resizing, reordering) works normally

## Console Logs to Monitor
Watch for these console messages that indicate the fix is working:
- `[displayGenomeView] Already rendering, skipping duplicate call`
- `[autoEnableTracksForFileType] Track already enabled`
- `Merged X new WIG tracks. Total tracks: Y tracks` 