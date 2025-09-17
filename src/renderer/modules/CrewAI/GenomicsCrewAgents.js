/**
 * Specialized CrewAI Agents for Genomics Analysis
 * Pre-configured agents with genomics-specific roles, goals, and tools
 */

// Prevent duplicate script execution
if (window.GenomicsCrewAgentsLoaded) {
    console.log('ℹ️ GenomicsCrewAgents already loaded, skipping');
    return;
}
window.GenomicsCrewAgentsLoaded = true;

// Check if base class is available
if (typeof CrewAgent === 'undefined') {
    console.error('❌ CrewAgent base class not available. Ensure CrewAIFramework.js loads first.');
    throw new Error('CrewAgent base class not available');
}

/**
 * Data Analysis Agent
 * Specializes in genomic data processing and analysis
 */
class GenomicsDataAnalyst extends CrewAgent {
    constructor(app, config = {}) {
        super({
            role: 'Genomics Data Analyst',
            goal: 'Analyze genomic data to extract meaningful insights and patterns',
            backstory: 'You are an expert genomics data analyst with deep knowledge of sequence analysis, gene annotation, and bioinformatics tools. You excel at processing large genomic datasets and identifying significant biological patterns.',
            tools: GenomicsDataAnalyst.createTools(app),
            maxIter: config.maxIter || 20,
            verbose: config.verbose !== false,
            ...config
        });
        
        this.app = app;
    }
    
    static createTools(app) {
        return [
            {
                name: 'sequence_search',
                description: 'Search for genomic features and sequences',
                keywords: ['search', 'find', 'locate', 'sequence'],
                condition: (task, context) => {
                    const taskText = (task.description || task).toLowerCase();
                    return taskText.includes('search') || taskText.includes('find');
                },
                execute: async (task, context) => {
                    if (app.navigationManager) {
                        const searchTerm = GenomicsDataAnalyst.extractSearchTerm(task);
                        return await app.navigationManager.searchFeatures(searchTerm);
                    }
                    throw new Error('Navigation manager not available');
                }
            },
            {
                name: 'region_analysis',
                description: 'Analyze specific genomic regions',
                keywords: ['analyze', 'region', 'genomic', 'chromosome'],
                execute: async (task, context) => {
                    const region = GenomicsDataAnalyst.extractRegion(task, context);
                    if (region && app.trackRenderer) {
                        return await app.trackRenderer.analyzeRegion(region);
                    }
                    throw new Error('Invalid region or track renderer not available');
                }
            },
            {
                name: 'sequence_retrieval',
                description: 'Retrieve sequence data from specified regions',
                keywords: ['sequence', 'retrieve', 'get', 'extract'],
                execute: async (task, context) => {
                    const region = GenomicsDataAnalyst.extractRegion(task, context);
                    if (region && app.fileManager) {
                        return await app.fileManager.getSequence(region.chromosome, region.start, region.end);
                    }
                    throw new Error('Invalid region or file manager not available');
                }
            },
            {
                name: 'annotation_lookup',
                description: 'Look up gene annotations and features',
                keywords: ['annotation', 'gene', 'feature', 'lookup'],
                execute: async (task, context) => {
                    const feature = GenomicsDataAnalyst.extractFeature(task);
                    if (feature && app.fileManager) {
                        return await app.fileManager.getGeneDetails(feature);
                    }
                    throw new Error('Invalid feature or file manager not available');
                }
            }
        ];
    }
    
    static extractSearchTerm(task) {
        const taskText = task.description || task;
        // Simple extraction - can be enhanced with NLP
        const match = taskText.match(/search for ["']?([^"']+)["']?/i) || 
                     taskText.match(/find ["']?([^"']+)["']?/i);
        return match ? match[1] : taskText;
    }
    
    static extractRegion(task, context) {
        // Extract region from task or context
        if (context.region) return context.region;
        if (context.chromosome && context.start && context.end) {
            return { chromosome: context.chromosome, start: context.start, end: context.end };
        }
        
        const taskText = task.description || task;
        const regionMatch = taskText.match(/(\w+):(\d+)-(\d+)/);
        if (regionMatch) {
            return {
                chromosome: regionMatch[1],
                start: parseInt(regionMatch[2]),
                end: parseInt(regionMatch[3])
            };
        }
        
        return null;
    }
    
