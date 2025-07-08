/*
 * MicrobeGenomicsFunctions.js
 * -------------------------------------------------------------
 * A lightweight façade exposing *very basic* function calls for
 * common microbe-genomics tasks.  Each function is intentionally
 * simple (do one thing and return a result) so LLM chains / agents
 * can combine them to perform complex analyses.
 *
 * ❶ Navigation      – move to / query genomic regions
 * ❷ Analysis        – compute simple statistics on sequences
 * ❸ Calculation     – arithmetic helpers (coverage, depth, etc.)
 * ❹ Prediction      – naïve motif / feature predictions
 * ❺ Search          – locate genes / features / motifs
 * ❻ Editing         – modify existing annotations
 * ❼ Addition        – add new sequences / tracks / annotations
 * -------------------------------------------------------------
 * All functions are PURE (no UI side-effects) unless explicitly
 * named "navigate…" or "edit…/add…" (which do mutate state).
 * -------------------------------------------------------------
 * USAGE EXAMPLE (pseudo-code / LLM chain):
 *    // Complex task: For gene "dnaA" predict promoter and GC% 200bp upstream
 *    const gene = MicrobeFns.searchGeneByName('dnaA');
 *    const upstream = MicrobeFns.getUpstreamRegion(gene, 200);
 *    const gcPct   = MicrobeFns.computeGC(upstream.sequence);
 *    const promo   = MicrobeFns.predictPromoter(upstream.sequence);
 *    MicrobeFns.addAnnotation(upstream.chrom, promo);
 *    MicrobeFns.navigateTo(upstream.chrom, upstream.start, upstream.end);
 */

class MicrobeGenomicsFunctions {
    /* --------------------------------------------------------- */
    /*  NAVIGATION                                              */
    /* --------------------------------------------------------- */

    /**
     * Navigate to a specific genomic region
     * @param {string} chromosome - Target chromosome/contig
     * @param {number} start - Start position (1-based)
     * @param {number} end - End position (1-based)
     */
    static navigateTo(chromosome, start, end) {
        const gb = window.genomeBrowser;
        if (!gb) throw new Error('GenomeBrowser not initialised');
        
        // Set the position first
        gb.currentPosition = { start, end };
        gb.currentChromosome = chromosome;
        
        // Update chromosome select if different
        const chrSelect = document.getElementById('chromosomeSelect');
        if (chrSelect && chrSelect.value !== chromosome) {
            chrSelect.value = chromosome;
        }
        
        // Trigger view refresh to show the new position
        if (gb.currentSequence && gb.currentSequence[chromosome]) {
            gb.displayGenomeView(chromosome, gb.currentSequence[chromosome]);
        }
    }

    /**
     * Jump directly to a gene location
     * @param {string} geneName - Gene name or locus tag
     * @returns {Object} Gene location or null if not found
     */
    static jumpToGene(geneName) {
        const gene = this.searchGeneByName(geneName);
        if (gene) {
            this.navigateTo(gene.chromosome, gene.feature.start, gene.feature.end);
            return gene;
        }
        return null;
    }

    /**
     * Get the currently visible genomic region
     * @returns {Object} Current region {chromosome, start, end}
     */
    static getCurrentRegion() {
        const gb = window.genomeBrowser;
        if (!gb) throw new Error('GenomeBrowser not initialised');
        return {
            chromosome: gb.currentChromosome,
            start: gb.currentPosition.start,
            end: gb.currentPosition.end
        };
    }

    /**
     * Scroll the view left by specified base pairs
     * @param {number} bp - Base pairs to scroll (default: 1000)
     */
    static scrollLeft(bp = 1000) {
        const region = this.getCurrentRegion();
        const newStart = Math.max(1, region.start - bp);
        const newEnd = region.end - bp;
        this.navigateTo(region.chromosome, newStart, newEnd);
    }

    /**
     * Scroll the view right by specified base pairs
     * @param {number} bp - Base pairs to scroll (default: 1000)
     */
    static scrollRight(bp = 1000) {
        const region = this.getCurrentRegion();
        const newStart = region.start + bp;
        const newEnd = region.end + bp;
        this.navigateTo(region.chromosome, newStart, newEnd);
    }

