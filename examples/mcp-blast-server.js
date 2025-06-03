/**
 * Example MCP BLAST Server
 * 
 * This is an example implementation of a local BLAST server that can be used
 * as an MCP server with the Genome Viewer application.
 * 
 * Features:
 * - Local BLAST database support
 * - Batch BLAST searches
 * - Advanced filtering and algorithms
 * - Custom database management
 * 
 * To use this server:
 * 1. Install BLAST+ locally
 * 2. Set up local databases
 * 3. Run this server: node mcp-blast-server.js
 * 4. Configure the Genome Viewer to connect to ws://localhost:3002
 */

const WebSocket = require('ws');
const { spawn, exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

class MCPBlastServer {
    constructor(port = 3002) {
        this.port = port;
        this.tools = new Map();
        this.databases = new Map();
        this.blastPath = 'blastn'; // Path to BLAST+ executables
        
        this.initializeTools();
        this.loadDatabases();
    }

    initializeTools() {
        // Register available tools
        this.tools.set('blast_nucleotide_search', {
            name: 'blast_nucleotide_search',
            description: 'Perform nucleotide BLAST search using local databases',
            parameters: {
                sequence: { type: 'string', required: true },
                database: { type: 'string', required: true },
                evalue: { type: 'string', default: '0.01' },
                maxTargets: { type: 'number', default: 50 },
                wordSize: { type: 'string', default: '11' }
            }
        });

        this.tools.set('blast_protein_search', {
            name: 'blast_protein_search',
            description: 'Perform protein BLAST search using local databases',
            parameters: {
                sequence: { type: 'string', required: true },
                database: { type: 'string', required: true },
                evalue: { type: 'string', default: '0.01' },
                maxTargets: { type: 'number', default: 50 },
                matrix: { type: 'string', default: 'BLOSUM62' }
            }
        });

        this.tools.set('batch_blast_search', {
            name: 'batch_blast_search',
            description: 'Perform batch BLAST searches with multiple sequences',
            parameters: {
                sequences: { type: 'array', required: true },
                blastType: { type: 'string', required: true },
                database: { type: 'string', required: true },
                maxTargets: { type: 'number', default: 10 }
            }
        });

        this.tools.set('advanced_blast_search', {
            name: 'advanced_blast_search',
            description: 'Advanced BLAST search with filtering and custom algorithms',
            parameters: {
                sequence: { type: 'string', required: true },
                blastType: { type: 'string', required: true },
                database: { type: 'string', required: true },
                filters: { type: 'object', default: {} },
                algorithms: { type: 'object', default: {} }
            }
        });

        this.tools.set('local_blast_database_info', {
            name: 'local_blast_database_info',
            description: 'Get information about local BLAST databases',
            parameters: {
                databasePath: { type: 'string', required: false }
            }
        });

        this.tools.set('create_blast_database', {
            name: 'create_blast_database',
            description: 'Create a new BLAST database from FASTA file',
            parameters: {
                fastaFile: { type: 'string', required: true },
                dbName: { type: 'string', required: true },
                dbType: { type: 'string', required: true }, // nucl or prot
                title: { type: 'string', required: false }
            }
        });
    }

    async loadDatabases() {
        // Scan for available BLAST databases
        // This is a simplified example - in practice, you'd scan actual database directories
        this.databases.set('local_genome', {
            name: 'local_genome',
            type: 'nucleotide',
            path: '/usr/local/blast/db/local_genome',
            description: 'Local genome sequences',
            sequences: 1000,
            letters: 1000000
        });

        this.databases.set('local_proteins', {
            name: 'local_proteins',
            type: 'protein',
            path: '/usr/local/blast/db/local_proteins',
            description: 'Local protein sequences',
            sequences: 5000,
            letters: 2000000
        });
    }

    start() {
        const wss = new WebSocket.Server({ port: this.port });
        console.log(`MCP BLAST Server listening on port ${this.port}`);

        wss.on('connection', (ws) => {
            console.log('Client connected to BLAST server');

            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    const response = await this.handleMessage(data);
                    ws.send(JSON.stringify(response));
                } catch (error) {
                    console.error('Error processing message:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: error.message
                    }));
                }
            });

            ws.on('close', () => {
                console.log('Client disconnected from BLAST server');
            });

            // Send initial connection acknowledgment
            ws.send(JSON.stringify({
                type: 'connection',
                status: 'connected',
                server: 'MCP BLAST Server',
                version: '1.0.0'
            }));
        });
    }

    async handleMessage(data) {
        switch (data.type) {
            case 'request-tools':
                return {
                    type: 'tools',
                    tools: Array.from(this.tools.values())
                };

            case 'execute-tool':
                return await this.executeTool(data.requestId, data.toolName, data.parameters);

            case 'authenticate':
                return {
                    type: 'auth-response',
                    status: 'authenticated'
                };

            default:
                throw new Error(`Unknown message type: ${data.type}`);
        }
    }

    async executeTool(requestId, toolName, parameters) {
        try {
            let result;

            switch (toolName) {
                case 'blast_nucleotide_search':
                    result = await this.executeBlastSearch('blastn', parameters);
                    break;

                case 'blast_protein_search':
                    result = await this.executeBlastSearch('blastp', parameters);
                    break;

                case 'batch_blast_search':
                    result = await this.executeBatchBlast(parameters);
                    break;

                case 'advanced_blast_search':
                    result = await this.executeAdvancedBlast(parameters);
                    break;

                case 'local_blast_database_info':
                    result = await this.getDatabaseInfo(parameters);
                    break;

                case 'create_blast_database':
                    result = await this.createDatabase(parameters);
                    break;

                default:
                    throw new Error(`Unknown tool: ${toolName}`);
            }

            return {
                type: 'tool-response',
                requestId: requestId,
                success: true,
                result: result
            };

        } catch (error) {
            return {
                type: 'tool-response',
                requestId: requestId,
                success: false,
                error: error.message
            };
        }
    }

    async executeBlastSearch(blastType, params) {
        // This is a simplified example - actual implementation would use BLAST+ commands
        const { sequence, database, evalue = '0.01', maxTargets = 50 } = params;

        // Simulate BLAST search (in real implementation, would use child_process to run BLAST)
        const mockResults = {
            searchId: `blast_${Date.now()}`,
            queryInfo: {
                length: sequence.length,
                type: blastType === 'blastp' ? 'Protein' : 'Nucleotide'
            },
            parameters: {
                blastType: blastType,
                database: database,
                evalue: evalue,
                maxTargets: maxTargets
            },
            hits: this.generateMockHits(sequence, maxTargets),
            statistics: {
                database: database,
                totalSequences: this.databases.get(database)?.sequences || 1000,
                totalLetters: this.databases.get(database)?.letters || 1000000,
                searchTime: '2.3 seconds'
            }
        };

        return mockResults;
    }

    async executeBatchBlast(params) {
        const { sequences, blastType, database, maxTargets = 10 } = params;
        const results = [];

        for (let i = 0; i < sequences.length; i++) {
            const sequence = sequences[i];
            const searchParams = {
                sequence: sequence.sequence || sequence,
                database: database,
                maxTargets: maxTargets
            };

            const result = await this.executeBlastSearch(blastType, searchParams);
            results.push({
                sequenceIndex: i,
                sequenceId: sequence.id || `seq_${i + 1}`,
                ...result
            });
        }

        return {
            batchId: `batch_${Date.now()}`,
            totalSequences: sequences.length,
            results: results,
            summary: `Batch BLAST completed for ${sequences.length} sequences`
        };
    }

    async executeAdvancedBlast(params) {
        const { sequence, blastType, database, filters = {}, algorithms = {} } = params;

        // Execute basic BLAST search with custom algorithms
        const basicParams = {
            sequence: sequence,
            database: database,
            ...algorithms
        };

        const result = await this.executeBlastSearch(blastType, basicParams);

        // Apply filters
        if (Object.keys(filters).length > 0) {
            result.hits = this.applyFilters(result.hits, filters);
            result.filteredHits = result.hits.length;
        }

        return result;
    }

    applyFilters(hits, filters) {
        let filtered = [...hits];

        if (filters.minIdentity) {
            filtered = filtered.filter(hit => 
                parseFloat(hit.identity.replace('%', '')) >= filters.minIdentity
            );
        }

        if (filters.minCoverage) {
            filtered = filtered.filter(hit => 
                parseFloat(hit.coverage.replace('%', '')) >= filters.minCoverage
            );
        }

        if (filters.maxEvalue) {
            filtered = filtered.filter(hit => 
                parseFloat(hit.evalue) <= filters.maxEvalue
            );
        }

        return filtered;
    }

    async getDatabaseInfo(params) {
        const info = {
            localDatabases: Array.from(this.databases.values()),
            databaseCount: this.databases.size,
            blastVersion: await this.getBlastVersion(),
            capabilities: [
                'local_search',
                'batch_processing',
                'custom_algorithms',
                'database_creation'
            ]
        };

        if (params.databasePath) {
            // Get specific database info
            const dbName = path.basename(params.databasePath);
            const dbInfo = this.databases.get(dbName);
            if (dbInfo) {
                info.requestedDatabase = dbInfo;
            }
        }

        return info;
    }

    async createDatabase(params) {
        const { fastaFile, dbName, dbType, title } = params;

        // Simulate database creation (in real implementation, would use makeblastdb)
        const newDb = {
            name: dbName,
            type: dbType === 'nucl' ? 'nucleotide' : 'protein',
            path: `/usr/local/blast/db/${dbName}`,
            description: title || `Custom ${dbType} database`,
            created: new Date().toISOString(),
            status: 'created'
        };

        this.databases.set(dbName, newDb);

        return {
            success: true,
            database: newDb,
            message: `Database ${dbName} created successfully`
        };
    }

    async getBlastVersion() {
        // Simulate getting BLAST version
        return 'BLAST+ 2.12.0';
    }

    generateMockHits(sequence, maxTargets) {
        const hits = [];
        const numHits = Math.min(Math.floor(Math.random() * maxTargets) + 1, maxTargets);

        for (let i = 0; i < numHits; i++) {
            hits.push({
                accession: `MOCK_${String(i + 1).padStart(6, '0')}`,
                description: `Mock sequence ${i + 1} - ${this.generateMockDescription()}`,
                length: Math.floor(Math.random() * 5000) + 1000,
                score: Math.floor(Math.random() * 1000) + 100,
                evalue: (Math.random() * 0.01).toExponential(2),
                identity: `${Math.floor(Math.random() * 30) + 70}%`,
                coverage: `${Math.floor(Math.random() * 40) + 60}%`,
                alignment: {
                    query: sequence.substring(0, Math.min(50, sequence.length)),
                    match: '||||||||||||||||||||||||||||||||||||||||||||||||||||',
                    subject: sequence.substring(0, Math.min(50, sequence.length))
                }
            });
        }

        // Sort by score (descending)
        hits.sort((a, b) => b.score - a.score);
        return hits;
    }

    generateMockDescription() {
        const organisms = ['Escherichia coli', 'Bacillus subtilis', 'Salmonella enterica'];
        const genes = ['dnaA', 'recA', 'gyrB', 'rpoB', 'groEL'];
        const organism = organisms[Math.floor(Math.random() * organisms.length)];
        const gene = genes[Math.floor(Math.random() * genes.length)];
        return `${gene} gene from ${organism}`;
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    const server = new MCPBlastServer();
    server.start();
}

module.exports = MCPBlastServer; 