    static extractFeature(task) {
        const taskText = task.description || task;
        // Extract gene name or feature ID
        const match = taskText.match(/gene ["']?([^"'\s]+)["']?/i) ||
                     taskText.match(/feature ["']?([^"'\s]+)["']?/i);
        return match ? match[1] : null;
    }
}

/**
 * Bioinformatics Research Agent
 * Specializes in external database searches and literature analysis
 */
class BioinformaticsResearcher extends CrewAgent {
    constructor(app, config = {}) {
        super({
            role: 'Bioinformatics Researcher',
            goal: 'Conduct comprehensive research using external databases and bioinformatics tools',
            backstory: 'You are a seasoned bioinformatics researcher with expertise in using databases like NCBI, UniProt, and BLAST. You excel at finding relevant biological information and connecting genomic data with published research.',
            tools: BioinformaticsResearcher.createTools(app),
            maxIter: config.maxIter || 15,
            verbose: config.verbose !== false,
            ...config
        });
        
        this.app = app;
    }
    
    static createTools(app) {
        return [
            {
                name: 'blast_search',
                description: 'Perform BLAST searches against databases',
                keywords: ['blast', 'homology', 'similarity', 'database'],
                execute: async (task, context) => {
                    const sequence = BioinformaticsResearcher.extractSequence(task, context);
                    if (sequence && app.chatManager) {
                        return await app.chatManager.executeToolByName('batch_blast_search', {
                            sequences: [sequence],
                            database: 'nr',
                            program: 'blastn'
                        });
                    }
                    throw new Error('No sequence provided or chat manager not available');
                }
            },
            {
                name: 'external_annotation',
                description: 'Fetch annotations from external databases',
                keywords: ['annotation', 'external', 'database', 'ncbi'],
                execute: async (task, context) => {
                    const geneId = BioinformaticsResearcher.extractGeneId(task);
                    if (geneId && app.chatManager) {
                        return await app.chatManager.executeToolByName('fetch_gene_annotation', {
                            geneId: geneId
                        });
                    }
                    throw new Error('No gene ID provided or chat manager not available');
                }
            },
            {
                name: 'protein_structure',
                description: 'Fetch protein structure information',
                keywords: ['protein', 'structure', 'pdb', '3d'],
                execute: async (task, context) => {
                    const proteinId = BioinformaticsResearcher.extractProteinId(task);
                    if (proteinId && app.chatManager) {
                        return await app.chatManager.executeToolByName('fetch_protein_structure', {
                            protein_identifier: proteinId
                        });
                    }
                    throw new Error('No protein ID provided or chat manager not available');
                }
            },
            {
                name: 'phylogenetic_analysis',
                description: 'Perform phylogenetic analysis',
                keywords: ['phylogeny', 'evolution', 'tree', 'relationship'],
                execute: async (task, context) => {
                    const sequences = BioinformaticsResearcher.extractSequences(task, context);
                    if (sequences && app.chatManager) {
                        return await app.chatManager.executeToolByName('build_phylogenetic_tree', {
                            sequences: sequences
                        });
                    }
                    throw new Error('No sequences provided or chat manager not available');
                }
            }
        ];
    }
    
    static extractSequence(task, context) {
        if (context.sequence) return context.sequence;
        
        const taskText = task.description || task;
        // Look for sequence in task description
        const seqMatch = taskText.match(/sequence[:\s]+([ATCG]+)/i);
        return seqMatch ? seqMatch[1] : null;
    }
    
    static extractSequences(task, context) {
        if (context.sequences) return context.sequences;
        if (context.sequence) return [context.sequence];
        
        const taskText = task.description || task;
        const sequences = [];
        const seqMatches = taskText.matchAll(/sequence[:\s]+([ATCG]+)/gi);
        for (const match of seqMatches) {
            sequences.push(match[1]);
        }
        
        return sequences.length > 0 ? sequences : null;
    }
    
    static extractGeneId(task) {
        const taskText = task.description || task;
        const match = taskText.match(/gene[:\s]+([A-Z0-9_]+)/i) ||
                     taskText.match(/id[:\s]+([A-Z0-9_]+)/i);
        return match ? match[1] : null;
    }
    
