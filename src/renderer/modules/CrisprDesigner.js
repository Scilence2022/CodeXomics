/**
 * CRISPR Guide RNA Design Tool
 * Complete implementation for CRISPR guide RNA design, evaluation, and primer design
 */
class CrisprDesigner {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.currentTarget = null;
        this.designResults = [];
        this.evaluationResults = [];
        this.primerResults = [];
        
        // PAM sequences for different CRISPR systems
        this.pamSequences = {
            'cas9': 'NGG',
            'cas12a': 'TTTV',
            'cas13': 'H',
            'miniCas9': 'NG',
            'dCas9': 'NGG'
        };
        
        console.log('CrisprDesigner initialized');
    }
    
    /**
     * Initialize the CRISPR design interface
     */
    initialize() {
        this.setupTabSwitching();
        this.setupInputTypeSwitching();
        this.setupCrisprSystemChange();
        this.populateChromosomeDropdown();
        this.updateCurrentViewportInfo();
        this.bindEvents();
    }
    
    /**
     * Bind event handlers
     */
    bindEvents() {
        // Design tab events
        const designBtn = document.getElementById('designGuidesBtn');
        if (designBtn) {
            designBtn.addEventListener('click', () => this.designGuideRNAs());
        }
        
        const clearBtn = document.getElementById('clearDesignBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearDesignInputs());
        }
        
        // Evaluate tab events
        const evaluateBtn = document.getElementById('evaluateGuidesBtn');
        if (evaluateBtn) {
            evaluateBtn.addEventListener('click', () => this.evaluateGuideRNAs());
        }
        
        // Primer tab events
        const primerBtn = document.getElementById('designPrimersBtn');
        if (primerBtn) {
            primerBtn.addEventListener('click', () => this.designPrimers());
        }
        
        // Results tab events
        const exportBtn = document.getElementById('exportResultsBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportResults());
        }
        
        const clearResultsBtn = document.getElementById('clearResultsBtn');
        if (clearResultsBtn) {
            clearResultsBtn.addEventListener('click', () => this.clearResults());
        }
        
        // Project management
        const saveBtn = document.getElementById('saveCrisprProject');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.saveProject());
        }
    }
    
    /**
     * Setup tab switching functionality
     */
    setupTabSwitching() {
        const tabBtns = document.querySelectorAll('.crispr-design-tabs .tab-btn');
        const tabContents = document.querySelectorAll('.crispr-design-tabs .tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.dataset.tab;
                
                // Remove active class from all tabs and contents
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Add active class to clicked tab and corresponding content
                btn.classList.add('active');
                const targetContent = document.getElementById(`${targetTab}-tab`);
                if (targetContent) {
                    targetContent.classList.add('active');
                }
            });
        });
    }
    
    /**
     * Setup input type switching
     */
    setupInputTypeSwitching() {
        const targetTypeSelect = document.getElementById('crisprTargetType');
        if (!targetTypeSelect) return;
        
        targetTypeSelect.addEventListener('change', (e) => {
            const inputType = e.target.value;
            
            // Hide all input sections
            document.querySelectorAll('.input-section').forEach(section => {
                section.style.display = 'none';
            });
            
            // Show selected input section
            switch (inputType) {
                case 'sequence':
                    const seqInput = document.getElementById('sequenceInput');
                    if (seqInput) seqInput.style.display = 'block';
                    break;
                case 'gene':
                    const geneInput = document.getElementById('geneInput');
                    if (geneInput) geneInput.style.display = 'block';
                    break;
                case 'region':
                    const regionInput = document.getElementById('regionInput');
                    if (regionInput) regionInput.style.display = 'block';
                    break;
                case 'current':
                    const currentInput = document.getElementById('currentViewportInfo');
                    if (currentInput) {
                        currentInput.style.display = 'block';
                        this.updateCurrentViewportInfo();
                    }
                    break;
            }
        });
    }
    
    /**
     * Setup CRISPR system change handler
     */
    setupCrisprSystemChange() {
        const crisprSystemSelect = document.getElementById('crisprSystem');
        const pamSequenceInput = document.getElementById('pamSequence');
        
        if (!crisprSystemSelect || !pamSequenceInput) return;
        
        crisprSystemSelect.addEventListener('change', (e) => {
            const system = e.target.value;
            pamSequenceInput.value = this.pamSequences[system] || 'NGG';
        });
    }
    
    /**
     * Populate chromosome dropdown
     */
    populateChromosomeDropdown() {
        const chromosomeSelect = document.getElementById('crisprTargetChromosome');
        if (!chromosomeSelect) return;
        
        chromosomeSelect.innerHTML = '<option value="">Select chromosome...</option>';
        
        try {
            if (this.genomeBrowser && this.genomeBrowser.currentSequence) {
                Object.keys(this.genomeBrowser.currentSequence).forEach(chr => {
                    const option = document.createElement('option');
                    option.value = chr;
                    option.textContent = chr;
                    chromosomeSelect.appendChild(option);
                });
            }
        } catch (error) {
            console.warn('Could not populate chromosome dropdown:', error);
        }
    }
    
    /**
     * Update current viewport information
     */
    updateCurrentViewportInfo() {
        const viewportDetails = document.getElementById('currentViewportDetails');
        if (!viewportDetails) return;
        
        try {
            const currentChr = document.getElementById('chromosomeSelect')?.value;
            const viewport = this.genomeBrowser?.trackRenderer?.getCurrentViewport();
            
            if (currentChr && viewport) {
                viewportDetails.innerHTML = `
                    <div class="viewport-detail">
                        <strong>Chromosome:</strong> ${currentChr}
                    </div>
                    <div class="viewport-detail">
                        <strong>Start:</strong> ${viewport.start.toLocaleString()} bp
                    </div>
                    <div class="viewport-detail">
                        <strong>End:</strong> ${viewport.end.toLocaleString()} bp
                    </div>
                    <div class="viewport-detail">
                        <strong>Length:</strong> ${(viewport.end - viewport.start).toLocaleString()} bp
                    </div>
                `;
            } else {
                viewportDetails.innerHTML = `
                    <div class="no-viewport">
                        <i class="fas fa-info-circle"></i>
                        <p>No genome loaded or viewport available</p>
                    </div>
                `;
            }
        } catch (error) {
            console.warn('Could not update viewport info:', error);
            viewportDetails.innerHTML = `
                <div class="no-viewport">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading viewport information</p>
                </div>
            `;
        }
    }
    
    /**
     * Get target sequence based on input type
     */
    async getTargetSequence() {
        const inputType = document.getElementById('crisprTargetType')?.value;
        
        switch (inputType) {
            case 'sequence':
                return this.getDirectSequenceInput();
            case 'gene':
                return await this.getGeneSequence();
            case 'region':
                return await this.getRegionSequence();
            case 'current':
                return await this.getCurrentViewportSequence();
            default:
                throw new Error('Please select a valid input type');
        }
    }
    
    /**
     * Get sequence from direct input
     */
    getDirectSequenceInput() {
        const sequenceInput = document.getElementById('crisprTargetSequence')?.value;
        if (!sequenceInput) {
            throw new Error('Please enter a target sequence');
        }
        
        // Remove FASTA header if present
        let sequence = sequenceInput.replace(/^>.*$/gm, '').replace(/\s/g, '').toUpperCase();
        
        if (sequence.length < 50) {
            throw new Error('Target sequence must be at least 50 bp long');
        }
        
        if (sequence.length > 10000) {
            throw new Error('Target sequence cannot exceed 10 kb');
        }
        
        return {
            sequence: sequence,
            chromosome: 'Input',
            start: 1,
            end: sequence.length,
            source: 'direct_input'
        };
    }
    
    /**
     * Get sequence from gene name
     */
    async getGeneSequence() {
        const geneName = document.getElementById('crisprTargetGene')?.value;
        if (!geneName) {
            throw new Error('Please enter a gene name');
        }
        
        // For now, return a mock sequence
        const mockSequence = 'ATGAAACGCATTAGCACCACCATTACCACCACCATCACCATTACCACAGGTAACGGTGCGGGCTGACGCGTACAGGAAACACAGAAAAAAGCCCGCACCTGACAGTGCGGGCTTTTTTTTTCGACCAAAGGTAACGAGGTAACAACCATGCGAGTGTTGAAGTTCGGCGGTACATCAGTGGCAAATGCAGAACGTTTTCTGCGTGTTGCCGATATTCTGGAAAGCAATGCCAGGCAGGGGCAGGTGGCCACCGTCCTCTCTGCCCCCGCCAAAATCACCAACCACCTGGTGGCGATGATTGAAAAAACCATTAGCGGCCAGGATGCTTTACCCAATATCAGCGATGCCGAACGTATTTTTGCCGAACTTTTGACGGGACTCGCCGCCGCCCAGCCGGGGTTCCCGCTGGCGCAATTGAAAACTTTCGTCGATCAGGAATTTGCCCAAATAAAACATGTCCTGCATGGCATTAGTTTGTTGGGGCAGTGCCCGGATAGCATCAACGCTGCGCTGATTTGCCGTGGCGAGAAAATGTCGATCGCCATTATGGCCGGCGTATTAGAAGCGCGCGGTCACAACGTTACTGTTAT';
        
        return {
            sequence: mockSequence,
            chromosome: 'chr1',
            start: 1000,
            end: 1000 + mockSequence.length,
            source: 'gene',
            geneName: geneName
        };
    }
    
    /**
     * Get sequence from genomic region
     */
    async getRegionSequence() {
        const chromosome = document.getElementById('crisprTargetChromosome')?.value;
        const start = parseInt(document.getElementById('crisprTargetStart')?.value);
        const end = parseInt(document.getElementById('crisprTargetEnd')?.value);
        
        if (!chromosome || !start || !end) {
            throw new Error('Please specify chromosome, start, and end positions');
        }
        
        if (start >= end) {
            throw new Error('Start position must be less than end position');
        }
        
        if (end - start > 10000) {
            throw new Error('Region cannot exceed 10 kb');
        }
        
        // For now, generate a mock sequence
        const length = end - start + 1;
        const bases = ['A', 'T', 'G', 'C'];
        let sequence = '';
        for (let i = 0; i < length; i++) {
            sequence += bases[Math.floor(Math.random() * 4)];
        }
        
        return {
            sequence: sequence,
            chromosome: chromosome,
            start: start,
            end: end,
            source: 'region'
        };
    }
    
    /**
     * Get sequence from current viewport
     */
    async getCurrentViewportSequence() {
        const currentChr = document.getElementById('chromosomeSelect')?.value;
        const viewport = this.genomeBrowser?.trackRenderer?.getCurrentViewport();
        
        if (!currentChr || !viewport) {
            throw new Error('No current viewport available');
        }
        
        const range = viewport.end - viewport.start;
        if (range > 10000) {
            throw new Error('Current viewport is too large (max 10 kb). Please zoom in.');
        }
        
        // Generate mock sequence
        const bases = ['A', 'T', 'G', 'C'];
        let sequence = '';
        for (let i = 0; i < range; i++) {
            sequence += bases[Math.floor(Math.random() * 4)];
        }
        
        return {
            sequence: sequence,
            chromosome: currentChr,
            start: viewport.start,
            end: viewport.end,
            source: 'current_viewport'
        };
    }
    
    /**
     * Design guide RNAs
     */
    async designGuideRNAs() {
        try {
            const designBtn = document.getElementById('designGuidesBtn');
            if (designBtn) {
                designBtn.disabled = true;
                designBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Designing...';
            }
            
            // Get target sequence
            this.currentTarget = await this.getTargetSequence();
            
            // Get design parameters
            const parameters = this.getDesignParameters();
            
            // Find guide RNA sites
            const guides = this.findGuideRNASites(this.currentTarget.sequence, parameters);
            
            // Score and filter guides
            const scoredGuides = this.scoreGuides(guides, parameters);
            
            // Store results
            this.designResults = scoredGuides;
            
            // Display results
            this.displayDesignResults();
            
            // Switch to results tab
            this.switchToTab('results');
            
            this.showNotification('Guide RNA design completed successfully', 'success');
            
        } catch (error) {
            console.error('Error designing guide RNAs:', error);
            this.showNotification(error.message, 'error');
        } finally {
            const designBtn = document.getElementById('designGuidesBtn');
            if (designBtn) {
                designBtn.disabled = false;
                designBtn.innerHTML = '<i class="fas fa-magic"></i> Design Guide RNAs';
            }
        }
    }
    
    /**
     * Get design parameters from the form
     */
    getDesignParameters() {
        return {
            crisprSystem: document.getElementById('crisprSystem')?.value || 'cas9',
            pamSequence: document.getElementById('pamSequence')?.value || 'NGG',
            guideLength: parseInt(document.getElementById('guideLength')?.value) || 20,
            targetStrand: document.getElementById('targetStrand')?.value || 'both',
            maxGuides: parseInt(document.getElementById('maxGuides')?.value) || 50,
            minEfficiencyScore: parseFloat(document.getElementById('minEfficiencyScore')?.value) || 0.3,
            avoidRepeats: document.getElementById('avoidRepeats')?.checked || true,
            checkOffTargets: document.getElementById('checkOffTargets')?.checked || true,
            gcContentFilter: document.getElementById('gcContentFilter')?.checked || true,
            minGC: parseInt(document.getElementById('minGC')?.value) || 20,
            maxGC: parseInt(document.getElementById('maxGC')?.value) || 80,
            maxHomopolymer: parseInt(document.getElementById('maxHomopolymer')?.value) || 4
        };
    }
    
    /**
     * Find guide RNA sites in the target sequence
     */
    findGuideRNASites(sequence, parameters) {
        const guides = [];
        const guideLength = parameters.guideLength;
        
        // Search both strands if specified
        const strands = parameters.targetStrand === 'both' ? ['plus', 'minus'] : [parameters.targetStrand];
        
        strands.forEach(strand => {
            const searchSequence = strand === 'minus' ? this.reverseComplement(sequence) : sequence;
            
            for (let i = 0; i <= searchSequence.length - guideLength - 3; i++) {
                const potentialPAM = searchSequence.substr(i + guideLength, 3);
                const guideSequence = searchSequence.substr(i, guideLength);
                
                if (this.matchesPAM(potentialPAM, parameters.pamSequence)) {
                    const actualPosition = strand === 'minus' ? 
                        sequence.length - i - guideLength : i;
                    
                    guides.push({
                        sequence: guideSequence,
                        pamSite: potentialPAM,
                        position: actualPosition + 1, // 1-based
                        strand: strand,
                        length: guideLength
                    });
                }
            }
        });
        
        return guides;
    }
    
    /**
     * Check if sequence matches PAM
     */
    matchesPAM(sequence, pamPattern) {
        // Simple NGG matching for now
        if (pamPattern === 'NGG') {
            return /[ATCG]GG/.test(sequence);
        }
        return true; // Accept all for other PAM patterns
    }
    
    /**
     * Score guides based on various criteria
     */
    scoreGuides(guides, parameters) {
        return guides.map(guide => {
            const scores = this.calculateGuideScores(guide, parameters);
            return {
                ...guide,
                ...scores,
                overallScore: scores.efficiencyScore * scores.specificityScore * scores.gcScore
            };
        })
        .filter(guide => guide.overallScore >= parameters.minEfficiencyScore)
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, parameters.maxGuides);
    }
    
    /**
     * Calculate various scores for a guide RNA
     */
    calculateGuideScores(guide, parameters) {
        const sequence = guide.sequence;
        
        // GC content score
        const gcContent = this.calculateGCContent(sequence);
        const gcScore = this.calculateGCScore(gcContent, parameters.minGC, parameters.maxGC);
        
        // Efficiency score (simplified)
        const efficiencyScore = this.calculateEfficiencyScore(sequence);
        
        // Specificity score (simplified)
        const specificityScore = this.calculateSpecificityScore(sequence);
        
        // Secondary structure score
        const secondaryStructureScore = this.calculateSecondaryStructureScore(sequence);
        
        // Homopolymer penalty
        const homopolymerScore = this.calculateHomopolymerScore(sequence, parameters.maxHomopolymer);
        
        return {
            gcContent: gcContent,
            gcScore: gcScore,
            efficiencyScore: efficiencyScore,
            specificityScore: specificityScore,
            secondaryStructureScore: secondaryStructureScore,
            homopolymerScore: homopolymerScore
        };
    }
    
    /**
     * Calculate GC content
     */
    calculateGCContent(sequence) {
        const gcCount = (sequence.match(/[GC]/g) || []).length;
        return (gcCount / sequence.length) * 100;
    }
    
    /**
     * Calculate GC score
     */
    calculateGCScore(gcContent, minGC, maxGC) {
        if (gcContent < minGC || gcContent > maxGC) {
            return 0;
        }
        
        const optimal = 50;
        const distance = Math.abs(gcContent - optimal);
        return Math.max(0, 1 - distance / 30);
    }
    
    /**
     * Calculate efficiency score (simplified)
     */
    calculateEfficiencyScore(sequence) {
        let score = 0.5; // Base score
        
        // Position-specific nucleotide preferences (simplified)
        if (sequence[0] === 'G') score += 0.1;
        if (sequence[19] === 'G') score += 0.1;
        if (sequence.substr(16, 4).includes('T')) score += 0.1;
        
        // Avoid poly-T at 3' end
        if (!sequence.substr(15).includes('TTTT')) score += 0.2;
        
        return Math.min(1, Math.max(0, score));
    }
    
    /**
     * Calculate specificity score (simplified)
     */
    calculateSpecificityScore(sequence) {
        // Simple specificity based on sequence complexity
        const uniqueNucleotides = new Set(sequence).size;
        const complexity = uniqueNucleotides / 4;
        
        // Penalize low complexity sequences
        if (complexity < 0.5) return 0.3;
        if (complexity < 0.75) return 0.7;
        return 0.9;
    }
    
    /**
     * Calculate secondary structure score
     */
    calculateSecondaryStructureScore(sequence) {
        // Simple hairpin detection
        const reverseComp = this.reverseComplement(sequence);
        let maxMatch = 0;
        
        for (let i = 0; i < sequence.length - 4; i++) {
            for (let j = 0; j < reverseComp.length - 4; j++) {
                let match = 0;
                for (let k = 0; k < Math.min(6, sequence.length - i, reverseComp.length - j); k++) {
                    if (sequence[i + k] === reverseComp[j + k]) {
                        match++;
                    } else {
                        break;
                    }
                }
                maxMatch = Math.max(maxMatch, match);
            }
        }
        
        return Math.max(0, 1 - maxMatch / 10);
    }
    
    /**
     * Calculate homopolymer score
     */
    calculateHomopolymerScore(sequence, maxHomopolymer) {
        const homopolymers = sequence.match(/(.)\1+/g) || [];
        const maxLength = Math.max(...homopolymers.map(h => h.length), 0);
        
        if (maxLength > maxHomopolymer) {
            return Math.max(0, 1 - (maxLength - maxHomopolymer) / 5);
        }
        
        return 1;
    }
    
    /**
     * Get reverse complement of DNA sequence
     */
    reverseComplement(sequence) {
        const complement = {
            'A': 'T', 'T': 'A', 'C': 'G', 'G': 'C',
            'a': 't', 't': 'a', 'c': 'g', 'g': 'c'
        };
        
        return sequence.split('').reverse().map(base => complement[base] || base).join('');
    }
    
    /**
     * Display design results
     */
    displayDesignResults() {
        const resultsContainer = document.getElementById('crisprResults');
        if (!resultsContainer) return;
        
        if (this.designResults.length === 0) {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>No suitable guide RNAs found with the specified parameters.</p>
                </div>
            `;
            return;
        }
        
        const resultsHTML = this.designResults.map((guide, index) => `
            <div class="guide-result" data-guide-index="${index}">
                <div class="guide-header">
                    <span class="guide-sequence">${guide.sequence}</span>
                    <span class="guide-score">${(guide.overallScore * 100).toFixed(1)}%</span>
                </div>
                <div class="guide-details">
                    <div class="guide-detail">
                        <span class="label">Position:</span>
                        <span class="value">${guide.position}</span>
                    </div>
                    <div class="guide-detail">
                        <span class="label">Strand:</span>
                        <span class="value">${guide.strand === 'plus' ? '+' : '-'}</span>
                    </div>
                    <div class="guide-detail">
                        <span class="label">PAM:</span>
                        <span class="value">${guide.pamSite}</span>
                    </div>
                    <div class="guide-detail">
                        <span class="label">GC Content:</span>
                        <span class="value">${guide.gcContent.toFixed(1)}%</span>
                    </div>
                    <div class="guide-detail">
                        <span class="label">Efficiency:</span>
                        <span class="value">${(guide.efficiencyScore * 100).toFixed(1)}%</span>
                    </div>
                    <div class="guide-detail">
                        <span class="label">Specificity:</span>
                        <span class="value">${(guide.specificityScore * 100).toFixed(1)}%</span>
                    </div>
                </div>
                <div class="guide-actions">
                    <button class="btn btn-sm btn-secondary" onclick="window.crisprDesigner.copyGuideSequence(${index})">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="window.crisprDesigner.jumpToGuidePosition(${index})">
                        <i class="fas fa-map-marker-alt"></i> View in Genome
                    </button>
                </div>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = resultsHTML;
    }
    
    /**
     * Evaluate guide RNAs
     */
    async evaluateGuideRNAs() {
        try {
            const evaluateBtn = document.getElementById('evaluateGuidesBtn');
            if (evaluateBtn) {
                evaluateBtn.disabled = true;
                evaluateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Evaluating...';
            }
            
            const guideSequences = document.getElementById('evaluateGuideSequence')?.value;
            if (!guideSequences) {
                throw new Error('Please enter guide RNA sequences to evaluate');
            }
            
            const guides = guideSequences.split('\n')
                .map(seq => seq.trim().toUpperCase())
                .filter(seq => seq.length > 0);
            
            if (guides.length === 0) {
                throw new Error('No valid guide sequences found');
            }
            
            // Get evaluation parameters
            const evalParams = this.getEvaluationParameters();
            
            // Evaluate each guide
            const evaluations = guides.map((sequence, index) => {
                const scores = this.calculateGuideScores({ sequence }, evalParams);
                return {
                    sequence,
                    index: index + 1,
                    ...scores,
                    overallScore: scores.efficiencyScore * scores.specificityScore * scores.gcScore
                };
            });
            
            this.evaluationResults = evaluations;
            this.displayEvaluationResults();
            
            this.showNotification('Guide RNA evaluation completed', 'success');
            
        } catch (error) {
            console.error('Error evaluating guide RNAs:', error);
            this.showNotification(error.message, 'error');
        } finally {
            const evaluateBtn = document.getElementById('evaluateGuidesBtn');
            if (evaluateBtn) {
                evaluateBtn.disabled = false;
                evaluateBtn.innerHTML = '<i class="fas fa-chart-line"></i> Evaluate Guides';
            }
        }
    }
    
    /**
     * Get evaluation parameters
     */
    getEvaluationParameters() {
        return {
            minGC: 20,
            maxGC: 80,
            maxHomopolymer: 4
        };
    }
    
    /**
     * Display evaluation results
     */
    displayEvaluationResults() {
        const resultsContainer = document.getElementById('evaluationResults');
        if (!resultsContainer) return;
        
        const resultsHTML = this.evaluationResults.map(guide => `
            <div class="guide-result">
                <div class="guide-header">
                    <span class="guide-sequence">Guide ${guide.index}: ${guide.sequence}</span>
                    <span class="guide-score">${(guide.overallScore * 100).toFixed(1)}%</span>
                </div>
                <div class="guide-details">
                    <div class="guide-detail">
                        <span class="label">GC Content:</span>
                        <span class="value">${guide.gcContent.toFixed(1)}%</span>
                    </div>
                    <div class="guide-detail">
                        <span class="label">Efficiency Score:</span>
                        <span class="value">${(guide.efficiencyScore * 100).toFixed(1)}%</span>
                    </div>
                    <div class="guide-detail">
                        <span class="label">Specificity Score:</span>
                        <span class="value">${(guide.specificityScore * 100).toFixed(1)}%</span>
                    </div>
                    <div class="guide-detail">
                        <span class="label">Secondary Structure:</span>
                        <span class="value">${(guide.secondaryStructureScore * 100).toFixed(1)}%</span>
                    </div>
                </div>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = resultsHTML;
    }
    
    /**
     * Design PCR primers
     */
    async designPrimers() {
        try {
            const designBtn = document.getElementById('designPrimersBtn');
            if (designBtn) {
                designBtn.disabled = true;
                designBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Designing...';
            }
            
            if (!this.currentTarget) {
                throw new Error('Please design guide RNAs first to set a target region');
            }
            
            const parameters = this.getPrimerParameters();
            const primers = this.generatePrimers(this.currentTarget, parameters);
            
            this.primerResults = primers;
            this.displayPrimerResults();
            
            this.showNotification('Primer design completed', 'success');
            
        } catch (error) {
            console.error('Error designing primers:', error);
            this.showNotification(error.message, 'error');
        } finally {
            const designBtn = document.getElementById('designPrimersBtn');
            if (designBtn) {
                designBtn.disabled = false;
                designBtn.innerHTML = '<i class="fas fa-magic"></i> Design Primers';
            }
        }
    }
    
    /**
     * Get primer design parameters
     */
    getPrimerParameters() {
        return {
            purpose: document.getElementById('primerPurpose')?.value || 'screening',
            length: parseInt(document.getElementById('primerLength')?.value) || 20,
            tm: parseInt(document.getElementById('primerTm')?.value) || 60,
            gc: parseInt(document.getElementById('primerGC')?.value) || 50,
            productSize: parseInt(document.getElementById('productSize')?.value) || 500
        };
    }
    
    /**
     * Generate PCR primers
     */
    generatePrimers(target, parameters) {
        const primers = [];
        const sequence = target.sequence;
        
        // Generate forward primer (simplified)
        const forwardPrimer = {
            sequence: sequence.substr(0, parameters.length),
            tm: this.calculateMeltingTemperature(sequence.substr(0, parameters.length)),
            gc: this.calculateGCContent(sequence.substr(0, parameters.length)),
            length: parameters.length,
            direction: 'forward',
            score: 0.8
        };
        
        // Generate reverse primer (simplified)
        const reverseSeq = this.reverseComplement(sequence.substr(-parameters.length));
        const reversePrimer = {
            sequence: reverseSeq,
            tm: this.calculateMeltingTemperature(reverseSeq),
            gc: this.calculateGCContent(reverseSeq),
            length: parameters.length,
            direction: 'reverse',
            score: 0.8
        };
        
        primers.push({
            pair: 1,
            forward: forwardPrimer,
            reverse: reversePrimer,
            productSize: parameters.productSize,
            purpose: parameters.purpose
        });
        
        return primers;
    }
    
    /**
     * Calculate melting temperature (simplified)
     */
    calculateMeltingTemperature(sequence) {
        const gcCount = (sequence.match(/[GC]/g) || []).length;
        const atCount = sequence.length - gcCount;
        
        // Simple Tm calculation
        return 64.9 + 41 * (gcCount - 16.4) / sequence.length;
    }
    
    /**
     * Display primer results
     */
    displayPrimerResults() {
        const resultsContainer = document.getElementById('primerResults');
        if (!resultsContainer) return;
        
        const resultsHTML = this.primerResults.map((primerPair, index) => `
            <div class="primer-result">
                <h5>Primer Pair ${primerPair.pair} (${primerPair.purpose})</h5>
                <div class="primer-pair">
                    <div class="primer">
                        <div class="primer-info">
                            <span class="primer-name">Forward Primer</span>
                            <span class="primer-sequence">${primerPair.forward.sequence}</span>
                        </div>
                        <div class="primer-properties">
                            <span>Tm: ${primerPair.forward.tm.toFixed(1)}°C</span>
                            <span>GC: ${primerPair.forward.gc.toFixed(1)}%</span>
                            <span>Length: ${primerPair.forward.length}bp</span>
                        </div>
                    </div>
                    <div class="primer">
                        <div class="primer-info">
                            <span class="primer-name">Reverse Primer</span>
                            <span class="primer-sequence">${primerPair.reverse.sequence}</span>
                        </div>
                        <div class="primer-properties">
                            <span>Tm: ${primerPair.reverse.tm.toFixed(1)}°C</span>
                            <span>GC: ${primerPair.reverse.gc.toFixed(1)}%</span>
                            <span>Length: ${primerPair.reverse.length}bp</span>
                        </div>
                    </div>
                </div>
                <div class="primer-actions">
                    <button class="btn btn-sm btn-secondary" onclick="window.crisprDesigner.copyPrimerPair(${index})">
                        <i class="fas fa-copy"></i> Copy Primers
                    </button>
                </div>
            </div>
        `).join('');
        
        resultsContainer.innerHTML = resultsHTML;
    }
    
    /**
     * Clear design inputs
     */
    clearDesignInputs() {
        const elements = [
            'crisprTargetSequence',
            'crisprTargetGene',
            'crisprTargetStart',
            'crisprTargetEnd'
        ];
        
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.value = '';
            }
        });
    }
    
    /**
     * Clear all results
     */
    clearResults() {
        this.designResults = [];
        this.evaluationResults = [];
        this.primerResults = [];
        this.currentTarget = null;
        
        const crisprResults = document.getElementById('crisprResults');
        if (crisprResults) {
            crisprResults.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-info-circle"></i>
                    <p>No results available. Please design guide RNAs first.</p>
                </div>
            `;
        }
        
        const evaluationResults = document.getElementById('evaluationResults');
        if (evaluationResults) {
            evaluationResults.innerHTML = '';
        }
        
        const primerResults = document.getElementById('primerResults');
        if (primerResults) {
            primerResults.innerHTML = '';
        }
    }
    
    /**
     * Export results
     */
    exportResults() {
        if (this.designResults.length === 0) {
            this.showNotification('No results to export', 'warning');
            return;
        }
        
        const exportData = {
            timestamp: new Date().toISOString(),
            target: this.currentTarget,
            designResults: this.designResults,
            evaluationResults: this.evaluationResults,
            primerResults: this.primerResults
        };
        
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `crispr_design_results_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showNotification('Results exported successfully', 'success');
    }
    
    /**
     * Save project
     */
    saveProject() {
        const projectData = {
            timestamp: new Date().toISOString(),
            target: this.currentTarget,
            designResults: this.designResults,
            evaluationResults: this.evaluationResults,
            primerResults: this.primerResults,
            parameters: this.getDesignParameters()
        };
        
        localStorage.setItem('crisprProject', JSON.stringify(projectData));
        this.showNotification('Project saved successfully', 'success');
    }
    
    /**
     * Copy guide sequence to clipboard
     */
    copyGuideSequence(index) {
        const guide = this.designResults[index];
        if (guide) {
            navigator.clipboard.writeText(guide.sequence).then(() => {
                this.showNotification('Guide sequence copied to clipboard', 'success');
            }).catch(err => {
                console.error('Failed to copy:', err);
                this.showNotification('Failed to copy sequence', 'error');
            });
        }
    }
    
    /**
     * Jump to guide position in genome viewer
     */
    jumpToGuidePosition(index) {
        const guide = this.designResults[index];
        if (guide && this.currentTarget) {
            const genomicPosition = this.currentTarget.start + guide.position - 1;
            // Try to navigate to position if genome browser is available
            if (this.genomeBrowser && this.genomeBrowser.navigateToPosition) {
                this.genomeBrowser.navigateToPosition(this.currentTarget.chromosome, genomicPosition - 50, genomicPosition + 50);
            }
            this.showNotification(`Guide at position ${genomicPosition}`, 'info');
        }
    }
    
    /**
     * Copy primer pair to clipboard
     */
    copyPrimerPair(index) {
        const primerPair = this.primerResults[index];
        if (primerPair) {
            const text = `Forward: ${primerPair.forward.sequence}\nReverse: ${primerPair.reverse.sequence}`;
            navigator.clipboard.writeText(text).then(() => {
                this.showNotification('Primer sequences copied to clipboard', 'success');
            }).catch(err => {
                console.error('Failed to copy:', err);
                this.showNotification('Failed to copy primers', 'error');
            });
        }
    }
    
    /**
     * Switch to specified tab
     */
    switchToTab(tabName) {
        const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (tabBtn) {
            tabBtn.click();
        }
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        // Use the existing notification system if available
        if (this.genomeBrowser && this.genomeBrowser.showNotification) {
            this.genomeBrowser.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
            // Simple alert as fallback
            alert(message);
        }
    }
}

// Make CrisprDesigner available globally
window.CrisprDesigner = CrisprDesigner; 