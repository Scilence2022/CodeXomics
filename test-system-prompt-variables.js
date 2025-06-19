/**
 * Test script for System Prompt Variables Enhancement
 * 
 * This script tests the enhanced system prompt variables:
 * - {current_state} - Enhanced detailed current state
 * - {all_tools} - New comprehensive tools documentation
 * - {microbe_functions} - Enhanced microbe genomics functions info
 */

// Test prompt template with the enhanced variables
const testPrompt = `
您是基因组分析助手。以下是当前系统状态：

Current state:
{current_state}

You have access to the following tools:
{all_tools}

微生物基因组学功能详情：
{microbe_functions}

工具统计信息：
- 总工具数: {total_tools}
- 本地工具: {local_tools}
- 插件工具: {plugin_tools}
- MCP工具: {mcp_tools}

当前基因组信息：
{genome_info}

请根据这些信息回答用户的问题。
`;

console.log('=== System Prompt Variables Test ===');
console.log('Testing enhanced variables implementation...');
console.log();

// Test template
console.log('TEST TEMPLATE:');
console.log('==============');
console.log(testPrompt);
console.log();

// Instructions for manual testing
console.log('MANUAL TESTING INSTRUCTIONS:');
console.log('============================');
console.log('1. Start GenomeExplorer: npm start');
console.log('2. Open Chat interface');
console.log('3. Go to LLM Configuration');
console.log('4. Enable "Use Custom System Prompt"');
console.log('5. Paste the test template above');
console.log('6. Send a test message');
console.log('7. Verify that variables are replaced with detailed content');
console.log();

console.log('EXPECTED VARIABLE REPLACEMENTS:');
console.log('===============================');

console.log('✓ {current_state} should show:');
console.log('  - GENOME BROWSER CURRENT STATE section');
console.log('  - NAVIGATION & POSITION details');
console.log('  - DATA STATUS information');
console.log('  - SYSTEM STATUS with MCP/Plugin status');
console.log('  - TOOL AVAILABILITY statistics');
console.log();

console.log('✓ {all_tools} should show:');
console.log('  - COMPREHENSIVE TOOLS DOCUMENTATION header');
console.log('  - TOOL STATISTICS section');
console.log('  - MCP SERVER TOOLS details');
console.log('  - MICROBE GENOMICS FUNCTIONS section');
console.log('  - PLUGIN SYSTEM TOOLS section');
console.log('  - CORE LOCAL TOOLS with categories');
console.log('  - TOOL USAGE EXAMPLES');
console.log();

console.log('✓ {microbe_functions} should show:');
console.log('  - "MicrobeGenomics Functions: Available with X categories"');
console.log('  - CATEGORIES section with function counts');
console.log('  - USAGE EXAMPLES section');
console.log();

console.log('✓ Tool count variables should show numeric values:');
console.log('  - {total_tools}: Should be ~74');
console.log('  - {local_tools}: Should be ~62');
console.log('  - {plugin_tools}: Should be ~9');
console.log('  - {mcp_tools}: Should be ~23');
console.log();

console.log('VALIDATION CHECKLIST:');
console.log('====================');
console.log('□ Variables are replaced (no {variable_name} left in output)');
console.log('□ Content is structured and readable');
console.log('□ Tool counts match expected ranges');
console.log('□ MCP server status is accurate');
console.log('□ Plugin system status is accurate');
console.log('□ All tool categories are present');
console.log('□ Examples are included in tool documentation');
console.log('□ Current state reflects actual browser state');
console.log('□ No JavaScript errors in console');
console.log('□ LLM receives complete context');
console.log();

console.log('SUCCESS CRITERIA:');
console.log('=================');
console.log('✓ All variables replaced with detailed content');
console.log('✓ {current_state} shows comprehensive browser state');
console.log('✓ {all_tools} provides complete tool documentation');
console.log('✓ {microbe_functions} shows detailed function info');
console.log('✓ Tool statistics are accurate and current');
console.log('✓ LLM can access all available tools and context');
console.log('✓ Custom system prompts work identically to default prompts');
console.log();

console.log('Test script completed. Please run manual testing as instructed above.');

// Export for potential use in other tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        testPrompt,
        expectedVariables: [
            'current_state',
            'all_tools', 
            'microbe_functions',
            'total_tools',
            'local_tools', 
            'plugin_tools',
            'mcp_tools',
            'genome_info'
        ]
    };
} 