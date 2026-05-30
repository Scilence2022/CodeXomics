/**
 * Navigation Tools Module
 * Handles genome navigation, state management, and track control
 */

class NavigationTools {
  constructor(server) {
    this.server = server;
  }

  getTools() {
    return {
      navigate_to_position: {
        name: 'navigate_to_position',
        description:
          'Navigate to a specific genomic position. If only position is provided, defaults to 2000bp range centered on that position.',
        parameters: {
          type: 'object',
          properties: {
            chromosome: { type: 'string', description: 'Chromosome name' },
            start: { type: 'number', description: 'Start position (optional if position provided)' },
            end: { type: 'number', description: 'End position (optional if position provided)' },
            position: {
              type: 'number',
              description: 'Center position (creates 2000bp range if start/end not provided)',
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['chromosome'],
        },
      },

      open_new_tab: {
        name: 'open_new_tab',
        description:
          'Open a new tab window for parallel genome analysis. Can open tab for specific position, gene, or current state.',
        parameters: {
          type: 'object',
          properties: {
            chromosome: { type: 'string', description: 'Chromosome name (optional if geneName provided)' },
            start: { type: 'number', description: 'Start position (optional if position or geneName provided)' },
            end: { type: 'number', description: 'End position (optional if position or geneName provided)' },
            position: {
              type: 'number',
              description: 'Center position (creates 2000bp range if start/end not provided)',
            },
            geneName: { type: 'string', description: 'Gene name to open tab for (searches and focuses on gene)' },
            title: { type: 'string', description: 'Custom title for the new tab (optional)' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
        },
      },

      switch_to_tab: {
        name: 'switch_to_tab',
        description:
          'Switch to a specific tab by ID, name, or index. Use this to navigate between different analysis tabs.',
        parameters: {
          type: 'object',
          properties: {
            tab_id: { type: 'string', description: 'Specific tab ID to switch to (e.g. "tab1", "tab2")' },
            tab_name: { type: 'string', description: 'Tab name/title to search for and switch to' },
            tab_index: { type: 'number', description: 'Tab index (0-based) to switch to', minimum: 0 },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          anyOf: [{ required: ['tab_id'] }, { required: ['tab_name'] }, { required: ['tab_index'] }],
        },
      },

      close_tab: {
        name: 'close_tab',
        description:
          'Close a specific tab in the browser interface by tab ID, name, or index position. ' +
          'If no parameters are provided, the tool will close the currently active tab page. ' +
          'Cannot close the last remaining tab.',
        parameters: {
          type: 'object',
          properties: {
            tab_id: { type: 'string', description: 'Specific tab ID to close (e.g. "tab1", "tab2")' },
            tab_name: { type: 'string', description: 'Tab name/title to search for and close' },
            tab_index: { type: 'number', description: 'Tab index (0-based) to close', minimum: 0 },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
        },
      },

      search_features: {
        name: 'search_features',
        description:
          'Search for genomic features by ANNOTATION TEXT, FUNCTION KEYWORD, or FEATURE TYPE (e.g., find all tRNA, all kinase-related CDS, all transport proteins). This is a BROAD search across all feature types. Do NOT use this to look up a specific gene by its name — use find_gene_by_name or jump_to_gene instead.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Search query for annotation text, functional keyword, or feature type (NOT for specific gene names — use find_gene_by_name for that)',
            },
            featureType: {
              type: 'string',
              description: 'Type of feature to filter by (e.g., CDS, tRNA, rRNA, gene, promoter)',
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['query'],
        },
      },

      get_current_state: {
        name: 'get_current_state',
        description: 'Get current state of the CodeXomics',
        parameters: {
          type: 'object',
          properties: {
            clientId: { type: 'string', description: 'Browser client ID' },
          },
        },
      },

      jump_to_gene: {
        name: 'jump_to_gene',
        description: 'Jump directly to a gene location by name or locus tag',
        parameters: {
          type: 'object',
          properties: {
            geneName: { type: 'string', description: 'Gene name or locus tag to search for' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['geneName'],
        },
      },

      select_gene: {
        name: 'select_gene',
        description:
          'Select a specific gene by name or locus tag, highlighting it in the genome view and showing its details in the sidebar. This makes the gene the active selection for subsequent operations. Searches across all chromosomes by default.',
        parameters: {
          type: 'object',
          properties: {
            geneName: {
              type: 'string',
              description: 'Gene name or locus tag to select (e.g., "lacZ", "b0062", "dnaA")',
            },
            chromosome: {
              type: 'string',
              description: 'Chromosome name (optional, searches all chromosomes if not specified)',
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['geneName'],
        },
      },

      select_sequence_region: {
        name: 'select_sequence_region',
        description:
          'Select a specific sequence region by genomic coordinates (start-end position), highlighting it in the genome view. This makes the region the active selection for subsequent operations like copy, extract, or analysis.',
        parameters: {
          type: 'object',
          properties: {
            chromosome: { type: 'string', description: 'Chromosome name (optional, defaults to current chromosome)' },
            start: { type: 'number', description: 'Start position of the region to select (1-based)' },
            end: { type: 'number', description: 'End position of the region to select (1-based, inclusive)' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['start', 'end'],
        },
      },

      get_genome_info: {
        name: 'get_genome_info',
        description: 'Get comprehensive information about the loaded genome',
        parameters: {
          type: 'object',
          properties: {
            clientId: { type: 'string', description: 'Browser client ID' },
          },
        },
      },

      find_gene_by_name: {
        name: 'find_gene_by_name',
        description:
          'Search for a SPECIFIC GENE by its name or locus tag (e.g., lacZ, b0062, dnaA). Use this when you know the gene identifier. For searching by functional annotation or feature type (e.g., "all kinase genes", "all tRNA"), use search_features instead.',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description:
                "Specific gene name or locus tag (e.g., 'lacZ', 'b0062', 'dnaA'). NOT for functional keywords like 'kinase' or 'transport' — use search_features for those.",
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['name'],
        },
      },

      find_gene: {
        name: 'find_gene',
        description: 'Legacy alias for find_gene_by_name. Search for a SPECIFIC GENE by its name or locus tag.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Specific gene name or locus tag' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['name'],
        },
      },

      toggle_track: {
        name: 'toggle_track',
        description: 'Show or hide a specific track',
        parameters: {
          type: 'object',
          properties: {
            trackName: {
              type: 'string',
              description: 'Track name (genes, gc, variants, reads, proteins, primers, sequence, actions)',
            },
            track_name: {
              type: 'string',
              description:
                'Track name (alternative to trackName) (genes, gc, variants, reads, proteins, primers, sequence, actions)',
            },
            visible: { type: 'boolean', description: 'Whether to show or hide the track' },
            action: {
              type: 'string',
              description: 'Action to perform (show, hide, toggle, or common synonyms like on/off)',
              enum: ['show', 'hide', 'toggle', 'on', 'off', 'enable', 'disable', 'display', 'visible', 'hidden'],
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          anyOf: [
            { required: ['trackName', 'visible'] },
            { required: ['track_name', 'visible'] },
            { required: ['trackName', 'action'] },
            { required: ['track_name', 'action'] },
            { required: ['trackName'] },
            { required: ['track_name'] },
          ],
        },
      },

      zoom_in: {
        name: 'zoom_in',
        description: 'Zoom in the current genome view by a specified factor to see more sequence detail.',
        parameters: {
          type: 'object',
          properties: {
            factor: {
              type: 'number',
              description: 'Zoom factor to apply (default 2x, range 1.1–10)',
              default: 2,
              minimum: 1.1,
              maximum: 10,
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: [],
        },
      },

      zoom_out: {
        name: 'zoom_out',
        description: 'Zoom out the current genome view by a specified factor to see broader genomic context.',
        parameters: {
          type: 'object',
          properties: {
            factor: {
              type: 'number',
              description: 'Zoom factor to apply (default 2x, range 1.1–10)',
              default: 2,
              minimum: 1.1,
              maximum: 10,
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: [],
        },
      },

      pan_left: {
        name: 'pan_left',
        description: 'Pan the genome view to the left (towards earlier positions).',
        parameters: {
          type: 'object',
          properties: {
            amount: {
              type: 'number',
              description: 'Number of base pairs to pan left (default: 10% of current view width)',
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: [],
        },
      },

      pan_right: {
        name: 'pan_right',
        description: 'Pan the genome view to the right (towards later positions).',
        parameters: {
          type: 'object',
          properties: {
            amount: {
              type: 'number',
              description: 'Number of base pairs to pan right (default: 10% of current view width)',
            },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: [],
        },
      },

      save_view_state: {
        name: 'save_view_state',
        description:
          'Save the current genome browser view state (chromosome, position, visible tracks, track settings, active tab) for later restoration.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Descriptive name for the saved view state' },
            description: { type: 'string', description: 'Optional longer description', default: '' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['name'],
        },
      },

      bookmark_position: {
        name: 'bookmark_position',
        description: 'Bookmark the current genomic position for quick navigation later.',
        parameters: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name for the bookmark' },
            chromosome: { type: 'string', description: 'Chromosome (defaults to current)' },
            start: { type: 'number', description: 'Start position (defaults to current)' },
            end: { type: 'number', description: 'End position (defaults to current)' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['name'],
        },
      },

      get_bookmarks: {
        name: 'get_bookmarks',
        description: 'Get all saved bookmarks and view states.',
        parameters: {
          type: 'object',
          properties: {
            chromosome: { type: 'string', description: 'Filter bookmarks by chromosome (optional)' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
        },
      },
    };
  }

  async executeClientTool(toolName, parameters, clientId) {
    return await this.server.executeToolOnClient(toolName, parameters, clientId);
  }
}

module.exports = NavigationTools;
