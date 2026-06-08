// @ts-check
/**
 * UIService - Extracted from ChatManager
 */
class UIService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  showChatHistoryModal() {
    const history = this.chatManager.configManager.getChatHistory();

    if (history.length === 0) {
      this.chatManager.showNotification('📭 No chat history found', 'info');
      return;
    }

    // Remove existing modal if present
    const existingModal = document.getElementById('chatHistoryModal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal HTML
    const modal = document.createElement('div');
    modal.id = 'chatHistoryModal';
    modal.className = 'modal chat-history-modal show';

    // Group messages into conversations
    const conversations = this.chatManager.groupMessagesIntoConversations(history);

    let historyHTML = '';
    conversations.forEach((conversation, index) => {
      const startTime = new Date(conversation.startTime);
      const endTime = new Date(conversation.endTime);
      const duration = this.chatManager.formatDuration(endTime - startTime);

      // Get conversation preview (first user message or first 100 chars of first message)
      const firstUserMessage = conversation.messages.find(m => m.sender === 'user');
      const preview = firstUserMessage
        ? firstUserMessage.message.length > 80
          ? firstUserMessage.message.substring(0, 80) + '...'
          : firstUserMessage.message
        : conversation.messages[0].message.substring(0, 80) + '...';

      historyHTML += `
                <div class="conversation-item" onclick="chatManager.showConversationDetails(${index})">
                    <div class="conversation-header">
                        <div class="conversation-info">
                            <div class="conversation-title">
                                <i class="fas fa-comments"></i>
                                <span>Conversation ${conversations.length - index}</span>
                            </div>
                            <div class="conversation-stats">
                                <span class="message-count">${conversation.messages.length} messages</span>
                                <span class="conversation-duration">${duration}</span>
                            </div>
                        </div>
                        <div class="conversation-time">
                            <div class="start-time">${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString()}</div>
                        </div>
                    </div>
                    <div class="conversation-preview">${this.chatManager.formatMessage(preview)}</div>
                    <div class="conversation-actions">
                        <button onclick="event.stopPropagation(); chatManager.copyConversation(${index})" title="Copy conversation">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button onclick="event.stopPropagation(); chatManager.exportConversation(${index})" title="Export conversation">
                            <i class="fas fa-download"></i>
                        </button>
                        <button onclick="event.stopPropagation(); chatManager.deleteConversation(${index})" title="Delete conversation">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
    });

    modal.innerHTML = `
            <div class="modal-content chat-history-content">
                <div class="modal-header">
                    <h3>
                        <i class="fas fa-history"></i>
                        Chat History
                        <span class="total-messages">${conversations.length} conversations</span>
                    </h3>
                    <button class="modal-close" onclick="chatManager.closeChatHistoryModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body chat-history-body">
                    <div class="history-controls">
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.exportChatHistory('txt')">
                            <i class="fas fa-download"></i>
                            Export All TXT
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.exportChatHistory('json')">
                            <i class="fas fa-download"></i>
                            Export All JSON
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="chatManager.searchChatHistory()">
                            <i class="fas fa-search"></i>
                            Search
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="chatManager.confirmClearHistory()">
                            <i class="fas fa-trash"></i>
                            Clear All
                        </button>
                    </div>
                    <div class="history-content">
                        <div class="conversations-list">
                            ${historyHTML}
                        </div>
                    </div>
                </div>
            </div>
        `;

    // Add modal to page
    document.body.appendChild(modal);

    // Add escape key handler
    document.addEventListener('keydown', this.chatManager.handleHistoryModalKeydown.bind(this.chatManager));

    // Store conversations for later use
    this.chatManager.cachedConversations = conversations;
  }

  setupChatDragging() {
    const chatPanel = document.getElementById('llmChatPanel');
    const chatHeader = document.getElementById('chatHeader');
    const dockContainer = document.getElementById('chatDockContainer');
    const dockSplitter = document.getElementById('chatDockSplitter');
    let isDragging = false;
    let startX; let startY; let startLeft; let startTop;
    const dragThreshold = 5; // Minimum pixels to consider as drag
    let hasMoved = false;
    const dockIndicator = null;

    chatHeader.addEventListener('mousedown', e => {
      // Don't drag if clicking on buttons
      if (e.target.closest('button')) return;

      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(window.getComputedStyle(chatPanel).left, 10);
      startTop = parseInt(window.getComputedStyle(chatPanel).top, 10);

      chatPanel.classList.add('dragging');
      document.body.style.userSelect = 'none';

      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!isDragging) return;

      // Check if moved beyond threshold
      if (!hasMoved) {
        const deltaX = Math.abs(e.clientX - startX);
        const deltaY = Math.abs(e.clientY - startY);
        if (deltaX < dragThreshold && deltaY < dragThreshold) return;
        hasMoved = true;
      }

      if (!this.chatManager.isDocked) {
        // Floating mode: move the panel normally
        const newLeft = startLeft + e.clientX - startX;
        const newTop = startTop + e.clientY - startY;

        // Constrain to viewport
        const maxLeft = window.innerWidth - chatPanel.offsetWidth;
        const maxTop = window.innerHeight - chatPanel.offsetHeight;

        const constrainedLeft = Math.max(0, Math.min(newLeft, maxLeft));
        const constrainedTop = Math.max(0, Math.min(newTop, maxTop));

        chatPanel.style.left = constrainedLeft + 'px';
        chatPanel.style.top = constrainedTop + 'px';

        // Show dock indicator when dragging near the right edge
        const rightEdgeThreshold = window.innerWidth - 150;
        if (e.clientX > rightEdgeThreshold) {
          this.chatManager.showDockIndicator();
        } else {
          this.chatManager.hideDockIndicator();
        }
      } else {
        // Docked mode: auto-undock when dragged past threshold
        const dragDistance = startX - e.clientX; // Positive when dragging left
        const undockThreshold = 80; // Pixels to drag before auto-undock

        if (dragDistance > undockThreshold) {
          // Auto-trigger undock but maintain dragging state
          this.chatManager.hideUndockIndicator();

          // Perform undock
          this.chatManager.undockChat();

          // Re-calculate drag variables so dragging continues seamlessly in floating mode
          // 100px and 20px are center-offsets so the mouse is roughly on the title bar
          startLeft = Math.max(0, e.clientX - 100);
          startTop = Math.max(0, e.clientY - 20);
          startX = e.clientX;
          startY = e.clientY;

          chatPanel.style.left = startLeft + 'px';
          chatPanel.style.top = startTop + 'px';
        } else if (dragDistance > 30) {
          // Show indicator when getting close to threshold
          this.chatManager.showUndockIndicator();
        } else {
          this.chatManager.hideUndockIndicator();
        }
      }
    });

    document.addEventListener('mouseup', e => {
      if (!isDragging) return;

      isDragging = false;
      chatPanel.classList.remove('dragging');
      document.body.style.userSelect = '';
      this.chatManager.hideDockIndicator();
      this.chatManager.hideUndockIndicator();

      // Check for dock via drag-and-drop (undock is now handled in mousemove)
      if (hasMoved && !this.chatManager.isDocked) {
        // Check if dropped near right edge to dock
        const rightEdgeThreshold = window.innerWidth - 150;
        if (e.clientX > rightEdgeThreshold) {
          this.chatManager.dockChat();
          return;
        }
      }

      // Save position
      this.chatManager.saveChatPosition();
    });

    // Make header cursor indicate draggable
    chatHeader.style.cursor = 'move';
  }

  addAlphaFoldSidebarStyles() {
    // Check if styles already exist
    if (document.getElementById('alphafold-sidebar-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'alphafold-sidebar-styles';
    style.textContent = `
            .alphafold-results-sidebar {
                position: fixed;
                top: 0;
                right: -400px;
                width: 400px;
                height: 100vh;
                background: white;
                border-left: 1px solid #ddd;
                box-shadow: -2px 0 10px rgba(0,0,0,0.1);
                z-index: 1000;
                transition: right 0.3s ease;
                display: flex;
                flex-direction: column;
            }
            
            .alphafold-results-sidebar.visible {
                right: 0;
            }
            
            .sidebar-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #eee;
            }
            
            .sidebar-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            
            .sidebar-close {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 5px;
                border-radius: 3px;
                transition: background-color 0.2s;
            }
            
            .sidebar-close:hover {
                background-color: rgba(255,255,255,0.2);
            }
            
            .sidebar-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }
            
            .alphafold-result-item {
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                margin-bottom: 16px;
                padding: 16px;
                background: #fafbfc;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .alphafold-result-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .result-header {
                margin-bottom: 12px;
            }
            
            .protein-name {
                font-weight: 600;
                font-size: 14px;
                color: #2c3e50;
                margin-bottom: 4px;
            }
            
            .uniprot-id {
                font-family: monospace;
                font-size: 12px;
                color: #7f8c8d;
                background: #ecf0f1;
                padding: 2px 6px;
                border-radius: 3px;
                display: inline-block;
            }
            
            .result-details {
                margin-bottom: 16px;
            }
            
            .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                font-size: 12px;
            }
            
