#!/usr/bin/env node

/**
 * Extract test names and instructions from benchmark suite files
 * Output as CSV organized by category
 */

const fs = require('fs');
const path = require('path');

const suiteFiles = [
  'src/renderer/modules/benchmark-suites/AutomaticSimpleSuite.js',
  'src/renderer/modules/benchmark-suites/AutomaticComplexSuite.js',
  'src/renderer/modules/benchmark-suites/ManualSuite.js',
  'src/renderer/modules/benchmark-suites/ManualComplexSuite.js',
];

const baseDir = '/Users/song/Github-Repos/CodeXomics';

function extractTestsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tests = [];
  
  // Split content into test blocks by finding test start markers
  const testBlocks = content.match(/\{\s*id:\s*'[^']+',\s*name:\s*'[^']+',[\s\S]*?(?=\{[\s,]*id:\s*'[^']+',\s*name:\s*'[^']+',|\];)/g) || [];
  
  for (const block of testBlocks) {
    const idMatch = block.match(/id:\s*'([^']+)'/);
    const nameMatch = block.match(/name:\s*'([^']+)'/);
    const categoryMatch = block.match(/category:\s*'([^']+)'/);
    
    if (!idMatch || !nameMatch || !categoryMatch) continue;
    
    const id = idMatch[1];
    const name = nameMatch[1];
    const category = categoryMatch[1];
    
    // Extract instruction - handle both backticks and single quotes
    let instruction = '';
    const instructionMatch = block.match(/instruction:\s*`([^`]+)`/);
    if (instructionMatch) {
      instruction = instructionMatch[1];
    } else {
      // Try single-quoted instruction (may span multiple lines)
      const singleQuoteMatch = block.match(/instruction:\s*'([^']+)'/);
      if (singleQuoteMatch) {
        instruction = singleQuoteMatch[1];
      }
    }
    
    tests.push({
      id,
      name,
      category,
      instruction: instruction.trim().replace(/\s+/g, ' '),
    });
  }
  
  return tests;
}

function escapeCSVField(field) {
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  return field;
}

function main() {
  console.log('Extracting tests from benchmark suite files...\n');
  
  const summary = [];
  
  for (const suiteFile of suiteFiles) {
    const fullPath = path.join(baseDir, suiteFile);
    console.log(`Processing: ${suiteFile}`);
    
    try {
      const tests = extractTestsFromFile(fullPath);
      console.log(`  Found ${tests.length} tests`);
      
      // Group by category
      const byCategory = {};
      for (const test of tests) {
        if (!byCategory[test.category]) {
          byCategory[test.category] = [];
        }
        byCategory[test.category].push(test);
      }
      
      // Generate CSV for this suite
      const csvLines = [];
      csvLines.push('Category,Test ID,Test Name,Instruction');
      
      // Sort categories alphabetically
      const sortedCategories = Object.keys(byCategory).sort();
      
      for (const category of sortedCategories) {
        const categoryTests = byCategory[category];
        for (const test of categoryTests) {
          csvLines.push([
            escapeCSVField(category),
            escapeCSVField(test.id),
            escapeCSVField(test.name),
            escapeCSVField(test.instruction),
          ].join(','));
        }
      }
      
      // Write CSV file - use suite file name as base
      const suiteFileName = path.basename(suiteFile, '.js');
      const outputPath = path.join(baseDir, `benchmark_${suiteFileName}.csv`);
      fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf-8');
      
      console.log(`  ✅ Output: benchmark_${suiteFileName}.csv`);
      console.log(`  📊 Categories: ${sortedCategories.length}\n`);
      
      summary.push({
        file: suiteFileName,
        tests: tests.length,
        categories: sortedCategories.length,
        outputPath,
      });
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 EXTRACTION SUMMARY');
  console.log('='.repeat(60));
  
  let totalTests = 0;
  for (const item of summary) {
    console.log(`\n${item.file}:`);
    console.log(`  Tests: ${item.tests}`);
    console.log(`  Categories: ${item.categories}`);
    console.log(`  File: ${path.basename(item.outputPath)}`);
    totalTests += item.tests;
  }
  
  console.log('\n' + '-'.repeat(60));
  console.log(`✅ Total: ${totalTests} tests across ${summary.length} files`);
  console.log('='.repeat(60));
}

main();
