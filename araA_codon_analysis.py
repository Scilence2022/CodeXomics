#!/usr/bin/env python3
"""
Codon Usage Analysis for araA Gene (L-arabinose isomerase)
E. coli K-12 substr. MG1655
"""

# araA gene protein sequence
protein_sequence = """MTIFDNYEVWFVIGSQHLYGPETLRQVTQHAEHVVNALNTEAKL
PCKLVLKPLGTTPDEITAICRDANYDDRCAGLVVWLHTFSPAKMWINGLTMLNKPLLQ
FHTQFNAALPWDSIDMDFMNLNQTAHGGREFGFIGARMRQQHAVVTGHWQDKQAHERI
GSWMRQAVSKQDTRHLKVCRFGDNMREVAVTDGDKVAAQIKFGFSVNTWAVGDLVQVV
NSISDGDVNALVDEYESCYTMTPATQIHGKKRQNVLEAARIELGMKRFLEQGGFHAFT
TTFEDLHGLKQLPGLAVQRLMQQGYGFAGEGDWKTAALLRIMKVMSTGLQGGTSFMED
YTYHFEKGNDLVLGSHMLEVCPSIAAEEKPILDVQHLGIGGKDDPARLIFNTQTGPAI
VASLIDLGDRYRLLVNCIDTVKTPHSLPKLPVANALWKAQPDLPTASEAWILAGGAHH
TVFSHALNLNDMRQFAEMHDIEITVIDNDTRLPAFKDALRWNEVYYGFRR""".replace('\n', '')

# Standard genetic code
genetic_code = {
    'TTT': 'F', 'TTC': 'F', 'TTA': 'L', 'TTG': 'L',
    'TCT': 'S', 'TCC': 'S', 'TCA': 'S', 'TCG': 'S',
    'TAT': 'Y', 'TAC': 'Y', 'TAA': '*', 'TAG': '*',
    'TGT': 'C', 'TGC': 'C', 'TGA': '*', 'TGG': 'W',
    'CTT': 'L', 'CTC': 'L', 'CTA': 'L', 'CTG': 'L',
    'CCT': 'P', 'CCC': 'P', 'CCA': 'P', 'CCG': 'P',
    'CAT': 'H', 'CAC': 'H', 'CAA': 'Q', 'CAG': 'Q',
    'CGT': 'R', 'CGC': 'R', 'CGA': 'R', 'CGG': 'R',
    'ATT': 'I', 'ATC': 'I', 'ATA': 'I', 'ATG': 'M',
    'ACT': 'T', 'ACC': 'T', 'ACA': 'T', 'ACG': 'T',
    'AAT': 'N', 'AAC': 'N', 'AAA': 'K', 'AAG': 'K',
    'AGT': 'S', 'AGC': 'S', 'AGA': 'R', 'AGG': 'R',
    'GTT': 'V', 'GTC': 'V', 'GTA': 'V', 'GTG': 'V',
    'GCT': 'A', 'GCC': 'A', 'GCA': 'A', 'GCG': 'A',
    'GAT': 'D', 'GAC': 'D', 'GAA': 'E', 'GAG': 'E',
    'GGT': 'G', 'GGC': 'G', 'GGA': 'G', 'GGG': 'G'
}

# E. coli codon usage frequency (from literature)
ecoli_codon_freq = {
    'F': {'TTT': 0.58, 'TTC': 0.42},
    'L': {'TTA': 0.14, 'TTG': 0.13, 'CTT': 0.12, 'CTC': 0.10, 'CTA': 0.04, 'CTG': 0.47},
    'S': {'TCT': 0.17, 'TCC': 0.15, 'TCA': 0.14, 'TCG': 0.14, 'AGT': 0.16, 'AGC': 0.25},
    'Y': {'TAT': 0.59, 'TAC': 0.41},
    'C': {'TGT': 0.46, 'TGC': 0.54},
    'W': {'TGG': 1.00},
    'P': {'CCT': 0.18, 'CCC': 0.13, 'CCA': 0.20, 'CCG': 0.49},
    'H': {'CAT': 0.57, 'CAC': 0.43},
    'Q': {'CAA': 0.34, 'CAG': 0.66},
    'R': {'CGT': 0.36, 'CGC': 0.36, 'CGA': 0.07, 'CGG': 0.11, 'AGA': 0.07, 'AGG': 0.04},
    'I': {'ATT': 0.49, 'ATC': 0.39, 'ATA': 0.11},
    'M': {'ATG': 1.00},
    'T': {'ACT': 0.19, 'ACC': 0.40, 'ACA': 0.17, 'ACG': 0.25},
    'N': {'AAT': 0.49, 'AAC': 0.51},
    'K': {'AAA': 0.74, 'AAG': 0.26},
    'V': {'GTT': 0.28, 'GTC': 0.20, 'GTA': 0.17, 'GTG': 0.35},
    'A': {'GCT': 0.18, 'GCC': 0.26, 'GCA': 0.23, 'GCG': 0.33},
    'D': {'GAT': 0.63, 'GAC': 0.37},
    'E': {'GAA': 0.68, 'GAG': 0.32},
    'G': {'GGT': 0.35, 'GGC': 0.37, 'GGA': 0.13, 'GGG': 0.15}
}

