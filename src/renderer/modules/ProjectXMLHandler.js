/**
 * ProjectXMLHandler - 处理Project XML文件格式的模块
 * 支持项目数据的XML序列化和反序列化
 */
class ProjectXMLHandler {
  constructor() {
    this.xmlNamespace = 'http://genomeexplorer.org/project/1.0';
    this.version = '1.0';
  }

  /**
   * 将项目数据转换为XML格式
   * @param {Object} project - 项目对象
   * @returns {string} XML字符串
   */
  projectToXML(project) {
    const doc = document.implementation.createDocument(this.xmlNamespace, 'GenomeExplorerProject', null);
    const root = doc.documentElement;

    // 设置XML属性
    root.setAttribute('version', this.version);
    root.setAttribute('created', new Date().toISOString());

    // 基本项目信息
    const projectInfo = doc.createElement('ProjectInfo');
    projectInfo.appendChild(this.createTextElement(doc, 'ID', project.id));
    projectInfo.appendChild(this.createTextElement(doc, 'Name', project.name));
    projectInfo.appendChild(this.createTextElement(doc, 'Description', project.description || ''));
    projectInfo.appendChild(this.createTextElement(doc, 'Location', project.location || ''));
    projectInfo.appendChild(this.createTextElement(doc, 'Created', project.created));
    projectInfo.appendChild(this.createTextElement(doc, 'Modified', project.modified));
    root.appendChild(projectInfo);

    // 项目设置
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

    // 文件夹结构
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

    // 文件列表
    const files = doc.createElement('Files');
    if (project.files) {
      project.files.forEach(file => {
        const fileEl = doc.createElement('File');

        // 基本文件信息
        fileEl.appendChild(this.createTextElement(doc, 'ID', file.id));
        fileEl.appendChild(this.createTextElement(doc, 'Name', file.name));
        fileEl.appendChild(this.createTextElement(doc, 'Path', file.path));
        fileEl.appendChild(this.createTextElement(doc, 'Type', file.type));
        fileEl.appendChild(this.createTextElement(doc, 'Size', file.size ? file.size.toString() : '0'));
        fileEl.appendChild(this.createTextElement(doc, 'Added', file.added));
        fileEl.appendChild(this.createTextElement(doc, 'Modified', file.modified || ''));

        // 文件夹路径
        if (file.folder) {
          const folderPathEl = doc.createElement('FolderPath');
          file.folder.forEach(pathSegment => {
            const segmentEl = doc.createElement('Segment');
            segmentEl.textContent = pathSegment;
            folderPathEl.appendChild(segmentEl);
          });
          fileEl.appendChild(folderPathEl);
        }

        // 文件元数据
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

        // 文件标签
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

    // 项目元数据和统计信息
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

      // 文件类型统计
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

    // 项目历史记录
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

    // 序列化为字符串
    const serializer = new XMLSerializer();
    let xmlString = serializer.serializeToString(doc);

    // 格式化XML（添加缩进）
    xmlString = this.formatXML(xmlString);

    return xmlString;
  }

  /**
   * 从XML字符串解析项目数据
   * @param {string} xmlString - XML字符串
   * @returns {Object} 项目对象
   */
  xmlToProject(xmlString) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlString, 'text/xml');

      // 检查解析错误
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        throw new Error('XML parsing error: ' + parseError.textContent);
      }

      const root = doc.documentElement;

      // 验证根元素
      if (root.tagName !== 'GenomeExplorerProject') {
        throw new Error('Invalid project file: root element must be GenomeExplorerProject');
      }

      const project = {};

      // 解析项目基本信息
      const projectInfo = root.querySelector('ProjectInfo');
      if (projectInfo) {
        project.id = this.getElementText(projectInfo, 'ID');
        project.name = this.getElementText(projectInfo, 'Name');
        project.description = this.getElementText(projectInfo, 'Description');
        project.location = this.getElementText(projectInfo, 'Location');
        project.created = this.getElementText(projectInfo, 'Created');
        project.modified = this.getElementText(projectInfo, 'Modified');
      }

      // 解析设置
      const settings = root.querySelector('Settings');
      project.settings = {};
      if (settings) {
        // 文件过滤器
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

        // 自定义注释
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

      // 解析文件夹结构
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

      // 解析文件列表
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

          // 解析文件夹路径
          const folderPathEl = fileEl.querySelector('FolderPath');
          if (folderPathEl) {
            folderPathEl.querySelectorAll('Segment').forEach(segment => {
              file.folder.push(segment.textContent);
            });
          }

          // 解析元数据
          const metadataEl = fileEl.querySelector('Metadata');
          if (metadataEl) {
            file.metadata = {};
            metadataEl.querySelectorAll('Meta').forEach(meta => {
              const key = meta.getAttribute('key');
              let value = meta.textContent;
              try {
                // 尝试解析JSON
                value = JSON.parse(value);
              } catch (e) {
                // 保持为字符串
              }
              file.metadata[key] = value;
            });
          }

          // 解析标签
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

      // 解析项目元数据
      const metadata = root.querySelector('ProjectMetadata');
      project.metadata = {};
      if (metadata) {
        project.metadata.totalFiles = parseInt(this.getElementText(metadata, 'TotalFiles')) || 0;
        project.metadata.totalSize = parseInt(this.getElementText(metadata, 'TotalSize')) || 0;
        project.metadata.lastOpened = this.getElementText(metadata, 'LastOpened');

        // 解析文件类型统计
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

      // 解析历史记录
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
   * 创建文本元素
   */
  createTextElement(doc, tagName, textContent) {
    const element = doc.createElement(tagName);
    element.textContent = textContent || '';
    return element;
  }

  /**
   * 获取元素文本内容
   */
  getElementText(parent, tagName) {
    const element = parent.querySelector(tagName);
    return element ? element.textContent : '';
  }

  /**
   * 格式化XML字符串（添加缩进）
   */
  formatXML(xmlString) {
    const PADDING = '  '; // 两个空格作为缩进
    const reg = /(>)(<)(\/*)/g;
    let formatted = xmlString.replace(reg, '$1\r\n$2$3');
    let pad = 0;

    return formatted
      .split('\r\n')
      .map(line => {
        let indent = 0;
        if (line.match(/.+<\/\w[^>]*>$/)) {
          indent = 0;
        } else if (line.match(/^<\/\w/) && pad > 0) {
          pad -= 1;
        } else if (line.match(/^<\w[^>]*[^\/]>.*$/)) {
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
   * 验证项目XML文件
   */
  validateProjectXML(xmlString) {
    try {
      const project = this.xmlToProject(xmlString);

      // 基本验证
      if (!project.id || !project.name) {
        return { valid: false, error: 'Project must have ID and name' };
      }

      // 验证文件ID唯一性
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
   * 生成项目XML模板
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

// 确保类在全局范围内可用
if (typeof window !== 'undefined') {
  window.ProjectXMLHandler = ProjectXMLHandler;
}
