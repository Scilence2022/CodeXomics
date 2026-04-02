# Actions System Quick Reference

**Quick access guide for developers working with the Actions System**

---

## Quick Start

### Basic Usage

```javascript
// Initialize (already done in renderer-modular.js)
const actionManager = new ActionManager(genomeBrowser);

// Add a copy action
actionManager.addAction(actionManager.ACTION_TYPES.COPY_SEQUENCE, 'chr1:1000-2000(+)', 'Copy promoter region', {
  chromosome: 'chr1',
  start: 1000,
  end: 2000,
  strand: '+',
});

// Execute all pending actions
await actionManager.executeAllActions();
```

---

## Common Patterns

### Pattern 1: Copy-Paste Sequence

```javascript
// Copy
actionManager.handleCopySequence(); // Interactive (shows modal)
// OR
await actionManager.executeActionFunction('copySequence', {
  chromosome: 'chr1',
  start: 1000,
  end: 2000,
  strand: '+',
});

// Paste
actionManager.handlePasteSequence(); // Interactive (shows modal)
// OR
await actionManager.executeActionFunction('pasteSequence', {
  chromosome: 'chr2',
  start: 5000,
  end: 5000,
});

// Execute
await actionManager.executeAllActions();
```

### Pattern 2: Delete Region

```javascript
// Add delete action
actionManager.addAction(actionManager.ACTION_TYPES.DELETE_SEQUENCE, 'chr1:1000-2000(+)', 'Delete 1kb region', {
  chromosome: 'chr1',
  start: 1000,
  end: 2000,
  strand: '+',
});

// Execute
await actionManager.executeAllActions();
```

### Pattern 3: Insert Sequence

```javascript
// Add insert action
actionManager.addAction(actionManager.ACTION_TYPES.INSERT_SEQUENCE, 'chr1:1000', 'Insert restriction site', {
  chromosome: 'chr1',
  start: 1000,
  end: 1000,
  insertSequence: 'GAATTC',
  strand: '+',
});

// Execute
await actionManager.executeAllActions();
```

### Pattern 4: Replace Region

```javascript
// Add replace action
actionManager.addAction(
  actionManager.ACTION_TYPES.REPLACE_SEQUENCE,
  'chr1:1000-1006(+)',
  'Replace with optimized codon',
  {
    chromosome: 'chr1',
    start: 1000,
    end: 1006,
    newSequence: 'ATGATG',
    strand: '+',
  }
);

// Execute
await actionManager.executeAllActions();
```

---

## MCP Function Calls

### For AI/External Tools

```javascript
// Copy sequence (MCP)
const result = await actionManager.executeActionFunction('copySequence', {
  chromosome: 'chr1',
  start: 1000,
  end: 2000,
  strand: '+',
});

// Get action list
const actions = actionManager.executeActionFunction('getActionList', {
  status: 'pending', // or 'all', 'completed', 'failed'
});

// Execute actions
const execResult = await actionManager.executeActionFunction('executeActions', {
  confirm: true,
});

// Clear actions
actionManager.executeActionFunction('clearActions', {
  status: 'completed',
});

// Get clipboard
const clipboard = actionManager.executeActionFunction('getClipboardContent', {});

// Undo last action
await actionManager.executeActionFunction('undoLastAction', {});
```

---

## Action Object Structure

```javascript
{
    id: 1,                              // Unique ID
    type: 'copy_sequence',              // Action type
    target: 'chr1:1000-2000(+)',        // Target location
    details: 'Copy promoter region',    // Description
    metadata: {
        chromosome: 'chr1',
        start: 1000,
        end: 2000,
        strand: '+',
        // ... type-specific fields
    },
    status: 'pending',                  // pending|executing|completed|failed
    timestamp: Date,                    // Creation time
    estimatedTime: 500,                 // Estimated ms
    result: null,                       // Execution result
    error: null                         // Error message
}
```

---

## Status Codes

```javascript
actionManager.STATUS = {
  PENDING: 'pending', // Waiting to execute
  EXECUTING: 'executing', // Currently running
  COMPLETED: 'completed', // Successfully finished
  FAILED: 'failed', // Execution failed
};
```

---

## Action Types

