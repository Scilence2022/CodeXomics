# ChatBox & Analyzer Tools Integration Guide

## Overview

This guide explains how to integrate the analyzer tools (KEGG, GO, InterPro) with ChatBox for bidirectional LLM-powered analysis.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     Main Process (IPC)                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  analyzerPendingData Map                               │  │
│  │  - Stores data waiting for analyzer windows           │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────┬───────────────────────┬──────────────────┘
                   │                       │
         ┌─────────▼─────────┐   ┌────────▼──────────┐
         │   ChatBox         │   │  Analyzer Tools   │
         │  (Renderer)       │   │   (Renderer)      │
         └─────────┬─────────┘   └────────┬──────────┘
                   │                      │
                   │ ◄────────────────────┤
                   │    analyze-in-chatbox
                   │                      │
                   ├──────────────────────► 
                   │  llm-interpretation-result
                   │                      │
```

## IPC Messages Reference

### From Analyzer Tools to ChatBox

#### 1. `analyze-in-chatbox`
**Purpose**: Send analysis results to ChatBox for LLM interpretation

**Payload**:
```javascript
{
  toolName: string,        // e.g., "KEGG Pathway Analysis"
  query: string,           // Formatted question for LLM
  data: object,            // Full analysis results
  timestamp: string        // ISO timestamp
}
```

**Example**:
```javascript
ipcRenderer.send('analyze-in-chatbox', {
  toolName: 'KEGG Pathway Analysis',
  query: 'I found 5 enriched pathways including Cell cycle and p53 signaling. Please interpret...',
  data: {
    enrichedPathways: [...],
    inputGenes: [...]
  },
  timestamp: new Date().toISOString()
});
```

#### 2. `request-llm-interpretation`
**Purpose**: Request AI interpretation of specific results

**Payload**:
```javascript
{
  toolName: string,
  data: object,           // Analysis data to interpret
  context: {
    analysisType: string,
    resultCount: number,
    ...
  }
}
```

### From ChatBox to Analyzer Tools

#### 3. `send-to-analyzer`
**Purpose**: Send ChatBox LLM results to specific analyzer for visualization

**Payload**:
```javascript
{
  toolName: string,       // Target analyzer
  data: object,           // LLM-processed data
  originalQuery: string   // Original user query
}
```

**Example**:
```javascript
// When LLM returns KEGG analysis results
ipcRenderer.send('send-to-analyzer', {
  toolName: 'kegg-analyzer',
  data: llmResults,
  originalQuery: userQuestion
});
```

#### 4. `llm-interpretation-result`
**Purpose**: Return LLM interpretation to analyzer tool

**Received by analyzer via**:
```javascript
ipcRenderer.on('llm-interpretation-result', (event, result) => {
  this.displayLLMInterpretation(result);
});
```

## ChatBox Integration Code

### Required Changes to ChatManager.js

Add these handlers in the ChatManager constructor or initialization:

```javascript
class ChatManager {
  constructor(app, configManager = null) {
    
    // Initialize analyzer tool integration
    this.initializeAnalyzerIntegration();
  }

  /**
   * Initialize IPC handlers for analyzer tool integration
   */
  initializeAnalyzerIntegration() {
    const { ipcRenderer } = require('electron');
    
    // Handle analysis requests from analyzer tools
    ipcRenderer.on('chatbox-analyze-request', (event, request) => {
      console.log('[ChatBox] Received analysis request from:', request.toolName);
      
      // Add system message indicating source
      this.addSystemMessage(
        `📊 Analysis request from ${request.toolName}`,
        'info'
      );
      
      // Send the query to LLM
      this.sendMessageProgrammatically(request.query);
      
      // Optionally store the original data for context
      this.lastAnalyzerRequest = request;
    });
    
    // Handle interpretation requests
    ipcRenderer.on('chatbox-interpret-request', async (event, request) => {
      console.log('[ChatBox] Interpretation requested for:', request.toolName);
      
      // Show thinking message
      this.addThinkingMessage(`Analyzing ${request.toolName} results...`);
      
      try {
        // Send to LLM and get interpretation
        const interpretation = await this.sendToLLM(request.query);
        
        // Send back to the requesting analyzer
        ipcRenderer.send('llm-interpretation-response', {
          interpretation: interpretation,
          targetWindow: request.responseTarget,
          timestamp: new Date().toISOString()
        });
        
        // Also display in ChatBox
        this.addMessageToChat(interpretation, 'assistant');
        
      } catch (error) {
        console.error('[ChatBox] Interpretation failed:', error);
        this.addMessageToChat(
          'Failed to generate interpretation. Please try again.',
          'assistant',
          true
        );
      }
    });
  }