            .detail-row .label {
                font-weight: 500;
                color: #34495e;
            }
            
            .detail-row .value {
                color: #7f8c8d;
                text-align: right;
            }
            
            .detail-row .value.reviewed {
                color: #27ae60;
                font-weight: 500;
            }
            
            .detail-row .value.unreviewed {
                color: #e67e22;
            }
            
            .result-actions {
                display: flex;
                gap: 8px;
                flex-direction: column;
            }
            
            .result-actions .btn {
                padding: 8px 12px;
                border: none;
                border-radius: 5px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            
            .result-actions .btn-primary {
                background: #3498db;
                color: white;
            }
            
            .result-actions .btn-primary:hover {
                background: #2980b9;
                transform: translateY(-1px);
            }
            
            .result-actions .btn-secondary {
                background: #95a5a6;
                color: white;
            }
            
            .result-actions .btn-secondary:hover {
                background: #7f8c8d;
                transform: translateY(-1px);
            }
            
            .result-actions .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none !important;
            }
            
            @media (max-width: 768px) {
                .alphafold-results-sidebar {
                    width: 100vw;
                    right: -100vw;
                }
                
                .alphafold-results-sidebar.visible {
                    right: 0;
                }
            }
        `;

    document.head.appendChild(style);
  }

  addPDBSidebarStyles() {
    // Check if styles already exist
    if (document.getElementById('pdb-sidebar-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'pdb-sidebar-styles';
    style.textContent = `
            .pdb-results-sidebar {
                position: fixed;
                top: 0;
                left: -400px;
                width: 400px;
                height: 100vh;
                background: white;
                border-right: 1px solid #ddd;
                box-shadow: 2px 0 10px rgba(0,0,0,0.1);
                z-index: 1000;
                transition: left 0.3s ease;
                display: flex;
                flex-direction: column;
            }
            
