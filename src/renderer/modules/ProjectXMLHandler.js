/**
 * ProjectXMLHandler - module that handles the Project XML file format
 * Supports XML serialization and deserialization of project data
 */
class ProjectXMLHandler {
  constructor() {
    this.xmlNamespace = 'http://genomeexplorer.org/project/1.0';
    this.version = '1.0';
  }

  /**
   * Convert project data to XML format
   * @param {Object} project - the project object
   * @returns {string} the XML string
   */
  projectToXML(project) {
    const doc = document.implementation.createDocument(this.xmlNamespace, 'GenomeExplorerProject', null);
    const root = doc.documentElement;

    // Set XML attributes
    root.setAttribute('version', this.version);
    root.setAttribute('created', new Date().toISOString());

    // Basic project info
    const projectInfo = doc.createElement('ProjectInfo');
    projectInfo.appendChild(this.createTextElement(doc, 'ID', project.id));
    projectInfo.appendChild(this.createTextElement(doc, 'Name', project.name));
    projectInfo.appendChild(this.createTextElement(doc, 'Description', project.description || ''));
    projectInfo.appendChild(this.createTextElement(doc, 'Location', project.location || ''));
    projectInfo.appendChild(this.createTextElement(doc, 'Created', project.created));
    projectInfo.appendChild(this.createTextElement(doc, 'Modified', project.modified));
    root.appendChild(projectInfo);

    // Project settings
    const settings = doc.createElement('Settings');
    if (project.settings) {
      if (project.settings.fileFilters) {
        const filters = doc.createElement('FileFilters');
        project.settings.fileFilters.forEach(filter => {
          const filterEl = doc.createElement('Filter');
          filterEl.setAttribute('type', filter.type || 'extension');
          filterEl.textContent = filter.value;
          filters.appendChild(filterEl);
        });
        settings.appendChild(filters);
      }

      if (project.settings.customAnnotations) {
        const annotations = doc.createElement('CustomAnnotations');
        project.settings.customAnnotations.forEach(annotation => {
          const annotEl = doc.createElement('Annotation');
          annotEl.setAttribute('key', annotation.key);
          annotEl.textContent = annotation.value;
          annotations.appendChild(annotEl);
        });
        settings.appendChild(annotations);
      }
    }
    root.appendChild(settings);

    // Folder structure
    const folders = doc.createElement('Folders');
    if (project.folders) {
      project.folders.forEach(folder => {
        const folderEl = doc.createElement('Folder');
        folderEl.appendChild(this.createTextElement(doc, 'Name', folder.name));
        folderEl.appendChild(this.createTextElement(doc, 'Icon', folder.icon || '📁'));

        const pathEl = doc.createElement('Path');
        folder.path.forEach(pathSegment => {
          const segmentEl = doc.createElement('Segment');
          segmentEl.textContent = pathSegment;
          pathEl.appendChild(segmentEl);
        });
        folderEl.appendChild(pathEl);

        folders.appendChild(folderEl);
      });
    }
    root.appendChild(folders);

    // File list
    const files = doc.createElement('Files');
    if (project.files) {
      project.files.forEach(file => {
        const fileEl = doc.createElement('File');

        // Basic file info
        fileEl.appendChild(this.createTextElement(doc, 'ID', file.id));
        fileEl.appendChild(this.createTextElement(doc, 'Name', file.name));
        fileEl.appendChild(this.createTextElement(doc, 'Path', file.path));
        fileEl.appendChild(this.createTextElement(doc, 'Type', file.type));
        fileEl.appendChild(this.createTextElement(doc, 'Size', file.size ? file.size.toString() : '0'));
        fileEl.appendChild(this.createTextElement(doc, 'Added', file.added));
        fileEl.appendChild(this.createTextElement(doc, 'Modified', file.modified || ''));

        // Folder path
        if (file.folder) {
          const folderPathEl = doc.createElement('FolderPath');
          file.folder.forEach(pathSegment => {
            const segmentEl = doc.createElement('Segment');
            segmentEl.textContent = pathSegment;
            folderPathEl.appendChild(segmentEl);
          });
          fileEl.appendChild(folderPathEl);
        }

        // File metadata
        if (file.metadata) {
          const metadataEl = doc.createElement('Metadata');
          Object.entries(file.metadata).forEach(([key, value]) => {
            const metaEl = doc.createElement('Meta');
            metaEl.setAttribute('key', key);
            metaEl.textContent = typeof value === 'object' ? JSON.stringify(value) : value;
            metadataEl.appendChild(metaEl);
          });
          fileEl.appendChild(metadataEl);
        }

        // File tags
        if (file.tags) {
          const tagsEl = doc.createElement('Tags');
          file.tags.forEach(tag => {
            const tagEl = doc.createElement('Tag');
            tagEl.textContent = tag;
            tagsEl.appendChild(tagEl);
          });
          fileEl.appendChild(tagsEl);
        }

        files.appendChild(fileEl);
      });
    }
    root.appendChild(files);

    // Project metadata and statistics
    const metadata = doc.createElement('ProjectMetadata');
    if (project.metadata) {
      metadata.appendChild(
        this.createTextElement(
          doc,
          'TotalFiles',
          project.metadata.totalFiles ? project.metadata.totalFiles.toString() : '0'
        )
      );
      metadata.appendChild(
        this.createTextElement(
          doc,
          'TotalSize',
          project.metadata.totalSize ? project.metadata.totalSize.toString() : '0'
        )
      );
      metadata.appendChild(this.createTextElement(doc, 'LastOpened', project.metadata.lastOpened || ''));

      // File-type statistics
      if (project.metadata.fileTypeStats) {
        const statsEl = doc.createElement('FileTypeStats');
        Object.entries(project.metadata.fileTypeStats).forEach(([type, count]) => {
          const statEl = doc.createElement('TypeStat');
          statEl.setAttribute('type', type);
          statEl.textContent = count.toString();
          statsEl.appendChild(statEl);
        });
        metadata.appendChild(statsEl);
      }
    }
    root.appendChild(metadata);

    // Project history
    const history = doc.createElement('History');
    if (project.history) {
      project.history.forEach(entry => {
        const entryEl = doc.createElement('Entry');
        entryEl.setAttribute('timestamp', entry.timestamp);
        entryEl.setAttribute('action', entry.action);
        entryEl.textContent = entry.description || '';
        history.appendChild(entryEl);
      });
    }
    root.appendChild(history);

    // Serialize to a string
    const serializer = new XMLSerializer();
    let xmlString = serializer.serializeToString(doc);

    // Format the XML (add indentation)
    xmlString = this.formatXML(xmlString);

    return xmlString;
  }

