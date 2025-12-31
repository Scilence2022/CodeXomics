# Codon Usage Analysis - Quick Reference Guide

## Overview

GenomeAIStudio now provides comprehensive codon usage analysis with two powerful tools:

1. **`codon_usage_analysis`** - Analyze codon preferences for a single gene
2. **`genome_codon_usage_analysis`** - Analyze codon usage patterns across the entire genome

## Key Features

### ✨ What's New

- **RSCU Values**: Relative Synonymous Codon Usage for each codon
- **Codon Preferences**: Per-amino-acid preference analysis
- **Preference Classification**: Preferred, neutral, or rare codons
- **Genome-Wide Statistics**: GC content by codon position, genome-wide biases

## Quick Start

### Single Gene Analysis

**User Query Examples:**
```
"Analyze codon usage for gene lacZ"
"What codons does cirA prefer?"
"Show me codon usage analysis for locus tag b2155"
```

**Direct Function Call:**
```javascript
codon_usage_analysis(geneName="lacZ")
codon_usage_analysis(locusTag="b2155")
codon_usage_analysis(sequence="ATGGCTAGC...")
```

**What You Get:**
- Total codons and unique codons used
- Top 10 most frequent codons with percentages
- Amino acid composition
- **NEW**: Codon preferences for each amino acid
  - Which codons are preferred (RSCU > 1.0)
  - Which codons are rare (RSCU < 0.5)
  - Usage percentage within each amino acid group

### Genome-Wide Analysis

**User Query Examples:**
```
"What are the preferred codons in this genome?"
"Analyze genome-wide codon usage"
"Show me codon bias across all genes"
```

**Direct Function Call:**
```javascript
genome_codon_usage_analysis()
genome_codon_usage_analysis(chromosome="U00096", minLength=300)
genome_codon_usage_analysis(maxGenes=5000)
```

**What You Get:**
- Total genes and codons analyzed
- Genome-wide codon frequencies
- GC content at each codon position (wobble base analysis)
- **NEW**: Genome-wide codon preferences
  - Most/least preferred codon for each amino acid
  - Overall codon bias patterns
  - Statistical significance via RSCU

## Understanding RSCU

**RSCU (Relative Synonymous Codon Usage)** measures how much a codon is used relative to expected usage:

- **RSCU > 1.0**: Codon is **preferred** (used more than expected)
- **RSCU ≈ 1.0**: Codon is **neutral** (used as expected)
- **RSCU < 1.0**: Codon is **rare** (used less than expected)

### Example Interpretation

For Leucine (6 synonymous codons):

```
L (48 total, 6 synonymous codons):
  ⭐ CTG: 64.58% (RSCU: 3.875, preferred)
  ▪️ CTT: 10.42% (RSCU: 0.625, neutral)
  ⚠️ TTA: 4.17% (RSCU: 0.250, rare)
```

**Interpretation**: In this gene:
- **CTG is highly preferred** for Leucine (used 3.875× more than expected)
- **TTA is rarely used** for Leucine (used only 0.25× as often as expected)

## Parameter Reference

### `codon_usage_analysis` Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `sequence` | string | No* | DNA sequence to analyze | `"ATGGCTAGC..."` |
| `geneName` | string | No* | Gene name | `"lacZ"` |
| `locusTag` | string | No* | Locus tag | `"b2155"` |
| `chromosome` | string | No | Chromosome name | `"U00096"` |

*One of `sequence`, `geneName`, or `locusTag` must be provided

### `genome_codon_usage_analysis` Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `chromosome` | string | No | All | Specific chromosome to analyze |
| `featureType` | string | No | "CDS" | Type of features to analyze |
| `minLength` | integer | No | 300 | Minimum feature length (bp) |
| `maxGenes` | integer | No | Unlimited | Maximum genes to analyze |

## Output Examples

### Single Gene Output

```markdown
## Codon Usage Analysis Results for gene cirA (locus tag: b2155)

**Analysis Summary:**
- Total Codons: 664
- Unique Codons: 60
- Sequence Length: 1992 bp
- Analysis Type: geneName

**Top 10 Most Frequent Codons:**
- GAA (E): 4.82% (32 occurrences) - RSCU: 1.297
- CTG (L): 4.67% (31 occurrences) - RSCU: 3.875
- GAT (D): 4.67% (31 occurrences) - RSCU: 1.148

**Codon Preferences by Amino Acid:**

**L** (48 total, 6 synonymous codons):
  ⭐ CTG: 64.58% (RSCU: 3.875, preferred)
  ▪️ CTT: 10.42% (RSCU: 0.625, neutral)
  ▪️ TTG: 8.33% (RSCU: 0.500, neutral)
  ⚠️ TTA: 4.17% (RSCU: 0.250, rare)

**S** (56 total, 6 synonymous codons):
  ⭐ AGC: 42.86% (RSCU: 2.571, preferred)
  ⭐ TCT: 21.43% (RSCU: 1.286, preferred)
```

### Genome-Wide Output