    static extractProteinId(task) {
        const taskText = task.description || task;
        const match = taskText.match(/protein[:\s]+([A-Z0-9_]+)/i) ||
                     taskText.match(/pdb[:\s]+([A-Z0-9_]+)/i);
        return match ? match[1] : null;
    }
}

/**
 * Navigation Specialist Agent
 * Specializes in genome navigation and visualization
 */
class GenomeNavigator extends CrewAgent {
    constructor(app, config = {}) {
        super({
            role: 'Genome Navigator',
            goal: 'Navigate and visualize genomic regions efficiently',
            backstory: 'You are a genome navigation expert who excels at guiding users through complex genomic landscapes. You understand coordinate systems, visualization techniques, and how to present genomic data in the most informative way.',
            tools: GenomeNavigator.createTools(app),
            maxIter: config.maxIter || 10,
            verbose: config.verbose !== false,
            ...config
        });
        
        this.app = app;
    }
    
    static createTools(app) {
        return [
            {
                name: 'navigate_to_position',
                description: 'Navigate to specific genomic coordinates',
                keywords: ['navigate', 'go to', 'position', 'coordinates'],
                execute: async (task, context) => {
                    const position = GenomeNavigator.extractPosition(task, context);
                    if (position && app.navigationManager) {
                        return await app.navigationManager.navigateToPosition(
                            position.chromosome, position.start, position.end
                        );
                    }
                    throw new Error('Invalid position or navigation manager not available');
                }
            },
            {
                name: 'zoom_control',
                description: 'Control zoom level for detailed or overview analysis',
                keywords: ['zoom', 'scale', 'detail', 'overview'],
                execute: async (task, context) => {
                    const zoomAction = GenomeNavigator.extractZoomAction(task);
                    if (zoomAction && app.navigationManager) {
                        return await app.navigationManager.handleZoom(zoomAction);
                    }
                    throw new Error('Invalid zoom action or navigation manager not available');
                }
            },
            {
                name: 'track_visibility',
                description: 'Control visibility of genomic tracks',
                keywords: ['track', 'show', 'hide', 'visibility'],
                execute: async (task, context) => {
                    const trackAction = GenomeNavigator.extractTrackAction(task);
                    if (trackAction && app.trackRenderer) {
                        return await app.trackRenderer.toggleTrack(trackAction.track, trackAction.visible);
                    }
                    throw new Error('Invalid track action or track renderer not available');
                }
            },
            {
                name: 'region_bookmark',
                description: 'Bookmark interesting genomic regions',
                keywords: ['bookmark', 'save', 'mark', 'remember'],
                execute: async (task, context) => {
                    const region = GenomeNavigator.extractRegion(task, context);
                    if (region && app.navigationManager) {
                        return await app.navigationManager.bookmarkRegion(region);
                    }
                    throw new Error('Invalid region or navigation manager not available');
                }
            }
        ];
    }
    
    static extractPosition(task, context) {
        if (context.position) return context.position;
        
        const taskText = task.description || task;
        const posMatch = taskText.match(/(\w+):(\d+)(?:-(\d+))?/);
        if (posMatch) {
            return {
                chromosome: posMatch[1],
                start: parseInt(posMatch[2]),
                end: posMatch[3] ? parseInt(posMatch[3]) : parseInt(posMatch[2]) + 1000
            };
        }
        
        return null;
    }
    
    static extractZoomAction(task) {
        const taskText = (task.description || task).toLowerCase();
        if (taskText.includes('zoom in') || taskText.includes('zoom closer')) {
            return { action: 'in', factor: 2 };
        }
        if (taskText.includes('zoom out') || taskText.includes('zoom back')) {
            return { action: 'out', factor: 2 };
        }
        
        const factorMatch = taskText.match(/zoom\s+(\d+)x/);
        if (factorMatch) {
            return { action: 'to', factor: parseInt(factorMatch[1]) };
        }
        
        return { action: 'auto' };
    }
    