```javascript
actionManager.ACTION_TYPES = {
  COPY_SEQUENCE: 'copy_sequence', // Copy to clipboard
  CUT_SEQUENCE: 'cut_sequence', // Cut to clipboard
  PASTE_SEQUENCE: 'paste_sequence', // Paste from clipboard
  DELETE_SEQUENCE: 'delete_sequence', // Delete region
  INSERT_SEQUENCE: 'insert_sequence', // Insert new sequence
  REPLACE_SEQUENCE: 'replace_sequence', // Replace region
  SEQUENCE_EDIT: 'sequence_edit', // Generic edit
};
```

---

## Clipboard Operations

### Get Clipboard Content

```javascript
const clipboard = actionManager.clipboard;

if (clipboard) {
  console.log('Type:', clipboard.type); // 'copy' or 'cut'
  console.log('Sequence:', clipboard.sequence); // DNA string
  console.log('Source:', clipboard.source); // 'chr1:1000-2000(+)'
  console.log('Length:', clipboard.sequence.length); // Number of bp
  console.log('Features:', clipboard.comprehensiveData.features); // Array
}
```

### Check if Clipboard Has Data

```javascript
if (actionManager.clipboard && actionManager.clipboard.sequence) {
  // Clipboard has data
  console.log(`Clipboard contains ${actionManager.clipboard.sequence.length} bp`);
} else {
  // Clipboard empty
  console.log('Clipboard is empty');
}
```

---

## Selection Handling

### Get Active Selection

```javascript
const selection = actionManager.getActiveSelection();

if (selection.hasSelection) {
  console.log('Chromosome:', selection.chromosome);
  console.log('Start:', selection.start);
  console.log('End:', selection.end);
  console.log('Strand:', selection.strand);
  console.log('Source:', selection.source); // 'manual', 'gene', 'selectedGene'
  console.log('Name:', selection.name);
} else {
  console.log('No active selection');
}
```

---

## Queue Management

### Get Queue Status

```javascript
// Get all actions
const allActions = actionManager.actions;

// Get pending actions
const pending = actionManager.actions.filter(a => a.status === 'pending');

// Get completed actions
const completed = actionManager.actions.filter(a => a.status === 'completed');

// Get failed actions
const failed = actionManager.actions.filter(a => a.status === 'failed');

console.log(
  `Total: ${allActions.length}, Pending: ${pending.length}, Completed: ${completed.length}, Failed: ${failed.length}`
);
```

### Clear Queue

```javascript
// Clear all actions
actionManager.clearAllActions();

// Clear only completed
actionManager.actions = actionManager.actions.filter(a => a.status !== 'completed');
actionManager.updateActionListUI();

// Clear only failed
actionManager.actions = actionManager.actions.filter(a => a.status !== 'failed');
actionManager.updateActionListUI();
```

### Remove Specific Action

```javascript
// Remove by ID
actionManager.removeAction(actionId);

// Remove by index
const index = 0;
actionManager.actions.splice(index, 1);
actionManager.updateActionListUI();
```

---

## Feature Tracking

### Collect Region Data

```javascript
const data = await actionManager.collectComprehensiveData(
  'chr1', // chromosome
  1000, // start
  2000, // end
  '+' // strand
);

console.log('Region:', data.region);
console.log('Features:', data.features.length);
console.log('Variants:', data.variants.length);
console.log('Reads:', data.reads.length);
console.log('GC%:', data.metadata.gcContent);
```

### Get Sequence for Region

```javascript
const sequence = await actionManager.getSequenceForRegion(
  'chr1', // chromosome
  1000, // start
  2000, // end
  '+' // strand ('+' or '-')
);

console.log('Sequence:', sequence);
console.log('Length:', sequence.length);
```

---

## Conflict Detection

### Check for Conflicts

```javascript
const pending = actionManager.actions.filter(a => a.status === 'pending');
const analysis = actionManager.checkActionConflicts(pending);

if (analysis.hasConflicts) {
  console.log(`Found ${analysis.conflicts.length} conflicts`);

  analysis.conflicts.forEach(conflict => {
    console.log(`Conflict: ${conflict.description}`);
    console.log(`  Severity: ${conflict.severity}`);
    console.log(`  Chromosome: ${conflict.chromosome}`);
    console.log(`  Overlap: ${conflict.overlapStart}-${conflict.overlapEnd}`);
  });
} else {
  console.log('No conflicts detected');
}
```

