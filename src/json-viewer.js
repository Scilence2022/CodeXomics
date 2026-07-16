'use strict';

(() => {
  const PAGE_SIZE = 100;
  const STRING_PREVIEW_LENGTH = 800;
  const SEARCH_BATCH_SIZE = 1200;
  const MAX_SEARCH_RESULTS = 500;

  const elements = {
    appShell: document.getElementById('appShell'),
    errorMessage: document.getElementById('errorMessage'),
    errorState: document.getElementById('errorState'),
    fileMetadata: document.getElementById('fileMetadata'),
    jsonTree: document.getElementById('jsonTree'),
    loadingState: document.getElementById('loadingState'),
    rawOutput: document.getElementById('rawOutput'),
    rawView: document.getElementById('rawView'),
    rawViewButton: document.getElementById('rawViewButton'),
    reportTitle: document.getElementById('reportTitle'),
    resetTreeButton: document.getElementById('resetTreeButton'),
    searchButton: document.getElementById('searchButton'),
    searchInput: document.getElementById('searchInput'),
    searchResults: document.getElementById('searchResults'),
    searchStatus: document.getElementById('searchStatus'),
    treeView: document.getElementById('treeView'),
    treeViewButton: document.getElementById('treeViewButton'),
  };

  const state = {
    activeView: 'tree',
    controllers: new Map(),
    data: null,
    highlightedElement: null,
    rawContent: '',
    rawMaterialized: false,
    searchToken: 0,
  };

  function createElement(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function formatBytes(value) {
    const size = Number(value);
    if (!Number.isFinite(size) || size < 0) return 'Unknown size';
    if (size < 1024) return `${size} B`;
    const units = ['KB', 'MB', 'GB'];
    let amount = size / 1024;
    let unitIndex = 0;
    while (amount >= 1024 && unitIndex < units.length - 1) {
      amount /= 1024;
      unitIndex += 1;
    }
    return `${amount.toFixed(amount >= 10 ? 1 : 2)} ${units[unitIndex]}`;
  }

  function isContainer(value) {
    return value !== null && typeof value === 'object';
  }

  function typeName(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  function pathKey(pathSegments) {
    return JSON.stringify(pathSegments);
  }

  function formatPath(pathSegments) {
    let output = '$';
    for (const segment of pathSegments) {
      if (typeof segment === 'number') {
        output += `[${segment}]`;
      } else if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment)) {
        output += `.${segment}`;
      } else {
        output += `[${JSON.stringify(segment)}]`;
      }
    }
    return output;
  }

  function getContainerDescriptor(value) {
    if (Array.isArray(value)) {
      return {
        count: value.length,
        getEntry(index) {
          return { segment: index, value: value[index] };
        },
        indexOf(segment) {
          const index = Number(segment);
          return Number.isInteger(index) && index >= 0 && index < value.length ? index : -1;
        },
        summary: `[${value.length} ${value.length === 1 ? 'item' : 'items'}]`,
      };
    }

    const keys = Object.keys(value);
    return {
      count: keys.length,
      getEntry(index) {
        const key = keys[index];
        return { segment: key, value: value[key] };
      },
      indexOf(segment) {
        return keys.indexOf(String(segment));
      },
      summary: `{${keys.length} ${keys.length === 1 ? 'property' : 'properties'}}`,
    };
  }

  function appendKey(row, key, isRoot) {
    const keyElement = createElement('span', isRoot ? 'json-root-key' : 'json-key');
    keyElement.textContent = isRoot ? '$' : typeof key === 'number' ? `[${key}]` : JSON.stringify(key);
    row.appendChild(keyElement);
    if (!isRoot) row.appendChild(createElement('span', 'json-separator', ':'));
  }

  function appendScalar(row, value) {
    const kind = typeName(value);
    const scalar = createElement('span', `json-${kind}`);

    if (kind !== 'string') {
      scalar.textContent = value === null ? 'null' : String(value);
      row.appendChild(scalar);
      return;
    }

    const isLong = value.length > STRING_PREVIEW_LENGTH;
    const previewValue = isLong ? `${value.slice(0, STRING_PREVIEW_LENGTH)}…` : value;
    scalar.textContent = JSON.stringify(previewValue);
    row.appendChild(scalar);

    if (!isLong) return;
    const toggle = createElement('button', 'string-toggle', 'Show full value');
    toggle.type = 'button';
    let expanded = false;
    toggle.addEventListener('click', () => {
      expanded = !expanded;
      scalar.textContent = JSON.stringify(expanded ? value : previewValue);
      toggle.textContent = expanded ? 'Show less' : 'Show full value';
    });
    row.appendChild(toggle);
  }

  function createPager(page, pageCount, setPage) {
    const pager = createElement('div', 'pager');
    const previous = createElement('button', '', 'Previous 100');
    previous.type = 'button';
    previous.disabled = page === 0;
    previous.addEventListener('click', () => setPage(page - 1));

    const status = createElement('span', '', `Page ${page + 1} of ${pageCount}`);

    const next = createElement('button', '', 'Next 100');
    next.type = 'button';
    next.disabled = page >= pageCount - 1;
    next.addEventListener('click', () => setPage(page + 1));

    pager.append(previous, status, next);
    return pager;
  }

  function createJsonNode(key, value, pathSegments, options = {}) {
    const isRoot = options.isRoot === true;
    const wrapper = createElement('div', 'json-node');
    const row = createElement('div', 'json-row');
    wrapper.appendChild(row);

    if (!isContainer(value)) {
      row.appendChild(createElement('span', 'json-spacer'));
      appendKey(row, key, isRoot);
      appendScalar(row, value);
      state.controllers.set(pathKey(pathSegments), { element: wrapper });
      return wrapper;
    }

    const descriptor = getContainerDescriptor(value);
    const toggle = createElement('button', 'json-toggle', '▸');
    toggle.type = 'button';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', `Expand ${formatPath(pathSegments)}`);
    row.appendChild(toggle);
    appendKey(row, key, isRoot);
    row.appendChild(createElement('span', 'json-summary', descriptor.summary));

    const children = createElement('div', 'json-children');
    children.hidden = true;
    wrapper.appendChild(children);

    let expanded = false;
    let currentPage = 0;
    let hasRendered = false;

    function renderPage() {
      const fragment = document.createDocumentFragment();
      const pageCount = Math.max(1, Math.ceil(descriptor.count / PAGE_SIZE));
      currentPage = Math.min(Math.max(currentPage, 0), pageCount - 1);
      const start = currentPage * PAGE_SIZE;
      const end = Math.min(start + PAGE_SIZE, descriptor.count);

      if (descriptor.count === 0) {
        fragment.appendChild(createElement('div', 'json-empty', 'Empty collection'));
      } else {
        for (let index = start; index < end; index += 1) {
          const entry = descriptor.getEntry(index);
          fragment.appendChild(createJsonNode(entry.segment, entry.value, [...pathSegments, entry.segment]));
        }
      }

      if (pageCount > 1) {
        fragment.appendChild(
          createPager(currentPage, pageCount, page => {
            currentPage = page;
            renderPage();
          })
        );
      }
      children.replaceChildren(fragment);
      hasRendered = true;
    }

    function ensureExpanded() {
      if (!hasRendered) renderPage();
      if (expanded) return;
      expanded = true;
      children.hidden = false;
      toggle.textContent = '▾';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', `Collapse ${formatPath(pathSegments)}`);
    }

    function collapse() {
      if (!expanded) return;
      expanded = false;
      children.hidden = true;
      toggle.textContent = '▸';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', `Expand ${formatPath(pathSegments)}`);
    }

    function showChild(segment) {
      ensureExpanded();
      const index = descriptor.indexOf(segment);
      if (index < 0) return null;
      const targetPage = Math.floor(index / PAGE_SIZE);
      if (targetPage !== currentPage) {
        currentPage = targetPage;
        renderPage();
      }
      return state.controllers.get(pathKey([...pathSegments, segment])) || null;
    }

    toggle.addEventListener('click', () => {
      if (expanded) collapse();
      else ensureExpanded();
    });

    const controller = { collapse, element: wrapper, ensureExpanded, showChild };
    state.controllers.set(pathKey(pathSegments), controller);
    if (isRoot && options.startExpanded !== false) ensureExpanded();
    return wrapper;
  }

  function renderTree(startExpanded = true) {
    state.controllers.clear();
    state.highlightedElement = null;
    elements.jsonTree.replaceChildren(createJsonNode('$', state.data, [], { isRoot: true, startExpanded }));
  }

  function setView(viewName) {
    const showRaw = viewName === 'raw';
    state.activeView = showRaw ? 'raw' : 'tree';
    elements.treeView.hidden = showRaw;
    elements.rawView.hidden = !showRaw;
    elements.treeViewButton.classList.toggle('active', !showRaw);
    elements.rawViewButton.classList.toggle('active', showRaw);
    elements.treeViewButton.setAttribute('aria-selected', String(!showRaw));
    elements.rawViewButton.setAttribute('aria-selected', String(showRaw));

    if (showRaw && !state.rawMaterialized) {
      elements.rawOutput.textContent = state.rawContent;
      state.rawMaterialized = true;
    }
  }

  function revealPath(pathSegments) {
    setView('tree');
    let controller = state.controllers.get(pathKey([]));
    controller?.ensureExpanded?.();

    for (const segment of pathSegments) {
      if (!controller?.showChild) return;
      controller = controller.showChild(segment);
      if (!controller) return;
    }

    if (state.highlightedElement) {
      state.highlightedElement.classList.remove('revealed');
    }
    state.highlightedElement = controller?.element || null;
    state.highlightedElement?.classList.add('revealed');
    state.highlightedElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function scalarSearchText(value) {
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
  }

  function createSearchFrame(value, pathSegments, keyLabel) {
    const container = isContainer(value) ? getContainerDescriptor(value) : null;
    return {
      container,
      entered: false,
      keyLabel,
      nextIndex: 0,
      pathSegments,
      value,
    };
  }

  function searchPreview(frame, queryLower, keyMatched) {
    const raw = isContainer(frame.value) ? frame.container.summary : scalarSearchText(frame.value);
    if (!raw) return keyMatched ? `Property name matches “${frame.keyLabel}”` : '';
    const lower = raw.toLocaleLowerCase();
    const matchIndex = lower.indexOf(queryLower);
    const start = matchIndex >= 0 ? Math.max(0, matchIndex - 90) : 0;
    const end = Math.min(raw.length, start + 260);
    const prefix = start > 0 ? '…' : '';
    const suffix = end < raw.length ? '…' : '';
    return `${prefix}${raw.slice(start, end)}${suffix}`;
  }

  function appendSearchResult(frame, queryLower, keyMatched) {
    const result = createElement('button', 'search-result');
    result.type = 'button';
    result.appendChild(createElement('span', 'search-result-path', formatPath(frame.pathSegments)));
    result.appendChild(
      createElement('span', 'search-result-preview', searchPreview(frame, queryLower, keyMatched) || 'Matching value')
    );
    result.addEventListener('click', () => revealPath(frame.pathSegments));
    elements.searchResults.appendChild(result);
  }

  function startSearch() {
    const query = elements.searchInput.value.trim();
    const token = state.searchToken + 1;
    state.searchToken = token;
    elements.searchResults.replaceChildren();

    if (!query) {
      elements.searchStatus.textContent = 'Enter a term to search the complete report.';
      elements.searchButton.disabled = false;
      return;
    }

    const queryLower = query.toLocaleLowerCase();
    const stack = [createSearchFrame(state.data, [], '$')];
    let matchCount = 0;
    let inspectedCount = 0;
    elements.searchButton.disabled = true;
    elements.searchStatus.textContent = `Searching for “${query}”…`;

    function processBatch() {
      if (token !== state.searchToken) return;
      let batchSteps = 0;

      while (stack.length > 0 && batchSteps < SEARCH_BATCH_SIZE && matchCount < MAX_SEARCH_RESULTS) {
        const frame = stack[stack.length - 1];
        batchSteps += 1;

        if (!frame.entered) {
          frame.entered = true;
          inspectedCount += 1;
          const keyMatched =
            frame.pathSegments.length > 0 && String(frame.keyLabel).toLocaleLowerCase().includes(queryLower);
          const scalarText = scalarSearchText(frame.value);
          const valueMatched = scalarText.length > 0 && scalarText.toLocaleLowerCase().includes(queryLower);
          if (keyMatched || valueMatched) {
            matchCount += 1;
            appendSearchResult(frame, queryLower, keyMatched);
          }
        }

        if (frame.container && frame.nextIndex < frame.container.count) {
          const entry = frame.container.getEntry(frame.nextIndex);
          frame.nextIndex += 1;
          stack.push(createSearchFrame(entry.value, [...frame.pathSegments, entry.segment], entry.segment));
        } else {
          stack.pop();
        }
      }

      if (stack.length > 0 && matchCount < MAX_SEARCH_RESULTS) {
        elements.searchStatus.textContent = `Searching… ${matchCount} matches found so far.`;
        window.setTimeout(processBatch, 0);
        return;
      }

      elements.searchButton.disabled = false;
      if (matchCount >= MAX_SEARCH_RESULTS) {
        elements.searchStatus.textContent = `Showing the first ${MAX_SEARCH_RESULTS} matches. Refine the search for more specific results.`;
      } else if (matchCount === 0) {
        elements.searchStatus.textContent = `No matches found after checking ${inspectedCount.toLocaleString()} values.`;
      } else {
        elements.searchStatus.textContent = `${matchCount.toLocaleString()} ${
          matchCount === 1 ? 'match' : 'matches'
        } found.`;
      }
    }

    window.setTimeout(processBatch, 0);
  }

  function addMetadataItem(text, className = '') {
    const item = createElement('span', `metadata-item ${className}`.trim(), text);
    elements.fileMetadata.appendChild(item);
  }

  function showError(error) {
    elements.loadingState.hidden = true;
    elements.appShell.hidden = true;
    elements.errorState.hidden = false;
    elements.errorMessage.textContent = error instanceof Error ? error.message : String(error);
  }

  function handleViewerData(payload) {
    try {
      if (!payload || typeof payload.content !== 'string' || payload.content.length === 0) {
        throw new Error('The archived report did not contain JSON data.');
      }

      state.rawContent = payload.content;
      state.data = JSON.parse(payload.content);
      state.rawMaterialized = false;
      elements.rawOutput.replaceChildren();

      const title = payload.title || payload.fileName || 'DGR research report';
      elements.reportTitle.textContent = title;
      document.title = `${title} — DGR JSON Viewer`;
      elements.fileMetadata.replaceChildren();
      addMetadataItem(payload.fileName || 'Archived JSON');
      addMetadataItem(formatBytes(payload.size));
      addMetadataItem(`Root: ${typeName(state.data)}`);
      if (payload.sha256) addMetadataItem(`SHA-256: ${payload.sha256}`, 'metadata-hash');

      renderTree(true);
      setView('tree');
      elements.loadingState.hidden = true;
      elements.errorState.hidden = true;
      elements.appShell.hidden = false;
    } catch (error) {
      showError(error);
    }
  }

  elements.treeViewButton.addEventListener('click', () => setView('tree'));
  elements.rawViewButton.addEventListener('click', () => setView('raw'));
  elements.resetTreeButton.addEventListener('click', () => {
    renderTree(true);
    setView('tree');
  });
  elements.searchButton.addEventListener('click', startSearch);
  elements.searchInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') startSearch();
    if (event.key === 'Escape') {
      state.searchToken += 1;
      elements.searchInput.value = '';
      elements.searchResults.replaceChildren();
      elements.searchStatus.textContent = 'Enter a term to search the complete report.';
      elements.searchButton.disabled = false;
    }
  });

  try {
    if (!window.dgrJsonViewer || typeof window.dgrJsonViewer.onData !== 'function') {
      throw new Error('The secure JSON viewer bridge is unavailable.');
    }
    window.dgrJsonViewer.onData(handleViewerData);
  } catch (error) {
    showError(error);
  }
})();