    static extractTrackAction(task) {
        const taskText = (task.description || task).toLowerCase();
        let track = null;
        let visible = true;
        
        // Extract track name
        const trackMatch = taskText.match(/track[:\s]+([a-z0-9_]+)/i);
        if (trackMatch) {
            track = trackMatch[1];
        } else {
            // Common track types
            if (taskText.includes('gene')) track = 'genes';
            else if (taskText.includes('sequence')) track = 'sequence';
            else if (taskText.includes('annotation')) track = 'annotations';
        }
        
        // Determine visibility
        if (taskText.includes('hide') || taskText.includes('turn off')) {
            visible = false;
        }
        
        return track ? { track, visible } : null;
    }
    
    static extractRegion(task, context) {
        return GenomicsDataAnalyst.extractRegion(task, context);
    }
}

/**
 * Quality Control Agent
 * Specializes in data validation and quality assessment
 */
class QualityController extends CrewAgent {
    constructor(app, config = {}) {
        super({
            role: 'Quality Controller',
            goal: 'Ensure data quality and validate analysis results',
            backstory: 'You are a meticulous quality control specialist with expertise in validating genomic data integrity, identifying potential errors, and ensuring analysis reliability. You have a keen eye for detecting anomalies and inconsistencies.',
            tools: QualityController.createTools(app),
            maxIter: config.maxIter || 12,
            verbose: config.verbose !== false,
            ...config
        });
        
        this.app = app;
    }
    
    static createTools(app) {
        return [
            {
                name: 'data_validation',
                description: 'Validate genomic data integrity',
                keywords: ['validate', 'check', 'verify', 'quality'],
                execute: async (task, context) => {
                    if (app.fileManager) {
                        return await QualityController.validateData(app.fileManager, context);
                    }
                    throw new Error('File manager not available');
                }
            },
            {
                name: 'sequence_quality',
                description: 'Assess sequence quality metrics',
                keywords: ['sequence', 'quality', 'score', 'assessment'],
                execute: async (task, context) => {
                    const sequence = context.sequence || QualityController.extractSequence(task);
                    if (sequence) {
                        return QualityController.assessSequenceQuality(sequence);
                    }
                    throw new Error('No sequence provided');
                }
            },
            {
                name: 'annotation_consistency',
                description: 'Check annotation consistency',
                keywords: ['annotation', 'consistency', 'conflict', 'overlap'],
                execute: async (task, context) => {
                    if (app.fileManager) {
                        return await QualityController.checkAnnotationConsistency(app.fileManager, context);
                    }
                    throw new Error('File manager not available');
                }
            },
            {
                name: 'result_verification',
                description: 'Verify analysis results',
                keywords: ['verify', 'confirm', 'cross-check', 'validate'],
                execute: async (task, context) => {
                    const results = context.results || context.analysisResults;
                    if (results) {
                        return QualityController.verifyResults(results);
                    }
                    throw new Error('No results to verify');
                }
            }
        ];
    }
    
    static async validateData(fileManager, context) {
        const validation = {
            fileIntegrity: true,
            sequenceQuality: 'good',
            annotationConsistency: true,
            issues: [],
            summary: 'Data validation completed'
        };
        
        try {
            // Basic file validation
            if (fileManager.currentData) {
                if (!fileManager.currentData.sequence || fileManager.currentData.sequence.length === 0) {
                    validation.issues.push('No sequence data found');
                    validation.fileIntegrity = false;
                }
                
                if (fileManager.currentData.features && fileManager.currentData.features.length === 0) {
                    validation.issues.push('No features/annotations found');
                }
            } else {
                validation.issues.push('No data loaded');
                validation.fileIntegrity = false;
            }
            
            validation.summary = validation.issues.length === 0 ? 
                'All validation checks passed' : 
                `${validation.issues.length} issues detected`;
                
        } catch (error) {
            validation.issues.push(`Validation error: ${error.message}`);
            validation.fileIntegrity = false;
        }
        
        return validation;
    }
    