  /**
   * Add system message to chat
   */
  addSystemMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `system-message system-${type}`;
    messageDiv.innerHTML = `
      <div class="system-message-content">
        <i class="fas fa-info-circle"></i>
        <span>${message}</span>
      </div>
    `;
    
    const messagesContainer = document.getElementById('chatMessages');
    if (messagesContainer) {
      messagesContainer.appendChild(messageDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }
}
```

### CSS for System Messages

Add to ChatBox styles:

```css
.system-message {
  margin: 8px 0;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 0.9rem;
  animation: slideIn 0.3s ease;
}

.system-message-content {
  display: flex;
  align-items: center;
  gap: 10px;
}

.system-message.system-info {
  background: #e3f2fd;
  border-left: 4px solid #2196f3;
  color: #0d47a1;
}

.system-message.system-success {
  background: #e8f5e9;
  border-left: 4px solid #4caf50;
  color: #1b5e20;
}

.system-message i {
  font-size: 1.1rem;
}
```

## Enhanced LLM Tool Calling Integration

### Automatic Tool Detection

When LLM returns analysis results, automatically route to appropriate analyzer:

```javascript
// In ChatManager after receiving LLM response
async handleLLMResponse(response) {
  // ... existing response handling ...
  
  // Check if response contains bioinformatics data
  const bioData = this.detectBioinformaticsData(response);
  
  if (bioData) {
    // Offer to visualize in appropriate analyzer
    this.offerAnalyzerVisualization(bioData);
  }
}

detectBioinformaticsData(response) {
  const patterns = {
    kegg: /KEGG|pathway|enrichment|ko\d{5}/i,
    go: /GO:\d{7}|gene ontology|biological process|molecular function/i,
    interpro: /IPR\d{6}|domain|protein family|pfam|smart/i
  };
  
  for (const [type, pattern] of Object.entries(patterns)) {
    if (pattern.test(response)) {
      return { type, data: this.extractData(response, type) };
    }
  }
  
  return null;
}

offerAnalyzerVisualization(bioData) {
  const button = document.createElement('button');
  button.className = 'analyzer-visualize-btn';
  button.innerHTML = `
    <i class="fas fa-chart-bar"></i>
    Visualize in ${this.getAnalyzerName(bioData.type)}
  `;
  button.onclick = () => this.sendToAnalyzer(bioData);
  
  // Add button to last message
  const lastMessage = document.querySelector('.assistant-message:last-child');
  if (lastMessage) {
    lastMessage.appendChild(button);
  }
}

sendToAnalyzer(bioData) {
  const { ipcRenderer } = require('electron');
  
  const toolMap = {
    kegg: 'kegg-analyzer',
    go: 'go-analyzer',
    interpro: 'interpro-analyzer'
  };
  
  ipcRenderer.send('send-to-analyzer', {
    toolName: toolMap[bioData.type],
    data: bioData.data,
    originalQuery: this.lastUserMessage
  });
}

getAnalyzerName(type) {
  const names = {
    kegg: 'KEGG Pathway Analyzer',
    go: 'GO Ontology Analyzer',
    interpro: 'InterPro Domain Analyzer'
  };
  return names[type] || 'Analyzer';
}
```

## User Workflow Examples

### Workflow 1: Analyzer → ChatBox → Interpretation

1. User opens KEGG Analyzer
2. Runs pathway enrichment analysis
3. Clicks "Analyze in ChatBox" on results
4. ChatBox receives request via IPC
5. Displays: "📊 Analysis request from KEGG Pathway Analysis"
6. Sends formatted query to LLM
7. LLM provides biological interpretation
8. User sees interpretation in ChatBox

### Workflow 2: ChatBox → Analyzer → Visualization

1. User asks ChatBox: "Analyze pathways for TP53, BRCA1, MYC"
2. LLM processes and returns pathway results
3. ChatBox detects KEGG data in response
4. Offers "Visualize in KEGG Pathway Analyzer" button
5. User clicks button
6. KEGG Analyzer window opens with results pre-loaded
7. User can explore interactive visualizations

### Workflow 3: Bidirectional Exploration

1. User runs GO enrichment in GO Analyzer
2. Sees interesting term, clicks "Ask ChatBox"
3. ChatBox receives specific question about term
4. LLM provides detailed explanation
5. User wants to explore related terms
6. Asks follow-up question in ChatBox
7. LLM suggests checking other namespaces
8. User returns to GO Analyzer with new insights

## Testing the Integration

### Test 1: Basic Communication

```javascript
// In browser console of analyzer tool
window.analyzer.sendToChatBox('Test query from analyzer', { test: true });

// Should see in ChatBox:
// "📊 Analysis request from KEGG Pathway Analysis"
// "Test query from analyzer"
```

### Test 2: LLM Interpretation Request

```javascript
// In analyzer tool
window.analyzer.requestLLMInterpretation({
  enrichedPathways: [{ name: 'Cell cycle', pValue: 0.001 }]
});

// Should see LLM interpretation appear in analyzer
```

### Test 3: Pending Data

```javascript
// In ChatBox
const { ipcRenderer } = require('electron');
ipcRenderer.send('send-to-analyzer', {
  toolName: 'kegg-analyzer',
  data: { enrichedPathways: [...] },
  originalQuery: 'Test query'
});

// KEGG Analyzer should open and display the data
```

## Error Handling

### Analyzer Side

```javascript
try {
  this.sendToChatBox(query, data);
} catch (error) {
  console.error('[Analyzer] Failed to send to ChatBox:', error);
  this.showStatus('Failed to communicate with ChatBox', 'error');
}
```

### ChatBox Side

```javascript
ipcRenderer.on('chatbox-analyze-request', (event, request) => {
  try {
    if (!request || !request.query) {
      throw new Error('Invalid request format');
    }
    this.sendMessageProgrammatically(request.query);
  } catch (error) {
    console.error('[ChatBox] Failed to process analyzer request:', error);
    this.addMessageToChat(
      'Failed to process analysis request from tool.',
      'assistant',
      true
    );
  }
});
```

## Best Practices

### 1. Query Formatting

Always format biological queries clearly:

```javascript
// Good
const query = `Analyze the biological significance of these enriched pathways:
- ${pathway1.name} (p=${pathway1.pValue})
- ${pathway2.name} (p=${pathway2.pValue})

What biological processes are highlighted?`;

// Bad
const query = `pathways: ${pathways.join(',')}`;
```

### 2. Data Structure

Keep analyzer data self-contained:

```javascript
const data = {
  toolName: 'KEGG Pathway Analysis',
  version: '1.0',
  timestamp: new Date().toISOString(),
  results: {
    enrichedPathways: [...],
    statistics: { ... },
    parameters: { ... }
  },
  metadata: {
    organism: 'hsa',
    geneCount: 10
  }
};
```

### 3. User Feedback

Always provide visual feedback:

```javascript
// Before sending
this.showStatus('Sending to ChatBox...', 'info');

// After success
this.showStatus('Analysis request sent to ChatBox', 'success');

// After failure
this.showStatus('Failed to send to ChatBox', 'error');
```

## Troubleshooting

### Issue: Analyzer doesn't receive ChatBox data

**Check**:
1. Is `window-ready` event firing?
2. Is tool name matching correctly?
3. Check browser console for errors

**Solution**:
```javascript
// Add debug logging
ipcRenderer.on('load-analysis-data', (event, data) => {
  console.log('[Debug] Received data:', data);
  this.loadAnalysisData(data);
});
```

### Issue: ChatBox not responding to analyzer requests

**Check**:
1. Is ChatBox initialized?
2. Are IPC handlers registered?
3. Is main window focused?

**Solution**:
```javascript
// Verify ChatBox is ready
if (window.chatManager && window.chatManager.isInitialized) {
  // Proceed with request
} else {
  console.warn('ChatBox not ready');
}
```

## Summary

This integration enables:

✅ **Seamless data flow** between analyzers and ChatBox
✅ **AI-powered interpretation** of biological results  
✅ **Contextual queries** with full analysis context
✅ **Visual exploration** of LLM-generated insights
✅ **Bidirectional workflows** for comprehensive analysis

The system is designed to be extensible - new analyzer tools can easily be added following the same pattern using `SharedAnalyzerBase`.
