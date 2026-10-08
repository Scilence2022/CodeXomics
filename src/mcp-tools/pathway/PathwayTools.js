/**
 * Pathway Tools Module
 * Handles metabolic pathway visualization and BLAST sequence searches
 */

class PathwayTools {
  constructor(server) {
    this.server = server;
  }

  getTools() {
    return {
      show_metabolic_pathway: {
        name: 'show_metabolic_pathway',
        description: 'Display metabolic pathway visualization (e.g., glycolysis, TCA cycle, etc.)',
        parameters: {
          type: 'object',
          properties: {
            pathwayName: {
              type: 'string',
              description: 'Pathway name (glycolysis, tca_cycle, pentose_phosphate, etc.)',
            },
            highlightGenes: { type: 'array', description: 'List of genes to highlight in the pathway' },
            organism: { type: 'string', description: 'Organism name for pathway context' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['pathwayName'],
        },
      },

      find_pathway_genes: {
        name: 'find_pathway_genes',
        description: 'Find genes associated with a specific metabolic pathway',
        parameters: {
          type: 'object',
          properties: {
            pathwayName: { type: 'string', description: 'Pathway name to search for' },
            includeRegulation: { type: 'boolean', description: 'Include regulatory genes', default: false },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['pathwayName'],
        },
      },

      blast_search: {
        name: 'blast_search',
        description: 'Perform BLAST sequence similarity search',
        parameters: {
          type: 'object',
          properties: {
            sequence: { type: 'string', description: 'Query sequence' },
            blastType: { type: 'string', description: 'BLAST type (blastn, blastp, blastx, tblastn, tblastx)' },
            database: { type: 'string', description: 'Target database' },
            evalue: { type: 'string', description: 'E-value threshold', default: '0.01' },
            maxTargets: { type: 'number', description: 'Maximum number of targets', default: 50 },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['sequence', 'blastType', 'database'],
        },
      },
    };
  }

  async executeClientTool(toolName, parameters, clientId) {
    return await this.server.executeToolOnClient(toolName, parameters, clientId);
  }

  // Metabolic pathway definitions
  getPathwayDefinitions() {
    return {
      glycolysis: {
        name: 'Glycolysis',
        description: 'Glucose catabolism pathway',
        genes: ['glk', 'pgi', 'pfkA', 'fbaA', 'tpiA', 'gapA', 'pgk', 'gpmA', 'eno', 'pykF'],
        enzymes: [
          'EC:2.7.1.1',
          'EC:5.3.1.9',
          'EC:2.7.1.11',
          'EC:4.1.2.13',
          'EC:5.3.1.1',
          'EC:1.2.1.12',
          'EC:2.7.2.3',
          'EC:5.4.2.11',
          'EC:4.2.1.11',
          'EC:2.7.1.40',
        ],
        reactions: [
          { from: 'glucose', to: 'glucose-6-phosphate', enzyme: 'glk' },
          { from: 'glucose-6-phosphate', to: 'fructose-6-phosphate', enzyme: 'pgi' },
          { from: 'fructose-6-phosphate', to: 'fructose-1,6-bisphosphate', enzyme: 'pfkA' },
          {
            from: 'fructose-1,6-bisphosphate',
            to: 'dihydroxyacetone phosphate + glyceraldehyde-3-phosphate',
            enzyme: 'fbaA',
          },
          { from: 'dihydroxyacetone phosphate', to: 'glyceraldehyde-3-phosphate', enzyme: 'tpiA' },
          { from: 'glyceraldehyde-3-phosphate', to: '1,3-bisphosphoglycerate', enzyme: 'gapA' },
          { from: '1,3-bisphosphoglycerate', to: '3-phosphoglycerate', enzyme: 'pgk' },
          { from: '3-phosphoglycerate', to: '2-phosphoglycerate', enzyme: 'gpmA' },
          { from: '2-phosphoglycerate', to: 'phosphoenolpyruvate', enzyme: 'eno' },
          { from: 'phosphoenolpyruvate', to: 'pyruvate', enzyme: 'pykF' },
        ],
      },
      tca_cycle: {
        name: 'TCA Cycle (Citric Acid Cycle)',
        description: 'Central metabolic pathway for energy production',
        genes: ['gltA', 'acnA', 'icd', 'sucA', 'sucB', 'sucC', 'sucD', 'sdhA', 'sdhB', 'sdhC', 'sdhD', 'fumA', 'mdh'],
        enzymes: [
          'EC:2.3.3.1',
          'EC:4.2.1.3',
          'EC:1.1.1.42',
          'EC:1.2.4.2',
          'EC:2.3.1.61',
          'EC:6.2.1.5',
          'EC:6.2.1.5',
          'EC:1.3.5.1',
          'EC:1.3.5.1',
          'EC:1.3.5.1',
          'EC:1.3.5.1',
          'EC:4.2.1.2',
          'EC:1.1.1.37',
        ],
        reactions: [
          { from: 'acetyl-CoA + oxaloacetate', to: 'citrate', enzyme: 'gltA' },
          { from: 'citrate', to: 'isocitrate', enzyme: 'acnA' },
          { from: 'isocitrate', to: 'α-ketoglutarate', enzyme: 'icd' },
          { from: 'α-ketoglutarate', to: 'succinyl-CoA', enzyme: 'sucA/sucB' },
          { from: 'succinyl-CoA', to: 'succinate', enzyme: 'sucC/sucD' },
          { from: 'succinate', to: 'fumarate', enzyme: 'sdhABCD' },
          { from: 'fumarate', to: 'malate', enzyme: 'fumA' },
          { from: 'malate', to: 'oxaloacetate', enzyme: 'mdh' },
        ],
      },
      pentose_phosphate: {
        name: 'Pentose Phosphate Pathway',
        description: 'Alternative glucose oxidation pathway',
        genes: ['zwf', 'pgl', 'gnd', 'rpe', 'rpiA', 'tktA', 'talA', 'tktB'],
        enzymes: [
          'EC:1.1.1.49',
          'EC:3.1.1.31',
          'EC:1.1.1.44',
          'EC:5.1.3.1',
          'EC:5.3.1.6',
          'EC:2.2.1.1',
          'EC:2.2.1.2',
          'EC:2.2.1.1',
        ],
        reactions: [
          { from: 'glucose-6-phosphate', to: '6-phosphogluconolactone', enzyme: 'zwf' },
          { from: '6-phosphogluconolactone', to: '6-phosphogluconate', enzyme: 'pgl' },
          { from: '6-phosphogluconate', to: 'ribulose-5-phosphate', enzyme: 'gnd' },
          { from: 'ribulose-5-phosphate', to: 'xylulose-5-phosphate', enzyme: 'rpe' },
          { from: 'ribulose-5-phosphate', to: 'ribose-5-phosphate', enzyme: 'rpiA' },
          {
            from: 'xylulose-5-phosphate + ribose-5-phosphate',
            to: 'sedoheptulose-7-phosphate + glyceraldehyde-3-phosphate',
            enzyme: 'tktA',
          },
          {
            from: 'sedoheptulose-7-phosphate + glyceraldehyde-3-phosphate',
            to: 'erythrose-4-phosphate + fructose-6-phosphate',
            enzyme: 'talA',
          },
          {
            from: 'xylulose-5-phosphate + erythrose-4-phosphate',
            to: 'fructose-6-phosphate + glyceraldehyde-3-phosphate',
            enzyme: 'tktB',
          },
        ],
      },
      fatty_acid_synthesis: {
        name: 'Fatty Acid Synthesis',
        description: 'Biosynthesis of fatty acids',
        genes: ['accA', 'accB', 'accC', 'accD', 'fabD', 'fabH', 'fabG', 'fabA', 'fabI', 'fabB', 'fabF'],
        enzymes: [
          'EC:6.4.1.2',
          'EC:6.4.1.2',
          'EC:6.4.1.2',
          'EC:6.4.1.2',
          'EC:2.3.1.39',
          'EC:2.3.1.41',
          'EC:1.1.1.100',
          'EC:4.2.1.59',
          'EC:1.3.1.9',
          'EC:2.3.1.41',
          'EC:2.3.1.41',
        ],
        reactions: [
          { from: 'acetyl-CoA', to: 'malonyl-CoA', enzyme: 'accABCD' },
          { from: 'malonyl-CoA', to: 'malonyl-ACP', enzyme: 'fabD' },
          { from: 'acetyl-CoA + malonyl-ACP', to: 'acetoacetyl-ACP', enzyme: 'fabH' },
          { from: 'acetoacetyl-ACP', to: 'β-hydroxybutyryl-ACP', enzyme: 'fabG' },
          { from: 'β-hydroxybutyryl-ACP', to: 'crotonyl-ACP', enzyme: 'fabA' },
          { from: 'crotonyl-ACP', to: 'butyryl-ACP', enzyme: 'fabI' },
          { from: 'butyryl-ACP + malonyl-ACP', to: 'longer fatty acid-ACP', enzyme: 'fabB/fabF' },
        ],
      },
      amino_acid_synthesis: {
        name: 'Amino Acid Synthesis',
        description: 'Biosynthesis of amino acids',
        genes: [
          'ilvA',
          'ilvB',
          'ilvC',
          'ilvD',
          'ilvE',
          'leuA',
          'leuB',
          'leuC',
          'leuD',
          'serA',
          'serB',
          'serC',
          'thrA',
          'thrB',
          'thrC',
        ],
        enzymes: [
          'EC:4.3.1.19',
          'EC:2.2.1.6',
          'EC:1.1.1.86',
          'EC:4.2.1.9',
          'EC:2.6.1.42',
          'EC:2.3.3.13',
          'EC:1.1.1.85',
          'EC:4.2.1.33',
          'EC:2.6.1.6',
          'EC:1.1.1.95',
          'EC:2.1.1.49',
          'EC:4.2.99.21',
          'EC:1.1.1.3',
          'EC:4.2.3.1',
          'EC:2.7.1.39',
        ],
        reactions: [
          { from: 'threonine', to: 'α-ketobutyrate', enzyme: 'ilvA' },
          { from: 'α-ketobutyrate + pyruvate', to: 'α-acetolactate', enzyme: 'ilvB' },
          { from: 'α-acetolactate', to: 'α,β-dihydroxyisovalerate', enzyme: 'ilvC' },
          { from: 'α,β-dihydroxyisovalerate', to: 'α-ketoisovalerate', enzyme: 'ilvD' },
          { from: 'α-ketoisovalerate', to: 'valine', enzyme: 'ilvE' },
        ],
      },
    };
  }

  // Pathway visualization helpers
  generatePathwayVisualization(pathwayName, highlightGenes = []) {
    const pathway = this.getPathwayDefinitions()[pathwayName];
    if (!pathway) {
      throw new Error(`Pathway '${pathwayName}' not found`);
    }

    return {
      name: pathway.name,
      description: pathway.description,
      genes: pathway.genes.map(gene => ({
        name: gene,
        highlighted: highlightGenes.includes(gene),
        enzyme: pathway.enzymes[pathway.genes.indexOf(gene)],
      })),
      reactions: pathway.reactions,
      visualization: {
        type: 'pathway_diagram',
        layout: 'circular',
        nodes: pathway.genes.length,
        edges: pathway.reactions.length,
      },
    };
  }

  findGenesInPathway(pathwayName, includeRegulation = false) {
    const pathway = this.getPathwayDefinitions()[pathwayName];
    if (!pathway) {
      throw new Error(`Pathway '${pathwayName}' not found`);
    }

    const genes = pathway.genes.map((gene, index) => ({
      name: gene,
      enzyme: pathway.enzymes[index],
      function: this.getGeneFunction(gene, pathwayName),
      regulation: includeRegulation ? this.getGeneRegulation(gene) : null,
    }));

    return {
      pathway: pathway.name,
      description: pathway.description,
      geneCount: genes.length,
      genes: genes,
    };
  }

  getGeneFunction(gene, pathwayName) {
    const functions = {
      glycolysis: {
        glk: 'Glucose kinase - phosphorylates glucose to glucose-6-phosphate',
        pgi: 'Phosphoglucose isomerase - converts glucose-6-phosphate to fructose-6-phosphate',
        pfkA: 'Phosphofructokinase - key regulatory enzyme, phosphorylates fructose-6-phosphate',
        fbaA: 'Fructose-bisphosphate aldolase - cleaves fructose-1,6-bisphosphate',
        tpiA: 'Triose phosphate isomerase - interconverts triose phosphates',
        gapA: 'Glyceraldehyde-3-phosphate dehydrogenase - oxidizes glyceraldehyde-3-phosphate',
        pgk: 'Phosphoglycerate kinase - generates ATP from 1,3-bisphosphoglycerate',
        gpmA: 'Phosphoglycerate mutase - converts 3-phosphoglycerate to 2-phosphoglycerate',
        eno: 'Enolase - converts 2-phosphoglycerate to phosphoenolpyruvate',
        pykF: 'Pyruvate kinase - generates ATP and pyruvate from phosphoenolpyruvate',
      },
    };

    return functions[pathwayName]?.[gene] || 'Function not available';
  }

  getGeneRegulation(gene) {
    // Simplified regulation information
    const regulations = {
      glk: 'Repressed by glucose-6-phosphate',
      pfkA: 'Activated by ADP, inhibited by ATP and citrate',
      pykF: 'Activated by fructose-1,6-bisphosphate',
      gltA: 'Inhibited by α-ketoglutarate and succinyl-CoA',
      icd: 'Regulated by phosphorylation/dephosphorylation',
    };

    return regulations[gene] || 'Regulation not available';
  }
}

module.exports = PathwayTools;