    static assessSequenceQuality(sequence) {
        const quality = {
            length: sequence.length,
            gcContent: 0,
            nContent: 0,
            quality: 'good',
            issues: []
        };
        
        // Calculate GC content
        const gcCount = (sequence.match(/[GC]/gi) || []).length;
        quality.gcContent = (gcCount / sequence.length) * 100;
        
        // Calculate N content (ambiguous bases)
        const nCount = (sequence.match(/N/gi) || []).length;
        quality.nContent = (nCount / sequence.length) * 100;
        
        // Quality assessment
        if (quality.gcContent < 20 || quality.gcContent > 80) {
            quality.issues.push(`Unusual GC content: ${quality.gcContent.toFixed(1)}%`);
            quality.quality = 'warning';
        }
        
        if (quality.nContent > 10) {
            quality.issues.push(`High N content: ${quality.nContent.toFixed(1)}%`);
            quality.quality = 'poor';
        }
        
        if (sequence.length < 100) {
            quality.issues.push('Sequence is very short');
            quality.quality = 'warning';
        }
        
        return quality;
    }
    
    static async checkAnnotationConsistency(fileManager, context) {
        const consistency = {
            overlaps: [],
            gaps: [],
            conflicts: [],
            summary: 'Annotation consistency check completed'
        };
        
        try {
            if (fileManager.currentData && fileManager.currentData.features) {
                const features = fileManager.currentData.features;
                
                // Check for overlapping features
                for (let i = 0; i < features.length - 1; i++) {
                    for (let j = i + 1; j < features.length; j++) {
                        const f1 = features[i];
                        const f2 = features[j];
                        
                        if (f1.start < f2.end && f2.start < f1.end) {
                            consistency.overlaps.push({
                                feature1: f1.name || f1.type,
                                feature2: f2.name || f2.type,
                                overlap: Math.min(f1.end, f2.end) - Math.max(f1.start, f2.start)
                            });
                        }
                    }
                }
                
                consistency.summary = `Found ${consistency.overlaps.length} overlapping features`;
            }
        } catch (error) {
            consistency.conflicts.push(`Consistency check error: ${error.message}`);
        }
        
        return consistency;
    }
    
    static verifyResults(results) {
        const verification = {
            resultCount: 0,
            validResults: 0,
            invalidResults: 0,
            issues: [],
            confidence: 'high',
            summary: 'Results verification completed'
        };
        
        if (Array.isArray(results)) {
            verification.resultCount = results.length;
            
            results.forEach((result, index) => {
                if (result && typeof result === 'object') {
                    verification.validResults++;
                } else {
                    verification.invalidResults++;
                    verification.issues.push(`Result ${index} is invalid`);
                }
            });
        } else if (results && typeof results === 'object') {
            verification.resultCount = 1;
            verification.validResults = 1;
        } else {
            verification.invalidResults = 1;
            verification.issues.push('Results format is invalid');
        }
        
        // Determine confidence
        if (verification.invalidResults > 0) {
            verification.confidence = 'low';
        } else if (verification.validResults < 3) {
            verification.confidence = 'medium';
        }
        
        verification.summary = `${verification.validResults}/${verification.resultCount} results verified`;
        
        return verification;
    }
    
    static extractSequence(task) {
        return BioinformaticsResearcher.extractSequence(task, {});
    }
}

/**
 * Project Coordinator Agent
 * Manages overall project workflow and task coordination
 */
class ProjectCoordinator extends CrewAgent {
    constructor(app, config = {}) {
        super({
            role: 'Project Coordinator',
            goal: 'Coordinate project workflow and ensure efficient task completion',
            backstory: 'You are an experienced project coordinator with expertise in managing bioinformatics workflows. You excel at breaking down complex projects into manageable tasks and ensuring all team members work effectively together.',
            tools: ProjectCoordinator.createTools(app),
            maxIter: config.maxIter || 25,
            verbose: config.verbose !== false,
            allowDelegation: true,
            ...config
        });
        
        this.app = app;
    }
    
    static createTools(app) {
        return [
            {
                name: 'task_decomposition',
                description: 'Break down complex tasks into manageable subtasks',
                keywords: ['decompose', 'break down', 'subtask', 'workflow'],
                execute: async (task, context) => {
                    return ProjectCoordinator.decomposeTask(task, context);
                }
            },
            {
                name: 'workflow_planning',
                description: 'Plan optimal workflow for project execution',
                keywords: ['plan', 'workflow', 'sequence', 'order'],
                execute: async (task, context) => {
                    return ProjectCoordinator.planWorkflow(task, context);
                }
            },
            {
                name: 'progress_tracking',
                description: 'Track project progress and identify bottlenecks',
                keywords: ['track', 'progress', 'status', 'bottleneck'],
                execute: async (task, context) => {
                    return ProjectCoordinator.trackProgress(context);
                }
            },
            {
                name: 'resource_allocation',
                description: 'Allocate resources and assign tasks to appropriate agents',
                keywords: ['allocate', 'assign', 'resource', 'delegate'],
                execute: async (task, context) => {
                    return ProjectCoordinator.allocateResources(task, context);
                }
            }
        ];
    }
    