def analyze_codon_usage():
    """Analyze codon usage of araA gene"""
    
    print("=" * 80)
    print("CODON USAGE ANALYSIS FOR araA GENE")
    print("=" * 80)
    print("Gene: araA (L-arabinose isomerase)")
    print("Organism: E. coli K-12 substr. MG1655")
    print("Locus tag: b0062")
    print("Location: complement(66835..68337)")
    print("Length: 1503 bp")
    print("Protein length: 501 amino acids")
    print("=" * 80)
    
    # Count amino acids in the sequence
    aa_count = {}
    for aa in protein_sequence:
        if aa in aa_count:
            aa_count[aa] += 1
        else:
            aa_count[aa] = 1
    
    print("\nAMINO ACID COMPOSITION:")
    print("-" * 40)
    total_aa = len(protein_sequence)
    
    for aa in sorted(aa_count.keys()):
        count = aa_count[aa]
        percentage = (count / total_aa) * 100
        print(f"{aa}: {count:3d} ({percentage:5.1f}%)")
    
    print(f"\nTotal amino acids: {total_aa}")
    
    # Analyze codon usage patterns
    print("\n" + "=" * 80)
    print("CODON USAGE ANALYSIS")
    print("=" * 80)
    
    # For each amino acid, show expected vs actual usage
    print("Amino Acid Codon Usage Patterns:")
    print("-" * 50)
    
    for aa in sorted(aa_count.keys()):
        if aa in ecoli_codon_freq:
            count = aa_count[aa]
            print(f"\n{aa} ({count} occurrences):")
            
            # Calculate expected codon usage
            codons = ecoli_codon_freq[aa]
            for codon, freq in codons.items():
                expected = count * freq
                print(f"  {codon}: Expected {expected:5.1f} ({freq*100:4.1f}%)")
    
    # Calculate codon adaptation index (CAI) components
    print("\n" + "=" * 80)
    print("CODON OPTIMIZATION ANALYSIS")
    print("=" * 80)
    
    # Identify highly used codons vs rare codons
    highly_used = []
    moderately_used = []
    rarely_used = []
    
    for aa in aa_count.keys():
        if aa in ecoli_codon_freq:
            codons = ecoli_codon_freq[aa]
            for codon, freq in codons.items():
                if freq > 0.4:
                    highly_used.append((codon, genetic_code[codon], freq))
                elif freq > 0.2:
                    moderately_used.append((codon, genetic_code[codon], freq))
                else:
                    rarely_used.append((codon, genetic_code[codon], freq))
    
    print("Codon Usage Categories:")
    print("-" * 30)
    
    print(f"\nHighly used codons (>40% usage):")
    for codon, aa, freq in sorted(highly_used):
        if aa in aa_count:
            expected = aa_count[aa] * freq
            print(f"  {codon} ({aa}): {freq*100:4.1f}% - Expected ~{expected:.1f} occurrences")
    
    print(f"\nModerately used codons (20-40% usage):")
    for codon, aa, freq in sorted(moderately_used):
        if aa in aa_count:
            expected = aa_count[aa] * freq
            print(f"  {codon} ({aa}): {freq*100:4.1f}% - Expected ~{expected:.1f} occurrences")
    
    print(f"\nRarely used codons (<20% usage):")
    for codon, aa, freq in sorted(rarely_used):
        if aa in aa_count:
            expected = aa_count[aa] * freq
            print(f"  {codon} ({aa}): {freq*100:4.1f}% - Expected ~{expected:.1f} occurrences")
    
    # Calculate some basic statistics
    print("\n" + "=" * 80)
    print("GENE CHARACTERISTICS")
    print("=" * 80)
    
    # GC content estimation (based on amino acid composition)
    gc_rich_aa = ['G', 'C', 'A', 'P', 'R']  # Amino acids typically encoded by GC-rich codons
    gc_rich_count = sum(aa_count.get(aa, 0) for aa in gc_rich_aa)
    gc_content_estimate = (gc_rich_count / total_aa) * 100
    
    print(f"Estimated GC content: ~{gc_content_estimate:.1f}%")
    
    # Most frequent amino acids
    sorted_aa = sorted(aa_count.items(), key=lambda x: x[1], reverse=True)
    print(f"\nMost frequent amino acids:")
    for aa, count in sorted_aa[:10]:
        percentage = (count / total_aa) * 100
        print(f"  {aa}: {count} ({percentage:4.1f}%)")
    
    # Functional analysis
    print("\n" + "=" * 80)
    print("FUNCTIONAL CHARACTERISTICS")
    print("=" * 80)
    
    # Hydrophobic amino acids
    hydrophobic = ['A', 'V', 'I', 'L', 'M', 'F', 'W', 'Y']
    hydrophobic_count = sum(aa_count.get(aa, 0) for aa in hydrophobic)
    hydrophobic_percent = (hydrophobic_count / total_aa) * 100
    
    # Charged amino acids
    charged = ['R', 'K', 'D', 'E']
    charged_count = sum(aa_count.get(aa, 0) for aa in charged)
    charged_percent = (charged_count / total_aa) * 100
    
    # Polar amino acids
    polar = ['N', 'Q', 'S', 'T', 'Y']
    polar_count = sum(aa_count.get(aa, 0) for aa in polar)
    polar_percent = (polar_count / total_aa) * 100
    
    print(f"Hydrophobic amino acids: {hydrophobic_count} ({hydrophobic_percent:.1f}%)")
    print(f"Charged amino acids: {charged_count} ({charged_percent:.1f}%)")
    print(f"Polar amino acids: {polar_count} ({polar_percent:.1f}%)")
    
    print("\n" + "=" * 80)
    print("ANALYSIS COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    analyze_codon_usage()