const fs = require('fs');
const file = 'src/circos-plotter.js';
let code = fs.readFileSync(file, 'utf8');

// Remove initializations
code = code.replace(/\n\s*this\.maxGenes\s*=\s*\d+;/, '');
code = code.replace(/\n\s*this\.maxLinks\s*=\s*\d+;/, '');

// Remove event listener for optimizeBtn
code = code.replace(/\n\s*document\.getElementById\('optimizeBtn'\)\.addEventListener\('click', \(\) => this\.optimizeParameters\(\)\);/, '');

// Remove maxGenesSlider and maxLinksSlider bindings
code = code.replace(/\n\s*\['maxGenesSlider'.*?\],/, '');
code = code.replace(/\n\s*\['maxLinksSlider'.*?\],/, '');

// Remove maxGenesValue and maxLinksValue
code = code.replace(/\n\s*maxGenesValue:.*?,/, '');
code = code.replace(/\n\s*maxLinksValue:.*?,/, '');

// Fix data generation functions
code = code.replace(/return genes\.slice\(0, this\.maxGenes\);/g, 'return genes;');
code = code.replace(/this\.data\.links\.slice\(0, this\.maxLinks\)\.forEach/g, 'this.data.links.forEach');
code = code.replace(/i < this\.maxLinks; i\+\+/g, 'i < 50; i++');
code = code.replace(/Math\.min\(100, this\.maxGenes - 9\)/g, '100');
code = code.replace(/Math\.min\(numGenes, Math\.floor\(this\.maxGenes \/ this\.data\.chromosomes\.length\)\)/g, 'numGenes');
code = code.replace(/Math\.min\(this\.maxLinks, (\d+)\)/g, '$1');

// Remove assignments to maxGenes and maxLinks in parseData
code = code.replace(/\n\s*this\.maxGenes\s*=\s*Math\.min\(this\.maxGenes, \d+\);/g, '');
code = code.replace(/\n\s*this\.maxGenes\s*=\s*Math\.min\(\d+, geneCount\);/g, '');
code = code.replace(/\n\s*this\.maxGenes\s*=\s*\d+;/g, '');
code = code.replace(/\n\s*this\.maxLinks\s*=\s*\d+;/g, '');

// Remove from updateUISliders
code = code.replace(/\n\s*maxGenesSlider: this\.maxGenes,/, '');

// Replace cache keys
code = code.replace(/_\$\{this\.plotter\.maxGenes\}/g, '');
code = code.replace(/_\$\{this\.plotter\.maxLinks\}/g, '');

// Process Genes
code = code.replace(/const maxGenes = this\.plotter\.renderingMode === 'canvas'\s*\n\s*\? Math\.min\(genes\.length, this\.plotter\.maxGenes\)\s*\n\s*: genes\.length;\n\n\s*const processed = genes\.slice\(0, maxGenes\)/g, 'const processed = genes');

// Process Links
code = code.replace(/const maxLinks = Math\.min\(links\.length, this\.plotter\.maxLinks\);\n\s*const linksToProcess = links\.slice\(0, maxLinks\);/g, 'const linksToProcess = links;');

// Remove optimizeParameters method
const regex = /\/\/ ─── AI Optimization ────────────────────────────────────[\s\S]*?updateUISliders\(\) {/m;
code = code.replace(regex, 'updateUISliders() {');

// Remove maxGenesSlider and maxLinksSlider from plot loading reset
code = code.replace(/maxGenesSlider: 200, maxLinksSlider: 50,/g, '');

// Remove protein_coding.maxGenes warning in createSVGPlot
code = code.replace(/\n\s*if \(cdsGenes\.length > this\.multiTrackManager\.geneTracks\.protein_coding\.maxGenes\) \{[\s\S]*?\n\s*\}/m, '');


fs.writeFileSync(file, code);
console.log("Done");
