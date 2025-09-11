#!/usr/bin/env node

/**
 * Direct test of Deep Research MCP server
 * This script directly tests the MCP server to see what it returns
 */

const fetch = require('node-fetch');

async function testDeepResearchMCP() {
    const serverUrl = 'http://localhost:3000/api/mcp';
    
    console.log('🔍 Testing Deep Research MCP Server');
    console.log('URL:', serverUrl);
    console.log('');
    
    try {
        // Test 1: Basic connection
        console.log('1. Testing basic connection...');
        const getResponse = await fetch(serverUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });
        console.log(`   GET Response: ${getResponse.status} ${getResponse.statusText}`);
        
        // Test 2: MCP JSON-RPC ping
        console.log('2. Testing MCP JSON-RPC ping...');
        const pingResponse = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'ping',
                id: 'test-ping'
            })
        });
        console.log(`   Ping Response: ${pingResponse.status} ${pingResponse.statusText}`);
        
        if (pingResponse.ok) {
            const pingData = await pingResponse.json();
            console.log('   Ping Data:', JSON.stringify(pingData, null, 2));
        }
        
        // Test 3: MCP tools/list
        console.log('3. Testing MCP tools/list...');
        const toolsResponse = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'tools/list',
                id: 'test-tools'
            })
        });
        console.log(`   Tools Response: ${toolsResponse.status} ${toolsResponse.statusText}`);
        
        if (toolsResponse.ok) {
            const toolsData = await toolsResponse.json();
            console.log('   Tools Data:', JSON.stringify(toolsData, null, 2));
            
            // Analyze the response
            console.log('   Analysis:');
            console.log('   - Response type:', typeof toolsData);
            console.log('   - Response keys:', Object.keys(toolsData));
            
            if (toolsData.result) {
                console.log('   - result type:', typeof toolsData.result);
                console.log('   - result keys:', Object.keys(toolsData.result));
                
                if (toolsData.result.tools) {
                    console.log('   - tools found:', toolsData.result.tools.length);
                    console.log('   - tools:', toolsData.result.tools);
                }
            }
        }
        
        // Test 4: MCP initialize
        console.log('4. Testing MCP initialize...');
        const initResponse = await fetch(serverUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: {
                        name: 'test-client',
                        version: '1.0.0'
                    }
                },
                id: 'test-init'
            })
        });
        console.log(`   Init Response: ${initResponse.status} ${initResponse.statusText}`);
        
        if (initResponse.ok) {
            const initData = await initResponse.json();
            console.log('   Init Data:', JSON.stringify(initData, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the test
testDeepResearchMCP().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