            .pdb-results-sidebar.visible {
                left: 0;
            }
            
            .pdb-results-sidebar .sidebar-header {
                background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-bottom: 1px solid #eee;
            }
            
            .pdb-results-sidebar .sidebar-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            
            .pdb-results-sidebar .sidebar-close {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 5px;
                border-radius: 3px;
                transition: background-color 0.2s;
            }
            
            .pdb-results-sidebar .sidebar-close:hover {
                background-color: rgba(255,255,255,0.2);
            }
            
            .pdb-results-sidebar .sidebar-content {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
            }
            
            .pdb-result-item {
                border: 1px solid #e1e5e9;
                border-radius: 8px;
                margin-bottom: 16px;
                padding: 16px;
                background: #fdfefe;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .pdb-result-item:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .pdb-result-item .result-header {
                margin-bottom: 12px;
            }
            
            .pdb-result-item .pdb-title {
                font-weight: 600;
                font-size: 14px;
                color: #2c3e50;
                margin-bottom: 4px;
                line-height: 1.3;
            }
            
            .pdb-result-item .pdb-id {
                font-family: monospace;
                font-size: 12px;
                color: #e74c3c;
                background: #fdf2f2;
                padding: 2px 6px;
                border-radius: 3px;
                display: inline-block;
                font-weight: 600;
            }
            
            .pdb-result-item .result-details {
                margin-bottom: 16px;
            }
            
