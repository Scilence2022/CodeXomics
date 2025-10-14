# InterPro Tool Migration Guide

## ⚠️ Deprecation Notice

The tool `interpro_search` has been **DEPRECATED** and replaced with the standardized tool name **`analyze_interpro_domains`**.

## 🔄 Migration Path

### Old Tool (Deprecated)
```javascript
❌ interpro_search
```

### New Tool (Use This)
```javascript
✅ analyze_interpro_domains
```

## 📋 Why This Change?

1. **Naming Consistency**: `analyze_interpro_domains` follows the standard naming convention (verb_subject_object)
2. **Enhanced Functionality**: The new tool supports multiple input methods (sequence, UniProt ID, gene name)
3. **Better Integration**: Fully integrated into built-in tools system for both dynamic and non-dynamic modes
4. **Clear Separation**: `analyze_interpro_domains` for sequence analysis, `search_interpro_entry` for database searches

## 🛠️ Migration Examples

### Example 1: Sequence Analysis

**Old Way (Deprecated):**
```javascript
interpro_search({
  sequence: 'MKLLVLALFMLLGLAFLVFGLLNQGVGM',
  analysis_type: 'domains'
})
```

**New Way:**
```javascript
analyze_interpro_domains({
  sequence: 'MKLLVLALFMLLGLAFLVFGLLNQGVGM',
  analysis_type: 'domains',
  confidence_threshold: 0.7
})
```

### Example 2: Gene Name Input (New Feature!)

**New Capability:**
```javascript
analyze_interpro_domains({
  geneName: 'p53',
  organism: 'Homo sapiens',
  analysis_type: 'complete',
  applications: ['Pfam', 'SMART', 'Gene3D']
})
```

### Example 3: UniProt ID Input (New Feature!)

**New Capability:**
```javascript
analyze_interpro_domains({
  uniprot_id: 'P04637',
  analysis_type: 'sites',
  confidence_threshold: 0.8
})
```

### Example 4: Database Search

**If you were using interpro_search for database searches:**
```javascript
// Use search_interpro_entry instead
search_interpro_entry({
  search_term: 'kinase',
  entry_type: 'domain',
  database_source: ['Pfam', 'SMART']
})
```

## ✨ Enhanced Features in analyze_interpro_domains

### Multiple Input Methods
1. **Direct Sequence**: Provide protein sequence directly
2. **Gene Name**: Provide gene name + organism (auto-resolves via UniProt)
3. **UniProt ID**: Provide UniProt accession (auto-resolves sequence)

### Enhanced Parameters
- `analysis_type`: Choose specific analysis (domains, families, sites, repeats, complete)
- `confidence_threshold`: Filter results by confidence (0.0-1.0)
- `output_format`: Multiple formats (summary, detailed, graphical, json)
- `applications`: 17+ database options (vs 5 in old tool)
- `email_notification`: Get notified when analysis completes
- `priority`: Set job priority (low, normal, high)

### Better Performance
- **Timeout**: 120s (vs 30s)
- **Retries**: 3 attempts (vs 2)
- **Caching**: 1-hour cache duration
- **Rate Limiting**: Intelligent rate management

## 📊 Tool Comparison

| Feature | interpro_search (OLD) | analyze_interpro_domains (NEW) |
|---------|----------------------|-------------------------------|
| Input Methods | Sequence only | Sequence, UniProt ID, Gene Name |
| Databases | 5 options | 17+ options |
| Timeout | 120s | 120s |
| Retries | 2 | 3 |
| Caching | None | 1 hour |
| Built-in Integration | ❌ | ✅ |
| Non-dynamic Mode | ❌ | ✅ |
| Confidence Filtering | ❌ | ✅ |
| Output Formats | Limited | 4 formats |
| Batch Processing | ❌ | Via search_interpro_entry |

## 🚀 Action Items

### For Developers
1. **Update Code**: Replace all `interpro_search` calls with `analyze_interpro_domains`
2. **Test Migration**: Verify functionality with new parameter names
3. **Review Features**: Consider using new enhanced features
4. **Update Documentation**: Update any references to the old tool

### For Users
- **No Action Needed**: The system will continue to work
- **Recommendation**: Start using `analyze_interpro_domains` for better performance
- **New Features**: Try gene name and UniProt ID input methods

## 📝 Timeline

- **v1.1.0**: `interpro_search` marked as deprecated
- **v1.2.0**: Deprecation warnings added to logs
- **v2.0.0**: `interpro_search` will be removed (future release)

## 🔗 Related Tools

### InterPro Tool Family
- **`analyze_interpro_domains`**: Analyze protein sequences for domains
- **`search_interpro_entry`**: Search InterPro database for entries
- **`get_interpro_entry_details`**: Get detailed information for specific InterPro entries

### Usage Recommendations
- **Sequence Analysis** → Use `analyze_interpro_domains`
- **Database Search** → Use `search_interpro_entry`
- **Entry Details** → Use `get_interpro_entry_details`

## 📚 Documentation

- [InterPro Optimization Summary](./INTERPRO_OPTIMIZATION_SUMMARY.md)
- [InterPro Built-in Integration](./INTERPRO_BUILTIN_INTEGRATION.md)
- [Database Tools YAML](./database/analyze_interpro_domains.yaml)

## ❓ Support

If you have questions about this migration:
1. Check the [INTERPRO_BUILTIN_INTEGRATION.md](./INTERPRO_BUILTIN_INTEGRATION.md) guide
2. Review the [analyze_interpro_domains.yaml](./database/analyze_interpro_domains.yaml) specification
3. Run the validation test: `node tools_registry/test_interpro_optimization.js`

---

**Migration Status**: ✅ Complete - All systems updated to use `analyze_interpro_domains`