```markdown
## Genome-Wide Codon Usage Analysis Results

**Analysis Summary:**
- Total Genes Analyzed: 4,321
- Total Codons: 1,234,567
- Total Sequence Length: 3,703,701 bp
- Chromosomes: U00096
- Feature Type: CDS
- Minimum Length Filter: 300 bp

**GC Content by Codon Position:**
- Position 1: 54.2%
- Position 2: 40.1%
- Position 3: 52.8% (wobble position)
- Overall: 49.0%

**Genome-Wide Codon Preferences by Amino Acid:**

**L** (124,532 total, 6 synonymous codons):
  Most preferred: CTG, Least preferred: CTA
  ⭐⭐ CTG: 48.3% (RSCU: 2.898)
  ⭐ TTG: 14.2% (RSCU: 0.852)
  ▪️ CTT: 12.1% (RSCU: 0.726)
```

## Use Cases

### 1. Gene Expression Optimization
**Question**: "Which codons should I use to optimize gene expression in E. coli?"

**Solution**: Run `genome_codon_usage_analysis()` to identify genome-wide preferred codons, then design your gene using those codons.

### 2. Heterologous Expression
**Question**: "Will this foreign gene express well in my host organism?"

**Solution**: 
1. Analyze the foreign gene: `codon_usage_analysis(sequence="...")`
2. Compare with host genome: `genome_codon_usage_analysis()`
3. Identify rare codons that may need optimization

### 3. Codon Bias Detection
**Question**: "Does this gene have unusual codon usage?"

**Solution**: Compare gene-specific RSCU values with genome-wide averages to identify genes with atypical codon usage (possibly horizontally transferred or highly expressed).

### 4. GC Content Analysis
**Question**: "What's the GC content bias at wobble positions?"

**Solution**: Use `genome_codon_usage_analysis()` to see GC% at positions 1, 2, and 3.

## Tips & Best Practices

### 1. Minimum Length Filtering
- Default `minLength=300` excludes short genes with unreliable statistics
- Increase to 500-1000 for more robust genome-wide analysis
- Decrease to 100-200 to include small genes like sRNAs

### 2. Performance Optimization
- Use `maxGenes` parameter for large genomes (e.g., `maxGenes=5000`)
- Genome-wide analysis of E. coli takes ~2-5 seconds
- For quick results, analyze specific chromosomes only

### 3. Interpreting RSCU
- **RSCU > 1.5**: Strongly preferred
- **RSCU 0.5-1.5**: Moderate usage
- **RSCU < 0.5**: Rare/avoided

### 4. Comparing Results
- Save genome-wide results as reference
- Compare individual genes against genome average
- Identify genes with unusual codon bias

## Common Questions

### Q: Why are some amino acids not shown in preferences?
**A**: Amino acids with only one codon (Met, Trp) don't have synonymous alternatives, so preference analysis doesn't apply.

### Q: What does "preferred" vs "highly preferred" mean?
**A**: 
- **Preferred**: RSCU > 1.0 (used more than average)
- **Highly preferred**: RSCU > 1.2 (strongly favored, genome-wide only)

### Q: Can I analyze multiple genes at once?
**A**: Yes! Use `genome_codon_usage_analysis()` with filters to analyze multiple genes together.

### Q: How is GC content by position useful?
**A**: 
- **Position 3 (wobble)**: Often has higher GC in bacteria, affects codon choice
- **Position 1&2**: Constrained by amino acid coding
- Useful for designing primers, detecting compositional bias

## Integration with Other Tools

### Combine with Translation Analysis
```
1. codon_usage_analysis(geneName="lacZ")
2. translate_dna(geneName="lacZ")
3. Compare codon preferences with protein properties
```

### Combine with BLAST
```
1. blast_search(sequence="gene_of_interest")
2. For each homolog: codon_usage_analysis()
3. Compare codon preferences across species
```

### Combine with Gene Annotation
```
1. genome_codon_usage_analysis()
2. search_features(type="CDS")
3. Identify highly/lowly expressed genes by codon bias
```

## Troubleshooting

### Issue: "Gene not found"
**Solution**: Verify gene name/locus tag spelling, check chromosome parameter

### Issue: "No CDS features found"
**Solution**: 
- Check if annotation data is loaded
- Verify `featureType` parameter (default is "CDS")
- Lower `minLength` threshold

### Issue: Analysis takes too long
**Solution**: 
- Use `maxGenes` parameter to limit analysis
- Analyze specific chromosomes instead of entire genome
- Increase `minLength` to skip small genes

## Technical Notes

### RSCU Formula
```
RSCU = (Observed Count / Expected Count)
Expected Count = (Total AA Count) / (Number of Synonymous Codons)
```

### Preference Classification
- **Single gene**: `preferred` if RSCU > 1.0, `rare` if < 0.5
- **Genome-wide**: `highly preferred` if RSCU > 1.2, `preferred` if 0.8-1.2, `rare` if < 0.5

### Genetic Code
- Currently supports standard genetic code
- Stop codons (*) are excluded from preference analysis
- Non-standard codes (mitochondrial, etc.) not yet supported

---

**For detailed implementation information**, see [`CODON_USAGE_ANALYSIS_ENHANCEMENT.md`](./CODON_USAGE_ANALYSIS_ENHANCEMENT.md)

**Last Updated**: 2025-10-18