    /**
     * Zoom in by reducing the viewing window
     * @param {number} factor - Zoom factor (default: 2)
     */
    static zoomIn(factor = 2) {
        const region = this.getCurrentRegion();
        const center = Math.floor((region.start + region.end) / 2);
        const width = Math.floor((region.end - region.start) / factor);
        const newStart = Math.max(1, center - Math.floor(width / 2));
        const newEnd = newStart + width;
        this.navigateTo(region.chromosome, newStart, newEnd);
    }

    /**
     * Zoom out by expanding the viewing window
     * @param {number} factor - Zoom factor (default: 2)
     */
    static zoomOut(factor = 2) {
        const region = this.getCurrentRegion();
        const center = Math.floor((region.start + region.end) / 2);
        const width = Math.floor((region.end - region.start) * factor);
        const newStart = Math.max(1, center - Math.floor(width / 2));
        const newEnd = newStart + width;
        this.navigateTo(region.chromosome, newStart, newEnd);
    }

    /* --------------------------------------------------------- */
    /*  ANALYSIS                                                */
    /* --------------------------------------------------------- */

    /**
     * Compute GC percentage for a DNA sequence
     * @param {string} dna - DNA sequence string
     * @returns {number} GC percentage (0-100)
     */
    static computeGC(dna) {
        // Use unified sequence processing implementation
        if (window.UnifiedSequenceProcessing) {
            const result = window.UnifiedSequenceProcessing.legacyComputeGC(dna);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
        if (!dna) return 0;
        const g = (dna.match(/G/gi) || []).length;
        const c = (dna.match(/C/gi) || []).length;
        const valid = g + c + (dna.match(/[AT]/gi) || []).length;
        return valid === 0 ? 0 : ((g + c) / valid) * 100;
    }

    /**
     * Get reverse complement of DNA sequence
     * @param {string} dna - DNA sequence
     * @returns {string} Reverse complement sequence
     */
    static reverseComplement(dna) {
        // Use unified sequence processing implementation
        if (window.UnifiedSequenceProcessing) {
            const result = window.UnifiedSequenceProcessing.legacyReverseComplement(dna);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
        const complement = { 'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G', 'N': 'N' };
        return dna.toUpperCase().split('').reverse().map(base => complement[base] || 'N').join('');
    }

    /**
     * Translate DNA sequence to protein (single frame)
     * @param {string} dna - DNA sequence (should be in frame)
     * @param {number} frame - Reading frame (0, 1, or 2)
     * @returns {string} Amino acid sequence
     */
    static translateDNA(dna, frame = 0) {
        // Use unified translation implementation
        if (window.UnifiedDNATranslation) {
            const result = window.UnifiedDNATranslation.legacyTranslateDNA(dna, frame);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
        const codonTable = {
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
        };

        const sequence = dna.toUpperCase().slice(frame);
        let protein = '';
        for (let i = 0; i < sequence.length - 2; i += 3) {
            const codon = sequence.substr(i, 3);
            protein += codonTable[codon] || 'X';
        }
        return protein;
    }

    /**
     * Find Open Reading Frames (ORFs) in a sequence
     * @param {string} dna - DNA sequence
     * @param {number} minLength - Minimum ORF length in codons (default: 30)
     * @returns {Array} Array of ORF objects {start, end, frame, sequence}
     */
    static findORFs(dna, minLength = 30) {
        const orfs = [];
        const startCodons = ['ATG'];
        const stopCodons = ['TAA', 'TAG', 'TGA'];
        
        // Check all 6 reading frames (3 forward, 3 reverse)
        for (let strand = 0; strand < 2; strand++) {
            const seq = strand === 0 ? dna.toUpperCase() : this.reverseComplement(dna);
            
            for (let frame = 0; frame < 3; frame++) {
                for (let i = frame; i < seq.length - 2; i += 3) {
                    const codon = seq.substr(i, 3);
                    
                    if (startCodons.includes(codon)) {
                        // Found start codon, look for stop codon
                        for (let j = i + 3; j < seq.length - 2; j += 3) {
                            const stopCodon = seq.substr(j, 3);
                            if (stopCodons.includes(stopCodon)) {
                                const orfLength = (j - i) / 3;
                                if (orfLength >= minLength) {
                                    orfs.push({
                                        start: strand === 0 ? i + 1 : dna.length - j,
                                        end: strand === 0 ? j + 3 : dna.length - i + 1,
                                        frame: strand === 0 ? frame + 1 : -(frame + 1),
                                        length: orfLength,
                                        sequence: seq.substr(i, j - i + 3)
                                    });
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }
        return orfs.sort((a, b) => a.start - b.start);
    }

    /**
     * Calculate sequence entropy (complexity measure)
     * @param {string} sequence - DNA/RNA sequence
     * @returns {number} Shannon entropy value
     */
    static calculateEntropy(sequence) {
        const counts = {};
        for (const base of sequence.toUpperCase()) {
            counts[base] = (counts[base] || 0) + 1;
        }
        
        const length = sequence.length;
        let entropy = 0;
        for (const count of Object.values(counts)) {
            const p = count / length;
            entropy -= p * Math.log2(p);
        }
        return entropy;
    }

    /* --------------------------------------------------------- */
    /*  CALCULATION                                             */
    /* --------------------------------------------------------- */

    /**
     * Compute GC% for a genomic region
     * @param {string} chromosome - Chromosome name
     * @param {number} start - Start position
     * @param {number} end - End position
     * @returns {number} GC percentage
     */
    static calcRegionGC(chromosome, start, end) {
        const gb = window.genomeBrowser;
        if (!gb || !gb.currentSequence[chromosome]) return 0;
        const seq = gb.currentSequence[chromosome].substring(start, end);
        return this.computeGC(seq);
    }

    /**
     * Calculate melting temperature of DNA sequence
     * @param {string} dna - DNA sequence
     * @returns {number} Estimated melting temperature in Celsius
     */
    static calculateMeltingTemp(dna) {
        if (dna.length < 14) {
            // For short sequences, use simple formula
            const a = (dna.match(/[AT]/gi) || []).length;
            const gc = (dna.match(/[GC]/gi) || []).length;
            return 2 * a + 4 * gc;
        } else {
            // For longer sequences, use more accurate formula
            const gc = this.computeGC(dna);
            return 81.5 + 0.41 * gc - 675 / dna.length;
        }
    }

    /**
     * Calculate molecular weight of DNA sequence
     * @param {string} dna - DNA sequence
     * @returns {number} Molecular weight in Daltons
     */
    static calculateMolecularWeight(dna) {
        const weights = { 'A': 331.2, 'T': 322.2, 'G': 347.2, 'C': 307.2 };
        let weight = 0;
        for (const base of dna.toUpperCase()) {
            weight += weights[base] || 0;
        }
        return weight - (dna.length - 1) * 18.01; // Subtract water molecules
    }

    /**
     * Analyze codon usage in a coding sequence
     * @param {string} dna - DNA coding sequence
     * @returns {Object} Codon usage statistics
     */
    static analyzeCodonUsage(dna) {
        const codonCounts = {};
        const sequence = dna.toUpperCase();
        
        for (let i = 0; i < sequence.length - 2; i += 3) {
            const codon = sequence.substr(i, 3);
            if (codon.length === 3 && !/N/.test(codon)) {
                codonCounts[codon] = (codonCounts[codon] || 0) + 1;
            }
        }
        
        const totalCodons = Object.values(codonCounts).reduce((a, b) => a + b, 0);
        const codonFreqs = {};
        for (const [codon, count] of Object.entries(codonCounts)) {
            codonFreqs[codon] = count / totalCodons;
        }
        
        return { counts: codonCounts, frequencies: codonFreqs, total: totalCodons };
    }

    /* --------------------------------------------------------- */
    /*  PREDICTION                                              */
    /* --------------------------------------------------------- */

    /**
     * Simple promoter prediction based on -10 box (TATAAT motif)
     * @param {string} seq - DNA sequence to scan
     * @param {RegExp} motif - Promoter motif pattern (default: TATAAT)
     * @returns {Object|null} Promoter prediction or null
     */
    static predictPromoter(seq, motif = /TATAAT/i) {
        const idx = seq.search(motif);
        return idx === -1 ? null : { type: 'promoter_pred', start: idx + 1, end: idx + 6, confidence: 0.5 };
    }

    /**
     * Predict Shine-Dalgarno sequences (ribosome binding sites)
     * @param {string} seq - DNA sequence upstream of coding region
     * @returns {Array} Array of predicted RBS sites
     */
    static predictRBS(seq) {
        const sdMotifs = [/AGGAGG/gi, /AGGAG/gi, /GGAGG/gi];
        const sites = [];
        
        for (const motif of sdMotifs) {
            let match;
            while ((match = motif.exec(seq)) !== null) {
                sites.push({
                    type: 'RBS',
                    start: match.index + 1,
                    end: match.index + match[0].length,
                    sequence: match[0],
                    confidence: motif.source.length / 6 // Longer motifs get higher confidence
                });
            }
        }
        return sites.sort((a, b) => a.start - b.start);
    }

    /**
     * Simple transcription terminator prediction (inverted repeats)
     * @param {string} seq - DNA sequence
     * @returns {Array} Array of predicted terminators
     */
    static predictTerminator(seq) {
        const terminators = [];
        const minStemLength = 4;
        const maxLoopSize = 10;
        
        // Simple hairpin detection
        for (let i = 0; i < seq.length - 20; i++) {
            for (let stemLen = minStemLength; stemLen <= 8; stemLen++) {
                const stem1 = seq.substr(i, stemLen);
                const stem2Rev = this.reverseComplement(stem1);
                
                for (let loopSize = 3; loopSize <= maxLoopSize; loopSize++) {
                    const stem2Start = i + stemLen + loopSize;
                    if (stem2Start + stemLen > seq.length) break;
                    
                    const stem2 = seq.substr(stem2Start, stemLen);
                    if (stem2 === stem2Rev) {
                        terminators.push({
                            type: 'terminator',
                            start: i + 1,
                            end: stem2Start + stemLen,
                            stemLength: stemLen,
                            loopSize: loopSize,
                            confidence: stemLen / 8
                        });
                        break;
                    }
                }
            }
        }
        return terminators;
    }

    /* --------------------------------------------------------- */
    /*  SEARCH                                                  */
    /* --------------------------------------------------------- */

    /**
     * Find gene by name or locus tag
     * @param {string} name - Gene name or locus tag
     * @returns {Object|null} Gene object or null if not found
     */
    static searchGeneByName(name) {
        // Use unified sequence processing implementation
        if (window.UnifiedSequenceProcessing) {
            const result = window.UnifiedSequenceProcessing.legacySearchGeneByName(name);
            return result;
        }
        
        // Fallback to original implementation if unified module not available
        const gb = window.genomeBrowser;
        if (!gb) throw new Error('GenomeBrowser not initialised');
        name = name.toLowerCase();
        for (const [chr, feats] of Object.entries(gb.currentAnnotations || {})) {
            const hit = feats.find(f => {
                const q = f.qualifiers || {};
                return (q.gene && q.gene.toLowerCase() === name) ||
                       (q.locus_tag && q.locus_tag.toLowerCase() === name);
            });
            if (hit) return { chromosome: chr, feature: hit };
        }
        return null;
    }

    /**
     * Search for sequence motif/pattern
     * @param {string} pattern - RegExp pattern or string to search
     * @param {string} chromosome - Target chromosome (optional)
     * @returns {Array} Array of match objects
     */
    static searchSequenceMotif(pattern, chromosome = null) {
        const gb = window.genomeBrowser;
        if (!gb) throw new Error('GenomeBrowser not initialised');
        
        const regex = typeof pattern === 'string' ? new RegExp(pattern, 'gi') : pattern;
        const matches = [];
        
        const chromosomes = chromosome ? [chromosome] : Object.keys(gb.currentSequence || {});
        
        for (const chr of chromosomes) {
            const seq = gb.currentSequence[chr];
            if (!seq) continue;
            
            let match;
            while ((match = regex.exec(seq)) !== null) {
                matches.push({
                    chromosome: chr,
                    start: match.index + 1,
                    end: match.index + match[0].length,
                    sequence: match[0]
                });
            }
        }
        return matches;
    }

    /**
     * Find features at a specific genomic position
     * @param {string} chromosome - Chromosome name
     * @param {number} position - Genomic position
     * @returns {Array} Array of overlapping features
     */
    static searchByPosition(chromosome, position) {
        const gb = window.genomeBrowser;
        if (!gb || !gb.currentAnnotations[chromosome]) return [];
        
        return gb.currentAnnotations[chromosome].filter(feature => 
            position >= feature.start && position <= feature.end
        );
    }

    /**
     * Find intergenic regions (gaps between genes)
     * @param {string} chromosome - Chromosome name
     * @param {number} minLength - Minimum intergenic region length (default: 50)
     * @returns {Array} Array of intergenic regions
     */
    static searchIntergenicRegions(chromosome, minLength = 50) {
        const gb = window.genomeBrowser;
        if (!gb || !gb.currentAnnotations[chromosome]) return [];
        
        const genes = gb.currentAnnotations[chromosome]
            .filter(f => f.type === 'CDS' || f.type === 'gene')
            .sort((a, b) => a.start - b.start);
        
        const intergenic = [];
        for (let i = 0; i < genes.length - 1; i++) {
            const gap = genes[i + 1].start - genes[i].end - 1;
            if (gap >= minLength) {
                intergenic.push({
                    chromosome: chromosome,
                    start: genes[i].end + 1,
                    end: genes[i + 1].start - 1,
                    length: gap
                });
            }
        }
        return intergenic;
    }

    /* --------------------------------------------------------- */
    /*  EDITING                                                 */
    /* --------------------------------------------------------- */

    /**
     * Edit an existing annotation
     * @param {string} chromosome - Chromosome name
     * @param {string} featureId - Feature ID to edit
     * @param {Object} patch - Properties to update
     * @returns {boolean} Success status
     */
    static editAnnotation(chromosome, featureId, patch) {
        const gb = window.genomeBrowser;
        const feats = gb.currentAnnotations[chromosome] || [];
        const target = feats.find(f => f.id === featureId);
        if (!target) return false;
        Object.assign(target, patch);
        return true;
    }

    /**
     * Delete an annotation by ID
     * @param {string} chromosome - Chromosome name
     * @param {string} featureId - Feature ID to delete
     * @returns {boolean} Success status
     */
    static deleteAnnotation(chromosome, featureId) {
        const gb = window.genomeBrowser;
        const feats = gb.currentAnnotations[chromosome] || [];
        const index = feats.findIndex(f => f.id === featureId);
        if (index === -1) return false;
        feats.splice(index, 1);
        return true;
    }

    /**
     * Merge two overlapping annotations
     * @param {string} chromosome - Chromosome name
     * @param {string} id1 - First feature ID
     * @param {string} id2 - Second feature ID
     * @returns {Object|null} Merged feature or null
     */
    static mergeAnnotations(chromosome, id1, id2) {
        const gb = window.genomeBrowser;
        const feats = gb.currentAnnotations[chromosome] || [];
        const feat1 = feats.find(f => f.id === id1);
        const feat2 = feats.find(f => f.id === id2);
        
        if (!feat1 || !feat2) return null;
        
        const merged = {
            id: `merged_${id1}_${id2}`,
            type: feat1.type,
            start: Math.min(feat1.start, feat2.start),
            end: Math.max(feat1.end, feat2.end),
            qualifiers: { ...feat1.qualifiers, ...feat2.qualifiers }
        };
        
        // Remove original features and add merged
        this.deleteAnnotation(chromosome, id1);
        this.deleteAnnotation(chromosome, id2);
        this.addAnnotation(chromosome, merged);
        
        return merged;
    }

    /* --------------------------------------------------------- */
    /*  ADDITION                                                */
    /* --------------------------------------------------------- */

    /**
     * Add a new feature annotation
     * @param {string} chromosome - Target chromosome
     * @param {Object} feature - Feature object to add
     * @returns {Object} Added feature
     */
    static addAnnotation(chromosome, feature) {
        const gb = window.genomeBrowser;
        if (!gb) throw new Error('GenomeBrowser not initialised');
        if (!gb.currentAnnotations[chromosome]) gb.currentAnnotations[chromosome] = [];
        
        // Ensure feature has required properties
        if (!feature.id) feature.id = `feature_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        if (!feature.type) feature.type = 'misc_feature';
        
        gb.currentAnnotations[chromosome].push(feature);
        return feature;
    }

    /**
     * Get upstream region of a gene/feature
     * @param {Object} geneObj - Gene object from searchGeneByName
     * @param {number} length - Upstream region length (default: 200)
     * @returns {Object} Upstream region object
     */
    static getUpstreamRegion(geneObj, length = 200) {
        const { chromosome, feature } = geneObj;
        const start = Math.max(0, feature.start - length - 1);
        const end = feature.start - 1;
        const gb = window.genomeBrowser;
        const seq = gb.currentSequence[chromosome].substring(start, end);
        return { chromosome, start, end, sequence: seq };
    }

    /**
     * Get downstream region of a gene/feature
     * @param {Object} geneObj - Gene object from searchGeneByName
     * @param {number} length - Downstream region length (default: 200)
     * @returns {Object} Downstream region object
     */
    static getDownstreamRegion(geneObj, length = 200) {
        const { chromosome, feature } = geneObj;
        const gb = window.genomeBrowser;
        const seqLength = gb.currentSequence[chromosome].length;
        const start = feature.end + 1;
        const end = Math.min(seqLength, feature.end + length);
        const seq = gb.currentSequence[chromosome].substring(start, end);
        return { chromosome, start, end, sequence: seq };
    }

    /**
     * Add a custom track (e.g., for displaying analysis results)
     * @param {string} trackName - Name of the track
     * @param {Array} data - Array of data points {position, value}
     * @param {string} trackType - Type of track (default: 'line')
     * @returns {Object} Track object
     */
    static addTrack(trackName, data, trackType = 'line') {
        const gb = window.genomeBrowser;
        if (!gb.customTracks) gb.customTracks = {};
        
        const track = {
            name: trackName,
            type: trackType,
            data: data,
            created: new Date().toISOString()
        };
        
        gb.customTracks[trackName] = track;
        return track;
    }

    /**
     * Add SNP/variant data
     * @param {string} chromosome - Chromosome name
     * @param {number} position - Variant position
     * @param {string} ref - Reference allele
     * @param {string} alt - Alternative allele
     * @param {Object} info - Additional variant information
     * @returns {Object} Variant object
     */
    static addVariant(chromosome, position, ref, alt, info = {}) {
        const gb = window.genomeBrowser;
        if (!gb.variants) gb.variants = {};
        if (!gb.variants[chromosome]) gb.variants[chromosome] = [];
        
        const variant = {
            chromosome,
            position,
            ref,
            alt,
            id: `var_${chromosome}_${position}_${ref}_${alt}`,
            info,
            added: new Date().toISOString()
        };
        
        gb.variants[chromosome].push(variant);
        return variant;
    }

    /* --------------------------------------------------------- */
    /*  SEQUENCE EXTRACTION                                     */
    /* --------------------------------------------------------- */

    /**
     * Get coding sequence (CDS) for a gene by name or locus tag
     * @param {string} identifier - Gene name or locus tag
     * @returns {Object|null} CDS information or null if not found
     */
    static getCodingSequence(identifier) {
        const gb = window.genomeBrowser;
        if (!gb) throw new Error('GenomeBrowser not initialised');
        
        // First, find the gene by name or locus tag
        const geneResult = this.searchGeneByName(identifier);
        if (!geneResult) {
            // Provide more helpful error information
            const availableGenes = this.getAvailableGeneNames();
            const suggestions = this.generateGeneSuggestions(identifier, availableGenes);
            
            return {
                success: false,
                error: `Gene "${identifier}" not found`,
                identifier: identifier,
                suggestions: suggestions,
                availableGenesCount: availableGenes.length,
                availableGenesSample: availableGenes.slice(0, 10), // Show first 10 genes
                message: `Gene "${identifier}" not found in the current genome. ${suggestions.length > 0 ? 'Try one of these similar genes: ' + suggestions.join(', ') : 'No similar genes found.'}`
            };
        }
        
        const { chromosome, feature } = geneResult;
        
        // Check if we have sequence data for this chromosome
        if (!gb.currentSequence || !gb.currentSequence[chromosome]) {
            return {
                success: false,
                error: `No sequence data available for chromosome ${chromosome}`,
                identifier: identifier,
                chromosome: chromosome
            };
        }
        
        // Get the genomic DNA sequence for the gene region
        const fullSequence = gb.currentSequence[chromosome];
        let geneSequence = fullSequence.substring(feature.start - 1, feature.end);
        
        // Determine gene name and locus tag for result
        const geneName = feature.qualifiers?.gene || identifier;
        const locusTag = feature.qualifiers?.locus_tag || identifier;
        
        // Handle strand direction
        let codingSequence = geneSequence;
        const isReverse = feature.strand === -1 || feature.strand === '-';
        
        if (isReverse) {
            // For reverse strand genes, get reverse complement
            codingSequence = this.reverseComplement(geneSequence);
        }
        
        // Calculate additional information
        const gcContent = this.computeGC(codingSequence);
        const proteinSequence = this.translateDNA(codingSequence);
        
        return {
            success: true,
            identifier: identifier,
            geneName: geneName,
            locusTag: locusTag,
            chromosome: chromosome,
            start: feature.start,
            end: feature.end,
            strand: isReverse ? '-' : '+',
            length: codingSequence.length,
            codingSequence: codingSequence,
            proteinSequence: proteinSequence,
            gcContent: parseFloat(gcContent.toFixed(2)),
            proteinLength: proteinSequence.length,
            geneType: feature.type || 'CDS',
            qualifiers: feature.qualifiers || {}
        };
    }

    /**
     * Get available gene names from current annotations
     * @returns {Array} Array of available gene names and locus tags
     */
    static getAvailableGeneNames() {
        const gb = window.genomeBrowser;
        if (!gb || !gb.currentAnnotations) return [];
        
        const geneNames = new Set();
        
        for (const [chr, features] of Object.entries(gb.currentAnnotations)) {
            features.forEach(feature => {
                const qualifiers = feature.qualifiers || {};
                if (qualifiers.gene) {
                    geneNames.add(qualifiers.gene);
                }
                if (qualifiers.locus_tag) {
                    geneNames.add(qualifiers.locus_tag);
                }
            });
        }
        
        return Array.from(geneNames).sort();
    }

    /**
     * Get a sample of available genes for display
     * @param {number} count - Number of genes to return (default: 20)
     * @returns {Array} Array of sample gene names
     */
    static getSampleGenes(count = 20) {
        const availableGenes = this.getAvailableGeneNames();
        return availableGenes.slice(0, count);
    }

    /**
     * Search for genes by partial name match
     * @param {string} partialName - Partial gene name to search for
     * @param {number} maxResults - Maximum number of results to return (default: 10)
     * @returns {Array} Array of matching gene names
     */
    static searchGenesByPartialName(partialName, maxResults = 10) {
        const availableGenes = this.getAvailableGeneNames();
        const partialLower = partialName.toLowerCase();
        
        const matches = availableGenes.filter(gene => 
            gene.toLowerCase().includes(partialLower)
        );
        
        return matches.slice(0, maxResults);
    }

    /**
     * Generate gene name suggestions based on input
     * @param {string} input - Input gene identifier
     * @param {Array} availableGenes - Array of available gene names
     * @returns {Array} Array of suggested gene names
     */
    static generateGeneSuggestions(input, availableGenes) {
        if (!input || !availableGenes.length) return [];
        
        const inputLower = input.toLowerCase();
        const suggestions = [];
        
        // Exact prefix matches
        const prefixMatches = availableGenes.filter(gene => 
            gene.toLowerCase().startsWith(inputLower)
        );
        suggestions.push(...prefixMatches.slice(0, 5));
        
        // Contains matches
        const containsMatches = availableGenes.filter(gene => 
            gene.toLowerCase().includes(inputLower) && 
            !prefixMatches.includes(gene)
        );
        suggestions.push(...containsMatches.slice(0, 3));
        
        // Fuzzy matches (simple similarity)
        const fuzzyMatches = availableGenes.filter(gene => {
            const geneLower = gene.toLowerCase();
            const similarity = this.calculateStringSimilarity(inputLower, geneLower);
            return similarity > 0.3 && !suggestions.includes(gene);
        });
        suggestions.push(...fuzzyMatches.slice(0, 2));
        
        return suggestions.slice(0, 10); // Limit to 10 suggestions
    }

    /**
     * Calculate simple string similarity (0-1)
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Similarity score
     */
    static calculateStringSimilarity(str1, str2) {
        if (str1 === str2) return 1;
        if (str1.length === 0 || str2.length === 0) return 0;
        
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        const editDistance = this.levenshteinDistance(str1, str2);
        return 1 - (editDistance / longer.length);
    }

    /**
     * Calculate Levenshtein distance between two strings
     * @param {string} str1 - First string
     * @param {string} str2 - Second string
     * @returns {number} Edit distance
     */
    static levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    /**
     * Get coding sequences for multiple genes
     * @param {Array<string>} identifiers - Array of gene names or locus tags
     * @returns {Array} Array of CDS results
     */
    static getMultipleCodingSequences(identifiers) {
        if (!Array.isArray(identifiers)) {
            throw new Error('Identifiers must be an array');
        }
        
        return identifiers.map(identifier => this.getCodingSequence(identifier));
    }

    /**
     * Export coding sequence in FASTA format
     * @param {string} identifier - Gene name or locus tag
     * @param {boolean} includeProtein - Whether to include protein translation
     * @returns {string} FASTA formatted sequence(s)
     */
    static exportCodingSequenceFasta(identifier, includeProtein = false) {
        const result = this.getCodingSequence(identifier);
        
        if (!result.success) {
            throw new Error(result.error);
        }
        
        let fasta = '';
        
        // DNA sequence
        const dnaHeader = `>${result.geneName || result.locusTag}_CDS ${result.chromosome}:${result.start}-${result.end} (${result.strand} strand) [${result.length} bp]`;
        fasta += `${dnaHeader}\n${result.codingSequence}\n`;
        
        // Protein sequence if requested
        if (includeProtein) {
            const proteinHeader = `>${result.geneName || result.locusTag}_PROTEIN translated from ${result.chromosome}:${result.start}-${result.end} (${result.strand} strand) [${result.proteinLength} aa]`;
            fasta += `\n${proteinHeader}\n${result.proteinSequence}\n`;
        }
        
        return fasta;
    }

    /* --------------------------------------------------------- */
    /*  UTILITY METHODS                                         */
    /* --------------------------------------------------------- */

    /**
     * Get available function categories for LLM guidance
     * @returns {Object} Object with function categories and descriptions
     */
    static getFunctionCategories() {
        return {
            navigation: {
                description: "Functions to move around the genome and change view",
                functions: ['navigateTo', 'jumpToGene', 'getCurrentRegion', 'scrollLeft', 'scrollRight', 'zoomIn', 'zoomOut']
            },
            analysis: {
                description: "Functions to analyze sequence properties and features", 
                functions: ['computeGC', 'reverseComplement', 'translateDNA', 'findORFs', 'calculateEntropy']
            },
            calculation: {
                description: "Functions for genomic calculations and statistics",
                functions: ['calcRegionGC', 'calculateMeltingTemp', 'calculateMolecularWeight', 'analyzeCodonUsage']
            },
            prediction: {
                description: "Functions to predict genomic features and motifs",
                functions: ['predictPromoter', 'predictRBS', 'predictTerminator']
            },
            search: {
                description: "Functions to find genes, motifs, and genomic features",
                functions: ['searchGeneByName', 'searchSequenceMotif', 'searchByPosition', 'searchIntergenicRegions']
            },
            editing: {
                description: "Functions to modify existing annotations and features",
                functions: ['editAnnotation', 'deleteAnnotation', 'mergeAnnotations']
            },
            addition: {
                description: "Functions to add new annotations, tracks, and data",
                functions: ['addAnnotation', 'getUpstreamRegion', 'getDownstreamRegion', 'addTrack', 'addVariant']
            }
        };
    }

    /**
     * Get usage examples for LLM learning
     * @returns {Array} Array of example usage patterns
     */
    static getUsageExamples() {
        return [
            {
                task: "Analyze promoter region of a gene",
                steps: [
                    "const gene = MicrobeFns.searchGeneByName('dnaA');",
                    "const upstream = MicrobeFns.getUpstreamRegion(gene, 200);", 
                    "const gcContent = MicrobeFns.computeGC(upstream.sequence);",
                    "const promoter = MicrobeFns.predictPromoter(upstream.sequence);",
                    "MicrobeFns.navigateTo(upstream.chromosome, upstream.start, upstream.end);"
                ]
            },
            {
                task: "Find and analyze ORFs in intergenic regions",
                steps: [
                    "const intergenic = MicrobeFns.searchIntergenicRegions('chromosome', 100);",
                    "for (const region of intergenic) {",
                    "  const seq = gb.currentSequence[region.chromosome].substring(region.start, region.end);",
                    "  const orfs = MicrobeFns.findORFs(seq, 10);",
                    "  if (orfs.length > 0) MicrobeFns.addAnnotation(region.chromosome, orfs[0]);",
                    "}"
                ]
            },
            {
                task: "Search for ribosome binding sites near start codons",
                steps: [
                    "const startCodons = MicrobeFns.searchSequenceMotif('ATG');",
                    "for (const atg of startCodons) {",
                    "  const upstream = gb.currentSequence[atg.chromosome].substring(atg.start-30, atg.start-1);",
                    "  const rbs = MicrobeFns.predictRBS(upstream);",
                    "  if (rbs.length > 0) MicrobeFns.addAnnotation(atg.chromosome, rbs[0]);",
                    "}"
                ]
            }
        ];
    }
}

// Expose globally & via module export
if (typeof window !== 'undefined') {
    window.MicrobeFns = MicrobeGenomicsFunctions;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MicrobeGenomicsFunctions;
} 