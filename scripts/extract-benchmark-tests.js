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

const baseDir = path.resolve(__dirname, '..');
const outputDir = path.join(baseDir, 'docs/reference/benchmark-suites');

function extractTestsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const tests = [];

  // Split content into test blocks by finding test start markers
  const testBlocks =
    content.match(/\{\s*id:\s*'[^']+',\s*name:\s*'[^']+',[\s\S]*?(?=\{[\s,]*id:\s*'[^']+',\s*name:\s*'[^']+',|\];)/g) ||
    [];

  for (const block of testBlocks) {
    const idMatch = block.match(/id:\s*'([^']+)'/);
    const nameMatch = block.match(/name:\s*'([^']+)'/);
    const categoryMatch = block.match(/category:\s*'([^']+)'/);

    if (!idMatch || !nameMatch || !categoryMatch) continue;

    const id = idMatch[1];
    const name = nameMatch[1];
    const category = categoryMatch[1];

    // Extract instruction from template literals, single-quoted, or double-quoted strings.
    let instruction = '';
    const instructionPatterns = [
      /instruction:\s*`([\s\S]*?)`/,
      /instruction:\s*'((?:\\.|[^'\\])*)'/,
      /instruction:\s*"((?:\\.|[^"\\])*)"/,
    ];

    for (const pattern of instructionPatterns) {
      const match = block.match(pattern);
      if (match) {
        instruction = match[1].replace(/\\(["'`\\])/g, '$1');
        break;
      }
    }

    tests.push({
      id,
      name,
      category,
      instruction: instruction.trim().replace(/\s+/g, ' '),
    });
  }

  return assignTestNumbers(tests, extractPreferredOrder(content));
}

/**
 * A suite may pin an execution order (AutomaticComplexSuite.getPreferredTestOrder),
 * in which case that - not declaration order - is what the suite numbers against.
 */
function extractPreferredOrder(content) {
  const match = content.match(/getPreferredTestOrder\(\)\s*\{\s*return\s*\[([\s\S]*?)\];/);
  if (!match) return null;

  return [...match[1].matchAll(/'([^']+)'/g)].map(entry => entry[1]);
}

/**
 * Stamp the number the benchmark UI shows for each test, so a failure reported
 * as "#12" can be looked up here. Mirrors BenchmarkEvaluatorBase.numberTests.
 */
function assignTestNumbers(tests, preferredOrder) {
  const rank = new Map((preferredOrder || []).map((id, index) => [id, index]));
  const ordered = [...tests].sort(
    (a, b) =>
      (rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER) -
      (rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER)
  );

  ordered.forEach((test, index) => {
    test.number = index + 1;
  });

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
  fs.mkdirSync(outputDir, { recursive: true });

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
      csvLines.push('Category,Test #,Test ID,Test Name,Instruction');

      // Sort categories alphabetically
      const sortedCategories = Object.keys(byCategory).sort();

      for (const category of sortedCategories) {
        const categoryTests = byCategory[category];
        for (const test of categoryTests) {
          csvLines.push(
            [
              escapeCSVField(category),
              escapeCSVField(String(test.number)),
              escapeCSVField(test.id),
              escapeCSVField(test.name),
              escapeCSVField(test.instruction),
            ].join(',')
          );
        }
      }

      // Write CSV file - use suite file name as base
      const suiteFileName = path.basename(suiteFile, '.js');
      const outputPath = path.join(outputDir, `benchmark_${suiteFileName}.csv`);
      fs.writeFileSync(outputPath, csvLines.join('\n'), 'utf-8');

      console.log(`  ✅ Output: ${path.relative(baseDir, outputPath)}`);
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
    console.log(`  File: ${path.relative(baseDir, item.outputPath)}`);
    totalTests += item.tests;
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`✅ Total: ${totalTests} tests across ${summary.length} files`);
  console.log('='.repeat(60));
}

main();
