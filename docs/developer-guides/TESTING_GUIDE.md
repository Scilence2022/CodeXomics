# Testing Guide for Rebuilt Bioinformatics Tools

## Quick Start Testing

### Prerequisites
1. Ensure Genome AI Studio is installed
2. Have the application running
3. Main window should be visible

## Test Suite 1: Basic Tool Functionality

### Test 1.1: KEGG Pathway Analyzer

**Steps**:
1. Open Tools → KEGG Pathway Enrichment Analysis
2. Verify window opens with modern gradient UI
3. Click "Load Example" button
4. Verify example genes are loaded:
   ```
   TP53
   EGFR
   BRCA1
   MYC
   KRAS
   PTEN
   RB1
   APC
   ```
5. Click "Analyze Pathways"
6. Wait for analysis to complete (~1-2 seconds)

**Expected Results**:
- ✅ Window opens with purple-blue gradient background
- ✅ Form controls are visible and responsive
- ✅ Example data loads correctly
- ✅ Loading spinner appears during analysis
- ✅ Results display with pathway cards
- ✅ Each pathway shows:
  - Pathway ID and name
  - Gene count statistics
  - P-value and FDR
  - Matched genes list
  - "View in KEGG" button
  - "Ask ChatBox" button
- ✅ "Analyze in ChatBox" header button becomes visible

**Pass Criteria**: All pathway cards displayed with correct formatting, no console errors

---

### Test 1.2: Gene Ontology Analyzer

**Steps**:
1. Open Tools → Gene Ontology (GO) Analyzer
2. Click "Load Example"
3. Verify all three GO namespace checkboxes are checked:
   - ✅ Biological Process (BP)
   - ✅ Molecular Function (MF)
   - ✅ Cellular Component (CC)
4. Click "Analyze GO Terms"
5. Wait for analysis

**Expected Results**:
- ✅ Window opens with purple gradient
- ✅ Namespace summary cards display with color coding:
  - Green for BP
  - Orange for MF
  - Blue for CC
- ✅ GO term cards show correct namespace badges
- ✅ Each term displays:
  - GO ID (e.g., GO:0006915)
  - Term name
  - Description
  - Statistics (gene count, enrichment score, p-value, FDR)
  - Matched genes
- ✅ Cards have colored left borders matching namespace

**Pass Criteria**: Namespace distribution correct, all terms properly categorized

---

### Test 1.3: InterPro Domain Analyzer

**Steps**:
1. Open Tools → InterPro Domain Analysis
2. Click "Load Example"
3. Verify protein kinase sequence loads
4. Select E-value threshold: 0.1 (Moderate)
5. Click "Analyze Domains"
6. Wait for analysis

**Expected Results**:
- ✅ FASTA sequence parsed correctly
- ✅ Sequence length calculated (should be ~300 AA)
- ✅ Domain cards display:
  - Domain ID (e.g., IPR000719)
  - Domain name and type badge (DOMAIN/FAMILY/SITE)
  - Position information (start-end)
  - E-value and score
  - Source database (Pfam, SMART, etc.)
- ✅ Sequence viewer shows formatted sequence
- ✅ Color-coded domain types

**Pass Criteria**: Domains identified, sequence viewer functional, no parsing errors

---

## Test Suite 2: UI/UX Testing

### Test 2.1: Visual Design

**Check each analyzer for**:
- ✅ Glass-morphism effect on panels
- ✅ Smooth gradient backgrounds
- ✅ Consistent color scheme
- ✅ Proper font rendering
- ✅ Icon display (FontAwesome)
- ✅ Hover effects on buttons
- ✅ Card shadow effects
- ✅ Responsive grid layout

**Test resizing**:
1. Resize window to different sizes
2. Verify layout adapts properly
3. Check sidebar remains usable

---

### Test 2.2: Status Messages

**For each analyzer**:

1. **Info Message**:
   - Start analysis → Should show "Querying database..."
   - Color: Blue with info icon

2. **Success Message**:
   - Complete analysis → "Found X results"
   - Color: Green with check icon

3. **Warning Message**:
   - Submit empty form → "Please enter data"
   - Color: Yellow with warning icon

4. **Error Message**:
   - Trigger error → "Analysis failed"
   - Color: Red with error icon

**Pass Criteria**: All message types display correctly with auto-dismiss after 5 seconds

---

### Test 2.3: Loading States