    static decomposeTask(task, context) {
        const taskText = (task.description || task).toLowerCase();
        const subtasks = [];
        
        // Genomics-specific task decomposition
        if (taskText.includes('analyze genome') || taskText.includes('genome analysis')) {
            subtasks.push(
                { id: 1, description: 'Load and validate genomic data', agent: 'Quality Controller' },
                { id: 2, description: 'Perform initial sequence analysis', agent: 'Genomics Data Analyst' },
                { id: 3, description: 'Search external databases for annotations', agent: 'Bioinformatics Researcher' },
                { id: 4, description: 'Navigate to regions of interest', agent: 'Genome Navigator' },
                { id: 5, description: 'Validate and summarize results', agent: 'Quality Controller' }
            );
        } else if (taskText.includes('sequence search') || taskText.includes('find sequence')) {
            subtasks.push(
                { id: 1, description: 'Perform local sequence search', agent: 'Genomics Data Analyst' },
                { id: 2, description: 'Execute BLAST search if needed', agent: 'Bioinformatics Researcher' },
                { id: 3, description: 'Navigate to found sequences', agent: 'Genome Navigator' }
            );
        } else if (taskText.includes('annotation') || taskText.includes('annotate')) {
            subtasks.push(
                { id: 1, description: 'Extract features for annotation', agent: 'Genomics Data Analyst' },
                { id: 2, description: 'Fetch external annotations', agent: 'Bioinformatics Researcher' },
                { id: 3, description: 'Validate annotation consistency', agent: 'Quality Controller' }
            );
        } else {
            // Generic task decomposition
            subtasks.push(
                { id: 1, description: 'Data preparation and validation', agent: 'Quality Controller' },
                { id: 2, description: 'Core analysis execution', agent: 'Genomics Data Analyst' },
                { id: 3, description: 'Results validation', agent: 'Quality Controller' }
            );
        }
        
        return {
            originalTask: task.description || task,
            subtasks,
            estimatedTime: subtasks.length * 30, // 30 seconds per subtask
            dependencies: ProjectCoordinator.identifyDependencies(subtasks)
        };
    }
    
    static planWorkflow(task, context) {
        const workflow = {
            phases: [
                {
                    name: 'Preparation',
                    tasks: ['Data loading', 'Quality validation', 'Initial assessment'],
                    estimatedTime: 60000 // 1 minute
                },
                {
                    name: 'Analysis',
                    tasks: ['Core analysis', 'External searches', 'Pattern identification'],
                    estimatedTime: 120000 // 2 minutes
                },
                {
                    name: 'Validation',
                    tasks: ['Result verification', 'Quality checks', 'Consistency validation'],
                    estimatedTime: 90000 // 1.5 minutes
                },
                {
                    name: 'Reporting',
                    tasks: ['Summary generation', 'Visualization', 'Documentation'],
                    estimatedTime: 60000 // 1 minute
                }
            ],
            totalEstimatedTime: 330000, // 5.5 minutes
            parallelizable: ['Analysis', 'Validation'],
            criticalPath: ['Preparation', 'Analysis', 'Validation', 'Reporting']
        };
        
        return workflow;
    }
    