---

## Export

### Generate GenBank File

```javascript
// Automatic during execution
await actionManager.executeAllActions();
// GBK file automatically generated with action history

// Manual generation
const executionActionsCopy = [...actionManager.actions];
const executionGenomeData = actionManager.createGenomeDataCopy(originalData);
const executionId = `manual_${Date.now()}`;

await actionManager.generateComprehensiveGBK(executionActionsCopy, executionGenomeData, executionId);
```

---

## Error Handling

### Try-Catch Pattern

```javascript
try {
  await actionManager.executeAllActions();
  console.log('✅ Actions executed successfully');
} catch (error) {
  console.error('❌ Execution failed:', error);

  // Check failed actions
  const failed = actionManager.actions.filter(a => a.status === 'failed');
  failed.forEach(action => {
    console.error(`Failed action ${action.id}:`, action.error);
  });
}
```

### Validation Before Execution

```javascript
// Validate before executing
const pending = actionManager.actions.filter(a => a.status === 'pending');

if (pending.length === 0) {
  console.log('No pending actions to execute');
} else {
  // Check conflicts
  const analysis = actionManager.checkActionConflicts(pending);

  if (analysis.hasConflicts) {
    console.warn('Conflicts detected!');
    // Show conflict dialog or handle
  } else {
    // Safe to execute
    await actionManager.executeAllActions();
  }
}
```

---

## UI Integration

### Show Action List

```javascript
// Show action list modal
actionManager.showActionList();

// Update action list UI
actionManager.updateActionListUI();

// Update stats display
actionManager.updateStats();
```

### Update Actions Track

```javascript
// Notify track to update
actionManager.notifyActionsTrackUpdate();

// Check if visible
const trackActionsCheckbox = document.getElementById('trackActions');
const isVisible = trackActionsCheckbox && trackActionsCheckbox.checked;

if (isVisible) {
  genomeBrowser.trackRenderer.updateActionsTrack();
}
```

---

## Advanced Usage

### Custom Action Metadata

```javascript
actionManager.addAction(actionManager.ACTION_TYPES.COPY_SEQUENCE, 'chr1:1000-2000(+)', 'Copy for analysis', {
  chromosome: 'chr1',
  start: 1000,
  end: 2000,
  strand: '+',
  // Custom metadata
  experimentId: 'EXP001',
  researcher: 'John Doe',
  purpose: 'Promoter analysis',
  tags: ['promoter', 'essential'],
  notes: 'Region of interest for transcription factor binding',
});
```

### Programmatic Action Creation

```javascript
// Create multiple actions programmatically
const regions = [
  { chr: 'chr1', start: 1000, end: 2000 },
  { chr: 'chr2', start: 3000, end: 4000 },
  { chr: 'chr3', start: 5000, end: 6000 },
];

regions.forEach(region => {
  actionManager.addAction(
    actionManager.ACTION_TYPES.COPY_SEQUENCE,
    `${region.chr}:${region.start}-${region.end}(+)`,
    `Copy ${region.chr} region`,
    {
      chromosome: region.chr,
      start: region.start,
      end: region.end,
      strand: '+',
    }
  );
});

console.log(`Created ${regions.length} actions`);
```

### Monitor Execution Progress

```javascript
// Track execution progress
let executedCount = 0;
const totalActions = actionManager.actions.filter(a => a.status === 'pending').length;

// Poll status during execution
const progressInterval = setInterval(() => {
  const completed = actionManager.actions.filter(a => a.status === 'completed' || a.status === 'failed').length;

  if (completed > executedCount) {
    executedCount = completed;
    const progress = ((executedCount / totalActions) * 100).toFixed(1);
    console.log(`Progress: ${progress}% (${executedCount}/${totalActions})`);
  }

  if (executedCount >= totalActions || !actionManager.isExecuting) {
    clearInterval(progressInterval);
    console.log('Execution complete');
  }
}, 100);

await actionManager.executeAllActions();
```

---

## Debugging

### Enable Verbose Logging

```javascript
// Check execution state
console.log('Is executing:', actionManager.isExecuting);
console.log('Actions count:', actionManager.actions.length);
console.log('Clipboard:', actionManager.clipboard);
console.log('Modifications:', actionManager.sequenceModifications);

// Log all actions
actionManager.actions.forEach((action, index) => {
  console.log(`Action ${index + 1}:`, {
    id: action.id,
    type: action.type,
    target: action.target,
    status: action.status,
    metadata: action.metadata,
  });
});
```