**Test loading indicators**:

1. Click analyze button
2. Verify loading spinner appears immediately
3. Check loading message displays
4. Spinner should animate (rotating)
5. Loading disappears when complete

**Pass Criteria**: Smooth transitions, no flickering

---

## Test Suite 3: ChatBox Integration

### Test 3.1: Analyzer → ChatBox Communication

**KEGG Analyzer Test**:
1. Run KEGG analysis
2. Click "Analyze in ChatBox" button in header
3. Switch to main window ChatBox panel

**Expected**:
- ✅ ChatBox receives message automatically
- ✅ System message appears: "📊 Analysis request from KEGG Pathway Analysis"
- ✅ Query is formatted with pathway names
- ✅ No errors in console

**GO Analyzer Test**:
1. Click specific GO term's "Ask ChatBox" button
2. Check ChatBox

**Expected**:
- ✅ Specific question about that GO term sent
- ✅ Query includes gene names and namespace

**InterPro Analyzer Test**:
1. Click "Ask ChatBox" on specific domain
2. Verify query in ChatBox

**Expected**:
- ✅ Domain-specific question formatted
- ✅ Includes position information

---

### Test 3.2: LLM Interpretation Request

**Note**: This requires ChatBox integration code to be added (see CHATBOX_ANALYZER_INTEGRATION_GUIDE.md)

**Steps**:
1. Run analysis in any analyzer
2. Click "AI Interpret" button
3. Wait for response

**Expected** (when ChatBox integration complete):
- ✅ Request sent to ChatBox
- ✅ LLM processes query
- ✅ Interpretation appears in analyzer window
- ✅ Interpretation panel displays with AI icon
- ✅ Can close interpretation panel
- ✅ Can request more details

---

### Test 3.3: Pending Data System

**Test sequence**:
1. Close all analyzer windows
2. In browser console of main window:
   ```javascript
   const { ipcRenderer } = require('electron');
   ipcRenderer.send('send-to-analyzer', {
     toolName: 'kegg-analyzer',
     data: {
       enrichedPathways: [
         { id: 'hsa04110', name: 'Cell cycle', geneCount: 5, pValue: 0.001 }
       ]
     },
     originalQuery: 'Test'
   });
   ```
3. KEGG analyzer should open automatically
4. Data should be displayed

**Expected**:
- ✅ Analyzer opens
- ✅ Data loads automatically
- ✅ Displays pending data message if applicable

---

## Test Suite 4: Data Export

### Test 4.1: Basic Export

**For each analyzer**:
1. Run analysis
2. Look for export options (if visible)
3. Test export functionality

**Expected**: JSON export with complete data structure

---

### Test 4.2: Export with Interpretation

**When LLM integration complete**:
1. Get LLM interpretation
2. Click "Export with Interpretation"
3. Verify exported file includes:
   - Original results
   - LLM interpretation text
   - Metadata (timestamp, tool name)

---

## Test Suite 5: Edge Cases

### Test 5.1: Empty Input

**For each analyzer**:
1. Clear all input fields
2. Click analyze
3. Verify warning message appears
4. No analysis runs

---

### Test 5.2: Invalid Input

**KEGG/GO Analyzers**:
- Input: Special characters only (`@#$%`)
- Expected: Handles gracefully or shows warning

**InterPro Analyzer**:
- Input: Non-amino acid characters
- Expected: Strips invalid characters or shows error

---

### Test 5.3: Very Large Input

**InterPro Analyzer**:
- Input: 10,000+ character sequence
- Expected: Processes without freezing UI

**KEGG/GO Analyzers**:
- Input: 1000+ genes
- Expected: Handles or shows limit warning

---

## Test Suite 6: Cross-Platform

### Test 6.1: macOS

- ✅ Window opens correctly
- ✅ Keyboard shortcuts work
- ✅ Menu items functional
- ✅ File dialogs work (if applicable)

### Test 6.2: Windows

(Same checks as macOS)

### Test 6.3: Linux

(Same checks as macOS)

---

## Test Suite 7: Performance

### Test 7.1: Window Open Speed

1. Close all analyzer windows
2. Start timer
3. Open analyzer from menu
4. Stop timer when window visible

**Target**: < 1 second

---

### Test 7.2: Analysis Speed

1. Load example data
2. Start timer
3. Click analyze
4. Stop timer when results display

