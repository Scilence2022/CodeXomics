/**
 * ChatManager Module Index
 * 
 * This module provides a refactored, modular architecture for the ChatManager.
 * 
 * The original ChatManager.js was a 21,954-line God class that violated multiple
 * software engineering principles. This refactored version separates concerns
 * into specialized manager classes:
 * 
 * Architecture:
 * - ChatManagerRefactored: Main facade class that coordinates all functionality
 * - ChatUIManager: UI creation, event handling, positioning
 * - ChatHistoryManager: Message history, browsing, persistence
 * - ToolExecutionManager: Tool calling, execution, result formatting
 * - GenomicsToolManager: Genome analysis functions
 * - ProteinStructureManager: PDB/AlphaFold integration
 * - PrimerDesignManager: PCR/qPCR primer design
 * - ExportManager: Data export functionality
 * 
 * Usage:
 *   import { ChatManagerRefactored } from './ChatManager/index.js';
 *   const chatManager = new ChatManagerRefactored(app, configManager);
 */

// Export all manager classes
if (typeof ChatUIManager === 'undefined') {
  // Classes will be loaded via script tags in the HTML
  // This file serves as documentation and module boundary
}

// Main export
window.ChatManagerRefactored = ChatManagerRefactored;

// Individual manager exports (for advanced usage)
window.ChatManagerModules = {
  ChatUIManager,
  ChatHistoryManager,
  ToolExecutionManager,
  GenomicsToolManager,
  ProteinStructureManager,
  PrimerDesignManager,
  ExportManager
};