  /**
   * Parse project data from an XML string
   * @param {string} xmlString - the XML string
   * @returns {Object} the project object
   */
  xmlToProject(xmlString) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'text/xml');

      // Check for parsing errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        throw new Error('XML parsing error: ' + parseError.textContent);
      }

      const root = doc.documentElement;

      // Validate the root element
      if (root.tagName !== 'GenomeExplorerProject') {
        throw new Error('Invalid project file: root element must be GenomeExplorerProject');
      }

      const project = {};

      // Parse the basic project info
      const projectInfo = root.querySelector('ProjectInfo');
      if (projectInfo) {
        project.id = this.getElementText(projectInfo, 'ID');
        project.name = this.getElementText(projectInfo, 'Name');
        project.description = this.getElementText(projectInfo, 'Description');
        project.location = this.getElementText(projectInfo, 'Location');
        project.created = this.getElementText(projectInfo, 'Created');
        project.modified = this.getElementText(projectInfo, 'Modified');
      }

      // Parse the settings
      const settings = root.querySelector('Settings');
      project.settings = {};
      if (settings) {
        // File filters
        const fileFilters = settings.querySelector('FileFilters');
        if (fileFilters) {
          project.settings.fileFilters = [];
          fileFilters.querySelectorAll('Filter').forEach(filter => {
            project.settings.fileFilters.push({
              type: filter.getAttribute('type') || 'extension',
              value: filter.textContent,
            });
          });
        }

        // Custom annotations
        const customAnnotations = settings.querySelector('CustomAnnotations');
        if (customAnnotations) {
          project.settings.customAnnotations = [];
          customAnnotations.querySelectorAll('Annotation').forEach(annotation => {
            project.settings.customAnnotations.push({
              key: annotation.getAttribute('key'),
              value: annotation.textContent,
            });
          });
        }
      }

      // Parse the folder structure
      const folders = root.querySelector('Folders');
      project.folders = [];
      if (folders) {
        folders.querySelectorAll('Folder').forEach(folderEl => {
          const folder = {
            name: this.getElementText(folderEl, 'Name'),
            icon: this.getElementText(folderEl, 'Icon') || '📁',
            path: [],
          };

          const pathEl = folderEl.querySelector('Path');
          if (pathEl) {
            pathEl.querySelectorAll('Segment').forEach(segment => {
              folder.path.push(segment.textContent);
            });
          }

          project.folders.push(folder);
        });
      }

      // Parse the file list
      const files = root.querySelector('Files');
      project.files = [];
      if (files) {
        files.querySelectorAll('File').forEach(fileEl => {
          const file = {
            id: this.getElementText(fileEl, 'ID'),
            name: this.getElementText(fileEl, 'Name'),
            path: this.getElementText(fileEl, 'Path'),
            type: this.getElementText(fileEl, 'Type'),
            size: parseInt(this.getElementText(fileEl, 'Size')) || 0,
            added: this.getElementText(fileEl, 'Added'),
            modified: this.getElementText(fileEl, 'Modified'),
            folder: [],
          };

          // Parse the folder path
          const folderPathEl = fileEl.querySelector('FolderPath');
          if (folderPathEl) {
            folderPathEl.querySelectorAll('Segment').forEach(segment => {
              file.folder.push(segment.textContent);
            });
          }

          // Parse the metadata
          const metadataEl = fileEl.querySelector('Metadata');
          if (metadataEl) {
            file.metadata = {};
            metadataEl.querySelectorAll('Meta').forEach(meta => {
              const key = meta.getAttribute('key');
              let value = meta.textContent;
              try {
                // Try to parse JSON
                value = JSON.parse(value);
              } catch (e) {
                // Keep it as a string
              }
              file.metadata[key] = value;
            });
          }

          // Parse the tags
          const tagsEl = fileEl.querySelector('Tags');
          if (tagsEl) {
            file.tags = [];
            tagsEl.querySelectorAll('Tag').forEach(tag => {
              file.tags.push(tag.textContent);
            });
          }

          project.files.push(file);
        });
      }

      // Parse the project metadata
      const metadata = root.querySelector('ProjectMetadata');
      project.metadata = {};
      if (metadata) {
        project.metadata.totalFiles = parseInt(this.getElementText(metadata, 'TotalFiles')) || 0;
        project.metadata.totalSize = parseInt(this.getElementText(metadata, 'TotalSize')) || 0;
        project.metadata.lastOpened = this.getElementText(metadata, 'LastOpened');

        // Parse the file-type statistics
        const statsEl = metadata.querySelector('FileTypeStats');
        if (statsEl) {
          project.metadata.fileTypeStats = {};
          statsEl.querySelectorAll('TypeStat').forEach(stat => {
            const type = stat.getAttribute('type');
            const count = parseInt(stat.textContent) || 0;
            project.metadata.fileTypeStats[type] = count;
          });
        }
      }

      // Parse the history
      const history = root.querySelector('History');
      project.history = [];
      if (history) {
        history.querySelectorAll('Entry').forEach(entry => {
          project.history.push({
            timestamp: entry.getAttribute('timestamp'),
            action: entry.getAttribute('action'),
            description: entry.textContent,
          });
        });
      }

      return project;
    } catch (error) {
      console.error('Error parsing project XML:', error);
      throw error;
    }
  }

  /**
   * Create a text element
   */
  createTextElement(doc, tagName, textContent) {
    const element = doc.createElement(tagName);
    element.textContent = textContent || '';
    return element;
  }

  /**
   * Get the text content of an element
   */
  getElementText(parent, tagName) {
    const element = parent.querySelector(tagName);
    return element ? element.textContent : '';
  }

  /**
   * Format the XML string (add indentation)
   */
  formatXML(xmlString) {
    const PADDING = '  '; // two spaces for indentation
    const reg = /(>)(<)(\/*)/g;
    const formatted = xmlString.replace(reg, '$1\r\n$2$3');
    let pad = 0;

    return formatted
      .split('\r\n')
      .map(line => {
        let indent = 0;
        if (line.match(/.+<\/\w[^>]*>$/)) {
          indent = 0;
        } else if (line.match(/^<\/\w/) && pad > 0) {
          pad -= 1;
        } else if (line.match(/^<\w[^>]*[^/]>.*$/)) {
          indent = 1;
        } else {
          indent = 0;
        }

        const padding = PADDING.repeat(pad);
        pad += indent;

        return padding + line;
      })
      .join('\r\n');
  }

  /**
   * Validate the project XML file
   */
  validateProjectXML(xmlString) {
    try {
      const project = this.xmlToProject(xmlString);

      // Basic validation
      if (!project.id || !project.name) {
        return { valid: false, error: 'Project must have ID and name' };
      }

      // Validate that file IDs are unique
      const fileIds = new Set();
      for (const file of project.files || []) {
        if (fileIds.has(file.id)) {
          return { valid: false, error: `Duplicate file ID: ${file.id}` };
        }
        fileIds.add(file.id);
      }

      return { valid: true, project: project };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Generate a project XML template
   */
  generateProjectTemplate(name, description = '') {
    const project = {
      id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: name,
      description: description,
      location: '',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      files: [],
      folders: [
        { name: 'Genomes', icon: '🧬', path: ['genomes'] },
        { name: 'Annotations', icon: '📋', path: ['annotations'] },
        { name: 'Variants', icon: '🔄', path: ['variants'] },
        { name: 'Reads', icon: '📊', path: ['reads'] },
        { name: 'Analysis', icon: '📈', path: ['analysis'] },
      ],
      settings: {
        fileFilters: [],
        customAnnotations: [],
      },
      metadata: {
        totalFiles: 0,
        totalSize: 0,
        lastOpened: new Date().toISOString(),
        fileTypeStats: {},
      },
      history: [
        {
          timestamp: new Date().toISOString(),
          action: 'created',
          description: 'Project created',
        },
      ],
    };

    return this.projectToXML(project);
  }
}

// Ensure the class is available globally
if (typeof window !== 'undefined') {
  window.ProjectXMLHandler = ProjectXMLHandler;
}