**Target**: < 2 seconds for example data

---

### Test 7.3: Memory Usage

1. Open all 3 analyzers
2. Run analyses in each
3. Check Task Manager/Activity Monitor
4. Memory should be reasonable

**Target**: < 500MB combined

---

## Test Suite 8: Error Recovery

### Test 8.1: Network Simulation

*Note: Current implementation uses mock data, this will be relevant when real APIs are integrated*

**Future test**:
1. Disconnect network
2. Run analysis
3. Should fall back gracefully

---

### Test 8.2: Window Crash Recovery

1. Force close analyzer window during analysis
2. Reopen analyzer
3. Should start fresh, no corrupted state

---

## Automated Test Script

### Browser Console Tests

```javascript
// Test all analyzers programmatically
async function testAllAnalyzers() {
  const tests = [];
  
  // Test KEGG Analyzer
  tests.push({
    name: 'KEGG Analyzer',
    test: () => {
      const kegg = new KEGGAnalyzer();
      kegg.loadExample();
      return kegg.analyzePathways();
    }
  });
  
  // Test GO Analyzer
  tests.push({
    name: 'GO Analyzer',
    test: () => {
      const go = new GOAnalyzer();
      go.loadExample();
      return go.analyzeGO();
    }
  });
  
  // Test InterPro Analyzer
  tests.push({
    name: 'InterPro Analyzer',
    test: () => {
      const interpro = new InterProAnalyzer();
      interpro.loadExample();
      return interpro.analyzeDomains();
    }
  });
  
  // Run all tests
  for (const test of tests) {
    console.log(`Testing ${test.name}...`);
    try {
      await test.test();
      console.log(`✅ ${test.name} passed`);
    } catch (error) {
      console.error(`❌ ${test.name} failed:`, error);
    }
  }
}

// Run tests
testAllAnalyzers();
```

---

## Regression Testing Checklist

Before each release, verify:

- [ ] All 3 analyzers open from menu
- [ ] Example data loads in all tools
- [ ] Analysis completes without errors
- [ ] Results display correctly
- [ ] ChatBox communication works
- [ ] No console errors
- [ ] UI renders properly
- [ ] Status messages appear
- [ ] Loading indicators work
- [ ] External links open correctly

---

## Bug Reporting Template

If you find issues, report with:

```
**Tool**: KEGG/GO/InterPro Analyzer
**Version**: Genome AI Studio version
**OS**: macOS/Windows/Linux + version
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**:

**Actual Behavior**:

**Console Errors** (if any):

**Screenshots** (if applicable):
```

---

## Test Results Log

| Test Suite | Date | Tester | Status | Notes |
|------------|------|--------|--------|-------|
| Suite 1    |      |        |        |       |
| Suite 2    |      |        |        |       |
| Suite 3    |      |        |        |       |
| Suite 4    |      |        |        |       |
| Suite 5    |      |        |        |       |
| Suite 6    |      |        |        |       |
| Suite 7    |      |        |        |       |
| Suite 8    |      |        |        |       |

---

## Known Limitations (Current Implementation)

1. **Mock Data**: All analyzers currently use simulated data
   - KEGG API calls not yet implemented
   - GO database not integrated
   - InterPro REST API not connected

2. **ChatBox Integration**: Partially implemented
   - IPC handlers in main.js: ✅ Complete
   - Analyzer side: ✅ Complete
   - ChatBox side: ⚠️ Requires additional code (see integration guide)

3. **Real-time Features**: Not yet implemented
   - Progress updates during long analyses
   - Cancellation of running analyses

4. **Advanced Exports**: Basic JSON only
   - PDF export not implemented
   - Excel export not implemented
   - Custom format options not available

---

## Success Criteria

The rebuilt tools are considered successful if:

✅ All basic functionality tests pass
✅ UI/UX is modern and responsive
✅ No critical errors in console
✅ Performance targets met
✅ ChatBox communication established
✅ Code is maintainable and extensible

---

## Next Steps After Testing

1. **Fix any critical bugs** found during testing
2. **Implement real API integrations** (KEGG, GO, InterPro)
3. **Complete ChatBox integration** using the guide
4. **Add advanced features** (export formats, visualizations)
5. **Optimize performance** if needed
6. **Write user documentation**

---

## Testing Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Developer | | | |
| QA Tester | | | |
| Tech Lead | | | |
| Product Owner | | | |