            .pdb-result-item .detail-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 6px;
                font-size: 12px;
            }
            
            .pdb-result-item .detail-row .label {
                font-weight: 500;
                color: #34495e;
            }
            
            .pdb-result-item .detail-row .value {
                color: #7f8c8d;
                text-align: right;
                max-width: 60%;
                word-wrap: break-word;
            }
            
            .pdb-result-item .result-actions {
                display: flex;
                gap: 8px;
                flex-direction: column;
            }
            
            .pdb-result-item .result-actions .btn {
                padding: 8px 12px;
                border: none;
                border-radius: 5px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            
            .pdb-result-item .result-actions .btn-primary {
                background: #e74c3c;
                color: white;
            }
            
            .pdb-result-item .result-actions .btn-primary:hover {
                background: #c0392b;
                transform: translateY(-1px);
            }
            
            .pdb-result-item .result-actions .btn-secondary {
                background: #95a5a6;
                color: white;
            }
            
            .pdb-result-item .result-actions .btn-secondary:hover {
                background: #7f8c8d;
                transform: translateY(-1px);
            }
            
            .pdb-result-item .result-actions .btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none !important;
            }
            
            @media (max-width: 768px) {
                .pdb-results-sidebar {
                    width: 100vw;
                    left: -100vw;
                }
                
                .pdb-results-sidebar.visible {
                    left: 0;
                }
            }
        `;

    document.head.appendChild(style);
  }

  async showMetabolicPathway(params) {
    try {
      const { pathwayName, highlightGenes = [], organism = 'generic' } = params;

      // Define pathway templates
      const pathwayTemplates = {
        glycolysis: {
          name: 'Glycolysis Pathway',
          description: 'Glucose metabolism pathway - converts glucose to pyruvate',
          genes: ['glk', 'pgi', 'pfkA', 'fbaA', 'tpiA', 'gapA', 'pgk', 'gpmA', 'eno', 'pykF'],
          enzymes: [
            'Glucokinase (glk)',
            'Glucose-6-phosphate isomerase (pgi)',
            'Phosphofructokinase (pfkA)',
            'Fructose-bisphosphate aldolase (fbaA)',
            'Triosephosphate isomerase (tpiA)',
            'Glyceraldehyde-3-phosphate dehydrogenase (gapA)',
            'Phosphoglycerate kinase (pgk)',
            'Phosphoglycerate mutase (gpmA)',
            'Enolase (eno)',
            'Pyruvate kinase (pykF)',
          ],
          metabolites: [
            'Glucose → Glucose-6-phosphate → Fructose-6-phosphate',
            'Fructose-1,6-bisphosphate → DHAP + G3P',
            'G3P → 1,3-BPG → 3-PG → 2-PG → PEP → Pyruvate',
          ],
        },
        tca_cycle: {
          name: 'TCA Cycle (Citric Acid Cycle)',
          description: 'Central metabolic pathway for energy production',
          genes: ['gltA', 'acnA', 'icdA', 'sucA', 'sucC', 'sdhA', 'fumA', 'mdh'],
          enzymes: [
            'Citrate synthase (gltA)',
            'Aconitase (acnA)',
            'Isocitrate dehydrogenase (icdA)',
            'α-Ketoglutarate dehydrogenase (sucA)',
            'Succinyl-CoA synthetase (sucC)',
            'Succinate dehydrogenase (sdhA)',
            'Fumarase (fumA)',
            'Malate dehydrogenase (mdh)',
          ],
          metabolites: [
            'Acetyl-CoA + Oxaloacetate → Citrate',
            'Citrate → Isocitrate → α-Ketoglutarate',
            'α-Ketoglutarate → Succinyl-CoA → Succinate',
            'Succinate → Fumarate → Malate → Oxaloacetate',
          ],
        },
        pentose_phosphate: {
          name: 'Pentose Phosphate Pathway',
          description: 'Alternative glucose oxidation pathway producing NADPH',
          genes: ['zwf', 'pgl', 'gnd', 'rpe', 'rpiA', 'tktA', 'talA'],
          enzymes: [
            'Glucose-6-phosphate dehydrogenase (zwf)',
            '6-phosphogluconolactonase (pgl)',
            '6-phosphogluconate dehydrogenase (gnd)',
            'Ribulose-phosphate 3-epimerase (rpe)',
            'Ribose-5-phosphate isomerase (rpiA)',
            'Transketolase (tktA)',
            'Transaldolase (talA)',
          ],
        },
      };

      const pathway =
        pathwayTemplates[pathwayName.toLowerCase()] ||
        pathwayTemplates[pathwayName.replace(/[\s-]/g, '_').toLowerCase()];

      if (!pathway) {
        return {
          success: false,
          error: `Pathway '${pathwayName}' not found. Available pathways: ${Object.keys(pathwayTemplates).join(', ')}`,
        };
      }

      // Search for pathway genes in the current genome
      const foundGenes = [];
      const searchPromises = pathway.genes.map(async gene => {
        try {
          const searchResult = await this.chatManager.executeMicrobeFunction('searchGeneByName', { name: gene });
          if (searchResult && searchResult.feature) {
            foundGenes.push({
              gene: gene,
              found: true,
              location: `${searchResult.chromosome}:${searchResult.feature.start}-${searchResult.feature.end}`,
              product: searchResult.feature.product || 'Unknown product',
            });
          } else {
            foundGenes.push({ gene: gene, found: false });
          }
        } catch (error) {
          foundGenes.push({ gene: gene, found: false, error: error.message });
        }
      });

      await Promise.all(searchPromises);

      // Generate pathway visualization
      const visualization = {
        pathwayName: pathway.name,
        description: pathway.description,
        totalGenes: pathway.genes.length,
        foundGenes: foundGenes.filter(g => g.found).length,
        geneDetails: foundGenes,
        enzymes: pathway.enzymes || [],
        metabolites: pathway.metabolites || [],
        highlightedGenes: highlightGenes,
        organism: organism,
      };

      // Show notification with pathway info
      this.chatManager.showNotification(
        `${pathway.name}: Found ${visualization.foundGenes}/${visualization.totalGenes} genes in current genome`,
        'info'
      );

      return {
        success: true,
        pathway: visualization,
        summary: `Pathway Analysis: ${pathway.name}`,
        details: `Found ${visualization.foundGenes} out of ${visualization.totalGenes} expected genes`,
        genes: foundGenes.filter(g => g.found),
      };
    } catch (error) {
      console.error('Error showing metabolic pathway:', error);
      this.chatManager.showNotification('❌ Error showing metabolic pathway', 'error');
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

window.UIService = UIService;