### Inspect Sequence Modifications

```javascript
// Get modifications for chromosome
const chrModifications = actionManager.sequenceModifications.get('chr1');

if (chrModifications) {
  console.log(`Modifications on chr1:`, chrModifications);
  chrModifications.forEach((mod, index) => {
    console.log(`  ${index + 1}. ${mod.type} at position ${mod.position}`);
  });
} else {
  console.log('No modifications on chr1');
}
```

### Validate Action Queue

```javascript
// Check for invalid actions
const invalid = actionManager.actions.filter(action => {
  if (!action.type || !action.target || !action.metadata) {
    return true;
  }

  const { start, end } = action.metadata;
  if (start !== undefined && end !== undefined && start >= end) {
    return true;
  }

  return false;
});

if (invalid.length > 0) {
  console.warn(`Found ${invalid.length} invalid actions:`, invalid);
}
```

---

## Troubleshooting

### Problem: Actions not executing

**Check**:

1. Is execution already running? `actionManager.isExecuting`
2. Are there pending actions? `actionManager.actions.filter(a => a.status === 'pending')`
3. Are there conflicts? `actionManager.checkActionConflicts(pending)`

**Solution**:

```javascript
if (actionManager.isExecuting) {
  console.log('Already executing, please wait');
} else {
  const pending = actionManager.actions.filter(a => a.status === 'pending');
  if (pending.length === 0) {
    console.log('No pending actions');
  } else {
    await actionManager.executeAllActions();
  }
}
```

### Problem: Clipboard empty

**Check**:

```javascript
if (!actionManager.clipboard || !actionManager.clipboard.sequence) {
  console.log('Clipboard is empty - please copy or cut sequence first');
} else {
  console.log('Clipboard contains:', actionManager.clipboard.sequence.length, 'bp');
}
```

### Problem: Features not updating

**Check**:

1. Ensure original annotations backed up
2. Check sequence modifications recorded
3. Verify feature adjustment called

**Solution**:

```javascript
// Force feature update
if (actionManager.genomeBrowser.trackRenderer) {
  actionManager.genomeBrowser.trackRenderer.updateFeatureTrack();
}
```

---

## Performance Tips

### 1. Batch Actions

```javascript
// ✅ GOOD: Add all actions first, then execute once
regions.forEach(r => actionManager.addAction(...));
await actionManager.executeAllActions();

// ❌ BAD: Execute after each action
regions.forEach(async r => {
    actionManager.addAction(...);
    await actionManager.executeAllActions(); // Slow!
});
```

### 2. Clear Completed Actions

```javascript
// Periodically clear completed actions to reduce queue size
if (actionManager.actions.length > 100) {
  actionManager.actions = actionManager.actions.filter(a => a.status === 'pending' || a.status === 'executing');
  actionManager.updateActionListUI();
}
```

### 3. Use Checkpoints for Large Operations

```javascript
// Create checkpoint before major changes
const checkpointId = await checkpointManager.createCheckpoint(
  'Before major editing',
  checkpointManager.CHECKPOINT_TYPES.MANUAL
);

try {
  // Perform operations
  await actionManager.executeAllActions();
} catch (error) {
  // Rollback on failure
  await checkpointManager.rollbackToCheckpoint(checkpointId);
}
```

---

## Best Practices

1. **Always validate inputs** before creating actions
2. **Check for conflicts** before execution
3. **Use descriptive names** for actions
4. **Include comprehensive metadata** for tracking
5. **Handle errors gracefully** with try-catch
6. **Clear completed actions** periodically
7. **Create checkpoints** before major changes
8. **Monitor execution progress** for long operations
9. **Test with small datasets** first
10. **Document custom workflows** for team

---

## Related Documentation

- [Full Actions System Documentation](./ACTIONS_SYSTEM_DOCUMENTATION.md)
- Improvement Proposal
- CheckpointManager Guide _(if exists)_
- [MCP Integration Guide](../user-guides/MCP_SERVER_GUIDE.md) _(if exists)_

---

**Last Updated**: 2025-11-03  
**Maintainer**: CodeXomics Team