    static trackProgress(context) {
        const progress = {
            completedTasks: 0,
            totalTasks: 0,
            currentPhase: 'Unknown',
            blockers: [],
            recommendations: [],
            overallProgress: 0
        };
        
        if (context.previousResults) {
            progress.totalTasks = context.previousResults.length;
            progress.completedTasks = context.previousResults.filter(r => r.result && r.result.success).length;
            progress.overallProgress = progress.totalTasks > 0 ? 
                (progress.completedTasks / progress.totalTasks) * 100 : 0;
        }
        
        // Identify blockers
        if (context.previousResults) {
            const failures = context.previousResults.filter(r => !r.result || !r.result.success);
            failures.forEach(failure => {
                progress.blockers.push({
                    task: failure.task || 'Unknown task',
                    agent: failure.agent || 'Unknown agent',
                    error: failure.result?.error || 'Unknown error'
                });
            });
        }
        
        // Generate recommendations
        if (progress.blockers.length > 0) {
            progress.recommendations.push('Address blocking issues before proceeding');
            progress.recommendations.push('Consider alternative approaches for failed tasks');
        } else if (progress.overallProgress > 80) {
            progress.recommendations.push('Project nearing completion - focus on validation');
        } else if (progress.overallProgress > 50) {
            progress.recommendations.push('Good progress - maintain current workflow');
        } else {
            progress.recommendations.push('Consider parallel execution to accelerate progress');
        }
        
        return progress;
    }
    
    static allocateResources(task, context) {
        const allocation = {
            primaryAgent: null,
            supportingAgents: [],
            estimatedResources: {
                cpu: 'medium',
                memory: 'medium',
                network: 'low',
                time: '2-5 minutes'
            },
            rationale: 'Resource allocation based on task analysis'
        };
        
        const taskText = (task.description || task).toLowerCase();
        
        // Agent allocation logic
        if (taskText.includes('search') || taskText.includes('find')) {
            allocation.primaryAgent = 'Genomics Data Analyst';
            allocation.supportingAgents = ['Bioinformatics Researcher', 'Genome Navigator'];
            allocation.estimatedResources.network = 'medium';
        } else if (taskText.includes('external') || taskText.includes('blast') || taskText.includes('database')) {
            allocation.primaryAgent = 'Bioinformatics Researcher';
            allocation.supportingAgents = ['Quality Controller'];
            allocation.estimatedResources.network = 'high';
            allocation.estimatedResources.time = '3-10 minutes';
        } else if (taskText.includes('navigate') || taskText.includes('visualize')) {
            allocation.primaryAgent = 'Genome Navigator';
            allocation.supportingAgents = ['Genomics Data Analyst'];
            allocation.estimatedResources.cpu = 'low';
        } else if (taskText.includes('validate') || taskText.includes('quality')) {
            allocation.primaryAgent = 'Quality Controller';
            allocation.supportingAgents = ['Genomics Data Analyst'];
        } else {
            allocation.primaryAgent = 'Genomics Data Analyst';
            allocation.supportingAgents = ['Quality Controller'];
        }
        
        allocation.rationale = `Selected ${allocation.primaryAgent} as primary agent based on task requirements`;
        
        return allocation;
    }
    
    static identifyDependencies(subtasks) {
        const dependencies = [];
        
        // Basic dependency rules
        subtasks.forEach((task, index) => {
            if (index > 0) {
                // Each task depends on the previous one by default
                dependencies.push({
                    task: task.id,
                    dependsOn: subtasks[index - 1].id,
                    type: 'sequential'
                });
            }
            
            // Special dependency rules
            if (task.description.includes('validate') || task.description.includes('quality')) {
                // Validation tasks depend on data processing tasks
                const dataTasks = subtasks.filter(t => 
                    t.description.includes('analyze') || t.description.includes('search')
                );
                dataTasks.forEach(dataTask => {
                    if (dataTask.id !== task.id) {
                        dependencies.push({
                            task: task.id,
                            dependsOn: dataTask.id,
                            type: 'data_dependency'
                        });
                    }
                });
            }
        });
        
        return dependencies;
    }
}

// Export all agent classes
if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        GenomicsDataAnalyst,
        BioinformaticsResearcher,
        GenomeNavigator,
        QualityController,
        ProjectCoordinator
    };
} else {
    // Browser environment
    console.log('🔧 Exporting GenomicsCrewAgents classes to window object...');
    try {
        window.GenomicsDataAnalyst = GenomicsDataAnalyst;
        window.BioinformaticsResearcher = BioinformaticsResearcher;
        window.GenomeNavigator = GenomeNavigator;
        window.QualityController = QualityController;
        window.ProjectCoordinator = ProjectCoordinator;
        console.log('✅ GenomicsCrewAgents classes exported successfully');
    } catch (error) {
        console.error('❌ Error exporting GenomicsCrewAgents classes:', error);
    }
}