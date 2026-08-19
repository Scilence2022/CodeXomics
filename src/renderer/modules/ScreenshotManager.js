/**
 * ScreenshotManager - Captures application and genome track screenshots.
 */
class ScreenshotManager {
  constructor(genomeBrowser) {
    this.genomeBrowser = genomeBrowser;
    this.defaultMaxPixels = 64000000;
  }

  async captureFullApplicationScreenshot(parameters = {}) {
    return this.captureScreenshot({
      ...parameters,
      target: 'full_application',
      mode: 'visible',
    });
  }

  async captureTracksScreenshot(parameters = {}) {
    return this.captureScreenshot({
      ...parameters,
      target: parameters.target || 'tracks',
      mode: parameters.mode || parameters.captureMode || 'full',
    });
  }

  async captureScreenshot(parameters = {}) {
    try {
      const target = this.normalizeTarget(parameters.target || parameters.scope || parameters.area);
      const mode = this.normalizeMode(parameters.mode || parameters.captureMode, target);
      const format = this.normalizeFormat(parameters.format || this.inferFormatFromOutputPath(parameters));
      const copyToClipboard = Boolean(parameters.copyToClipboard || parameters.copy_to_clipboard);
      const autoOpen = Boolean(
        parameters.autoOpen || parameters.auto_open || parameters.openAfterCapture || parameters.open_after_capture
      );
      const aiInitiated = Boolean(parameters.aiInitiated || parameters.ai_initiated || parameters.source === 'ai');
      const requestedTrackType = parameters.trackType || parameters.track_type;
      const quality = this.normalizeQuality(parameters.quality);
      const returnImageData = this.shouldReturnImageData(parameters);
      const maxImageBytes = parameters.maxImageBytes || parameters.max_image_bytes;
      if (target === 'track' && this.isAllTracksAlias(requestedTrackType)) {
        return await this.captureEachTrackScreenshot(this.withMultiTrackScreenshotDefaults(parameters), {
          target,
          mode,
          format,
          quality,
          scale: parameters.scale || parameters.scaleFactor || parameters.resolutionScale,
          background: parameters.background || parameters.backgroundColor || parameters.background_color,
          maxPixels: parameters.maxPixels || parameters.max_pixels,
          copyToClipboard,
          autoOpen,
          aiInitiated,
          returnImageData,
          maxImageBytes,
        });
      }
      const defaultFilename = this.buildDefaultFilename(target, mode, format, parameters);
      const filePath = this.resolveOutputPath(parameters, defaultFilename);
      const save = this.shouldSaveScreenshot(parameters, filePath, returnImageData);

      await this.waitForPaint();

      if (target === 'full_application') {
        return await this.captureNativeScreenshot({
          target,
          mode,
          format,
          quality,
          filePath,
          copyToClipboard,
          autoOpen,
          aiInitiated,
          defaultFilename,
          returnImageData,
          maxImageBytes,
          save,
        });
      }

      if (target === 'visible_tracks') {
        const element = this.getTracksElement();
        const rect = this.getVisibleCaptureRect(element);
        return await this.captureNativeScreenshot({
          target,
          mode,
          rect,
          format,
          quality,
          filePath,
          copyToClipboard,
          autoOpen,
          aiInitiated,
          defaultFilename,
          returnImageData,
          maxImageBytes,
          save,
        });
      }

      const element =
        target === 'track'
          ? await this.getTrackElementForCapture(requestedTrackType, parameters)
          : this.getTracksElement();
      return await this.captureElementScreenshot(element, {
        target,
        mode,
        format,
        quality,
        filePath,
        copyToClipboard,
        autoOpen,
        aiInitiated,
        defaultFilename,
        returnImageData,
        maxImageBytes,
        save,
        scale: parameters.scale || parameters.scaleFactor || parameters.resolutionScale,
        background: parameters.background || parameters.backgroundColor || parameters.background_color,
        maxPixels: parameters.maxPixels || parameters.max_pixels,
      });
    } catch (error) {
      console.error('[ScreenshotManager] Screenshot capture failed:', error);
      if (error.message === 'Screenshot capture was canceled') {
        return {
          success: false,
          canceled: true,
          error: error.message,
          tool: 'capture_screenshot',
        };
      }
      this.showNotification(`Screenshot failed: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message,
        tool: 'capture_screenshot',
      };
    }
  }

  normalizeTarget(target) {
    const normalized = String(target || 'full_application')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');

    if (['app', 'application', 'full_app', 'full_application', 'interface', 'window'].includes(normalized)) {
      return 'full_application';
    }

    if (['visible_tracks', 'visible_track', 'current_view', 'visible_view', 'viewer'].includes(normalized)) {
      return 'visible_tracks';
    }

    if (['all', 'all_tracks', 'tracks_all', 'track_all', 'tracks'].includes(normalized)) {
      return 'tracks';
    }

    if (['track', 'single_track', 'selected_track'].includes(normalized)) {
      return 'track';
    }

    return 'tracks';
  }

  isAllTracksAlias(trackType) {
    const normalized = String(trackType || '')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    return ['all', 'all_tracks', 'tracks', 'visible_tracks', '*'].includes(normalized);
  }

  normalizeMode(mode, target) {
    if (target === 'full_application') return 'visible';
    const normalized = String(mode || 'full')
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_');
    return ['visible', 'viewport'].includes(normalized) ? 'visible' : 'full';
  }

  normalizeFormat(format) {
    const normalized = String(format || 'png')
      .trim()
      .toLowerCase();
    return ['jpg', 'jpeg'].includes(normalized) ? 'jpeg' : 'png';
  }

  inferFormatFromOutputPath(parameters = {}) {
    const requestedPath =
      parameters.filePath ||
      parameters.file_path ||
      parameters.outputPath ||
      parameters.output_path ||
      parameters.savePath ||
      parameters.save_path ||
      parameters.filename ||
      parameters.fileName ||
      '';
    const extension = String(requestedPath).split('.').pop().toLowerCase();
    return ['jpg', 'jpeg'].includes(extension) ? 'jpeg' : 'png';
  }

  normalizeQuality(quality) {
    const numericQuality = Number(quality);
    if (!Number.isFinite(numericQuality)) return 92;
    return Math.max(1, Math.min(Math.trunc(numericQuality), 100));
  }

  getExtension(format) {
    return format === 'jpeg' ? 'jpg' : 'png';
  }

  getPathModule() {
    if (typeof window !== 'undefined' && window.path) {
      return window.path;
    }
    return {
      isAbsolute: filePath => /^([A-Za-z]:[\\/]|\/)/.test(String(filePath || '')),
      resolve: (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
    };
  }

  getCurrentWorkingDirectory() {
    if (this.genomeBrowser?.chatManager?.currentWorkingDirectory) {
      return this.genomeBrowser.chatManager.currentWorkingDirectory;
    }
    if (typeof window !== 'undefined' && window.chatManager?.currentWorkingDirectory) {
      return window.chatManager.currentWorkingDirectory;
    }
    return '/';
  }

  resolveOutputPath(parameters, defaultFilename) {
    const requestedPath = this.getRequestedOutputPath(parameters);

    if (!requestedPath && !(parameters.auto_save || parameters.autoSave)) {
      return null;
    }

    const pathToResolve = String(requestedPath || defaultFilename);
    if (!requestedPath && (parameters.auto_save || parameters.autoSave)) {
      return pathToResolve;
    }

    const pathModule = this.getPathModule();
    if (pathModule && typeof pathModule.isAbsolute === 'function' && pathModule.isAbsolute(pathToResolve)) {
      return pathToResolve;
    }

    const currentWorkingDirectory = this.getCurrentWorkingDirectory();
    if (this.isFallbackWorkingDirectory(currentWorkingDirectory)) {
      return pathToResolve;
    }

    if (pathModule && typeof pathModule.resolve === 'function') {
      return pathModule.resolve(currentWorkingDirectory, pathToResolve);
    }

    return `${currentWorkingDirectory.replace(/\/+$/g, '')}/${pathToResolve}`;
  }

  isFallbackWorkingDirectory(directory) {
    const normalized = String(directory || '')
      .trim()
      .replace(/\\/g, '/')
      .replace(/\/+$/g, '');
    return !normalized || normalized === '.';
  }

  getRequestedOutputPath(parameters = {}) {
    return (
      parameters.filePath ||
      parameters.file_path ||
      parameters.outputPath ||
      parameters.output_path ||
      parameters.savePath ||
      parameters.save_path ||
      parameters.filename ||
      parameters.fileName ||
      null
    );
  }

  hasOutputPath(parameters = {}) {
    return Boolean(this.getRequestedOutputPath(parameters));
  }

  shouldReturnImageData(parameters = {}) {
    return Boolean(
      parameters.returnImageData ||
      parameters.return_image_data ||
      parameters.includeImageData ||
      parameters.include_image_data ||
      parameters.embedImage ||
      parameters.embed_image
    );
  }

  shouldSaveScreenshot(parameters = {}, filePath = null, returnImageData = false) {
    if (parameters.save === false || parameters.saveFile === false) {
      return false;
    }
    if (filePath) {
      return true;
    }
    return !returnImageData;
  }

  withMultiTrackScreenshotDefaults(parameters = {}) {
    const screenshotParameters = { ...parameters };
    const hasAutoSaveSetting =
      screenshotParameters.auto_save !== undefined || screenshotParameters.autoSave !== undefined;
    const copyOnly = Boolean(screenshotParameters.copyToClipboard || screenshotParameters.copy_to_clipboard);
    const saveDisabled = screenshotParameters.save === false || screenshotParameters.saveFile === false;
    const returnsImageData = this.shouldReturnImageData(screenshotParameters);

    if (
      !this.hasOutputPath(screenshotParameters) &&
      !hasAutoSaveSetting &&
      !copyOnly &&
      !saveDisabled &&
      !returnsImageData
    ) {
      screenshotParameters.auto_save = true;
    }

    return screenshotParameters;
  }

  buildDefaultFilename(target, mode, format, parameters = {}) {
    const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+$/, '').replace('T', '-');
    const extension = this.getExtension(format);
    const regionPart = this.getRegionFilenamePart();
    const targetPart = target === 'full_application' ? 'full-application' : target.replace(/_/g, '-');
    const modePart = target === 'full_application' ? '' : `-${mode}`;
    const trackPart =
      target === 'track' && (parameters.trackType || parameters.track_type)
        ? `-${this.sanitizeFilenamePart(parameters.trackType || parameters.track_type)}`
        : '';
    return `codexomics-${targetPart}${modePart}${trackPart}-${regionPart}-${timestamp}.${extension}`;
  }

  getRegionFilenamePart() {
    const chromosome =
      this.genomeBrowser?.currentChromosome || document.getElementById('chromosomeSelect')?.value || 'view';
    const position = this.genomeBrowser?.currentPosition || {};
    if (Number.isFinite(position.start) && Number.isFinite(position.end)) {
      return this.sanitizeFilenamePart(`${chromosome}-${position.start + 1}-${position.end}`);
    }
    return this.sanitizeFilenamePart(chromosome);
  }

  sanitizeFilenamePart(value) {
    return (
      String(value || 'view')
        .replace(/[^A-Za-z0-9_.-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'view'
    );
  }

  getTracksElement() {
    const element = document.getElementById('genomeViewer');
    if (!element) {
      throw new Error('Genome viewer element was not found');
    }
    if (!element.children || element.children.length === 0) {
      throw new Error('No rendered tracks are available to capture');
    }
    return element;
  }

  getTrackElement(trackType) {
    if (!trackType) {
      throw new Error('trackType is required when target is "track"');
    }

    const normalized = this.resolveTrackTypeAlias(trackType);

    if (normalized === 'sequence') {
      const sequenceElement = this.getBottomSequenceTrackElement();
      if (sequenceElement) return sequenceElement;
    }

    const escaped = this.escapeCssIdentifier(normalized);
    const className = this.getTrackClassName(normalized);
    const selectors = [
      `[data-track-type="${escaped}"]`,
      className ? `.${className}` : null,
      `.${escaped}-track`,
    ].filter(Boolean);

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return this.getPreferredTrackCaptureElement(normalized, element);
    }

    throw new Error(`Track "${trackType}" was not found in the current view`);
  }

  async getTrackElementForCapture(trackType, parameters = {}) {
    const normalized = this.resolveTrackTypeAlias(trackType);
    const element = this.getTrackElement(trackType);

    if (normalized !== 'reads') {
      return element;
    }

    const readsTrack = this.getTrackContainerElement(normalized) || element.closest?.('.reads-track') || element;
    return await this.waitForReadsTrackCaptureElement(readsTrack, parameters);
  }

  getTrackContainerElement(trackType) {
    const normalized = this.resolveTrackTypeAlias(trackType);
    const escaped = this.escapeCssIdentifier(normalized);
    const className = this.getTrackClassName(normalized);
    const selectors =
      normalized === 'reads'
        ? [className ? `.${className}` : null, `[data-track-type="${escaped}"]`, `.${escaped}-track`]
        : [`[data-track-type="${escaped}"]`, className ? `.${className}` : null, `.${escaped}-track`];

    for (const selector of selectors.filter(Boolean)) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    return null;
  }

  resolveTrackTypeAlias(trackType) {
    const raw = String(trackType || '').trim();
    const compact = raw.toLowerCase().replace(/[\s_-]+/g, '');
    const aliases = {
      bottomsequence: 'sequence',
      bottomsequencepanel: 'sequence',
      sequencetrack: 'sequence',
      sequenceline: 'sequenceLine',
      singlelinesequence: 'sequenceLine',
      singlelinesequencetrack: 'sequenceLine',
      gccontent: 'gc',
      gcskew: 'gc',
      wig: 'wigTracks',
      wigtrack: 'wigTracks',
      wigtracks: 'wigTracks',
    };

    return aliases[compact] || raw;
  }

  getBottomSequenceTrackElement() {
    const sequenceSection = document.getElementById('sequenceDisplaySection');
    if (sequenceSection && this.isElementVisible(sequenceSection)) {
      return sequenceSection;
    }
    return null;
  }

  getCapturableTrackElements() {
    const tracksElement = document.getElementById('genomeViewer');
    const browserContainer = tracksElement?.querySelector('.genome-browser-container') || tracksElement;
    const descriptors = [];
    const seen = new Set();

    const addTrack = (type, element, label = null) => {
      if (!type || !element || seen.has(element)) return;
      const captureElement = this.getPreferredTrackCaptureElement(type, element);
      const normalizedType = this.resolveTrackTypeAlias(type);
      const isCapturable =
        normalizedType === 'reads'
          ? this.isElementVisible(element) || this.isDrawableElement(captureElement)
          : this.isElementVisible(captureElement);
      if (!isCapturable) return;
      seen.add(element);
      descriptors.push({
        type,
        label: label || this.getTrackLabel(element) || type,
        element: normalizedType === 'reads' ? element : captureElement,
      });
    };

    if (browserContainer) {
      Array.from(browserContainer.children || []).forEach(child => {
        const trackType = this.getTrackTypeFromElement(child);
        if (trackType) {
          addTrack(trackType, child);
          return;
        }

        child.querySelectorAll('[data-track-type], .reads-track').forEach(trackElement => {
          const nestedTrackType = this.getTrackTypeFromElement(trackElement);
          if (nestedTrackType) {
            addTrack(nestedTrackType, trackElement);
          }
        });
      });

      if (descriptors.length === 0) {
        browserContainer.querySelectorAll('[data-track-type]').forEach(element => {
          addTrack(element.dataset.trackType, element);
        });
      }
    }

    const bottomSequenceElement = this.getBottomSequenceTrackElement();
    if (bottomSequenceElement) {
      addTrack('sequence', bottomSequenceElement, 'Bottom Sequence Panel');
    }

    return descriptors;
  }

  getTrackTypeFromElement(element) {
    if (!element) return null;
    if (element.dataset?.trackType) return element.dataset.trackType;

    const classMap = {
      'gene-track': 'genes',
      'gc-track': 'gc',
      'variant-track': 'variants',
      'reads-track': 'reads',
      'wig-track': 'wigTracks',
      'protein-track': 'proteins',
      'primer-track': 'primers',
      'sequence-line-track': 'sequenceLine',
      'actions-track': 'actions',
      'blast-track': 'blast',
    };

    for (const [className, trackType] of Object.entries(classMap)) {
      if (element.classList?.contains(className)) {
        return trackType;
      }
    }

    return null;
  }

  getPreferredTrackCaptureElement(trackType, element) {
    const normalized = this.resolveTrackTypeAlias(trackType);
    if (normalized === 'reads') {
      return this.getReadsTrackDrawingElement(element) || element;
    }
    return element;
  }

  getReadsTrackDrawingElement(readsTrack) {
    const selectors = [
      '.reads-canvas',
      '.reads-content-viewport canvas',
      '.reads-svg-container',
      '.reads-content-viewport svg',
      '.coverage-visualization',
      '.reference-sequence-visualization',
      '.track-content canvas',
      '.track-content svg',
    ];

    for (const selector of selectors) {
      const candidate = readsTrack.matches?.(selector) ? readsTrack : readsTrack.querySelector(selector);
      this.prepareReadsCaptureElement(candidate);
      if (candidate && this.isDrawableElement(candidate)) {
        return candidate;
      }
    }

    const trackContent = readsTrack.matches?.('.track-content')
      ? readsTrack
      : readsTrack.querySelector('.track-content');
    if (this.hasMeaningfulReadsContent(trackContent)) {
      return trackContent;
    }

    return null;
  }

  async waitForReadsTrackCaptureElement(readsTrack, parameters = {}) {
    const attempts = this.getReadsTrackRenderWaitAttempts(parameters);

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const drawingElement = this.getReadsTrackDrawingElement(readsTrack);
      if (drawingElement && this.isDrawableElement(drawingElement)) {
        return drawingElement;
      }

      await this.waitForPaint();
    }

    const fallbackContent = readsTrack.querySelector?.('.track-content');
    if (this.hasMeaningfulReadsContent(fallbackContent)) {
      return fallbackContent;
    }

    throw new Error('Reads track rendering is not ready for screenshot capture');
  }

  getReadsTrackRenderWaitAttempts(parameters = {}) {
    const requestedMs =
      parameters.renderWaitMs ||
      parameters.render_wait_ms ||
      parameters.renderTimeoutMs ||
      parameters.render_timeout_ms ||
      5000;
    const timeoutMs = Math.max(250, Math.min(Number(requestedMs) || 5000, 15000));
    return Math.max(3, Math.ceil(timeoutMs / 50));
  }

  hasMeaningfulReadsContent(element) {
    if (!element || !this.isDrawableElement(element)) return false;
    return Boolean(
      element.querySelector?.(
        [
          '.reads-canvas',
          '.reads-svg-container',
          '.reads-content-viewport canvas',
          '.reads-content-viewport svg',
          '.coverage-visualization',
          '.reference-sequence-visualization',
          '.no-reads-message',
          '.reads-error-message',
          '.reads-track-stats',
          '.reads-stats',
        ].join(', ')
      )
    );
  }

  prepareReadsCaptureElement(element) {
    if (typeof HTMLCanvasElement === 'undefined' || !(element instanceof HTMLCanvasElement)) {
      return;
    }

    const renderer = this.findCanvasRendererForCanvas(element);
    if (!renderer) return;

    try {
      if (typeof renderer.setupCanvas === 'function') {
        renderer.setupCanvas();
      }
      if (typeof renderer.render === 'function') {
        renderer.render();
      }
    } catch (error) {
      console.warn('[ScreenshotManager] Failed to prepare reads canvas for screenshot:', error);
    }
  }

  findCanvasRendererForCanvas(canvas) {
    const renderers = [];
    if (this.genomeBrowser?.trackRenderer?.canvasRenderers) {
      renderers.push(...this.genomeBrowser.trackRenderer.canvasRenderers.values());
    }
    if (typeof window !== 'undefined' && Array.isArray(window.canvasReadsRenderers)) {
      renderers.push(...window.canvasReadsRenderers);
    }

    return renderers.find(renderer => renderer?.canvas === canvas) || null;
  }

  isDrawableElement(element) {
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    const hasLayoutSize = rect.width > 0 && rect.height > 0;
    const hasCanvasSize =
      typeof HTMLCanvasElement !== 'undefined' &&
      element instanceof HTMLCanvasElement &&
      Number(element.width) > 0 &&
      Number(element.height) > 0;
    if (!hasLayoutSize && !hasCanvasSize) {
      return false;
    }

    const computed = window.getComputedStyle(element);
    return computed.display !== 'none' && computed.visibility !== 'hidden';
  }

  getTrackLabel(element) {
    return (
      element.querySelector('.track-title')?.textContent?.trim() ||
      element.querySelector('.sequence-header h4')?.textContent?.trim() ||
      null
    );
  }

  isElementVisible(element) {
    if (!element) return false;
    const computed = window.getComputedStyle(element);
    if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  getTrackClassName(trackType) {
    const normalized = String(trackType || '').trim();
    const config = this.genomeBrowser?.trackRenderer?.trackConfig?.[normalized];
    if (config?.className) return config.className;

    const fallback = {
      genes: 'gene-track',
      gene: 'gene-track',
      gc: 'gc-track',
      sequence: 'sequence-track',
      sequenceLine: 'sequence-line-track',
      sequenceline: 'sequence-line-track',
      reads: 'reads-track',
      variants: 'variant-track',
      wig: 'wig-track',
      wigTracks: 'wig-track',
      primers: 'primer-track',
      proteins: 'protein-track',
      actions: 'actions-track',
      blast: 'blast-track',
    };
    return fallback[normalized] || fallback[normalized.toLowerCase()] || null;
  }

  escapeCssIdentifier(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(value);
    }
    return String(value).replace(/["\\]/g, '\\$&');
  }

  getVisibleCaptureRect(element) {
    const rect = element.getBoundingClientRect();
    const left = Math.max(0, Math.floor(rect.left));
    const top = Math.max(0, Math.floor(rect.top));
    const right = Math.min(window.innerWidth, Math.ceil(rect.right));
    const bottom = Math.min(window.innerHeight, Math.ceil(rect.bottom));
    const width = right - left;
    const height = bottom - top;

    if (width < 1 || height < 1) {
      throw new Error('Target screenshot area is outside the visible window');
    }

    return { x: left, y: top, width, height };
  }

  async captureNativeScreenshot(options) {
    const result = await this.invokeCapture({
      target: options.target,
      mode: options.mode,
      rect: options.rect,
      format: options.format,
      quality: options.quality,
      filePath: options.filePath,
      copyToClipboard: options.copyToClipboard,
      autoOpen: options.autoOpen,
      aiInitiated: options.aiInitiated,
      returnImageData: options.returnImageData,
      maxImageBytes: options.maxImageBytes,
      defaultFilename: options.defaultFilename,
      title: this.getDialogTitle(options.target),
      save: options.save !== undefined ? options.save : true,
    });

    return this.formatResult(result, options.target, options.mode, {
      notify: options.notify,
      fallback: options.fallback,
    });
  }

  async saveRenderedScreenshot(options) {
    const result = await this.invokeCapture({
      target: options.target,
      mode: options.mode,
      imageDataUrl: options.imageDataUrl,
      format: options.format,
      quality: options.quality,
      filePath: options.filePath,
      copyToClipboard: options.copyToClipboard,
      autoOpen: options.autoOpen,
      aiInitiated: options.aiInitiated,
      returnImageData: options.returnImageData,
      maxImageBytes: options.maxImageBytes,
      defaultFilename: options.defaultFilename,
      title: this.getDialogTitle(options.target),
      save: options.save !== undefined ? options.save : true,
    });

    return this.formatResult(result, options.target, options.mode, { notify: options.notify });
  }

  async invokeCapture(options) {
    if (!window.electronAPI?.captureScreenshot) {
      throw new Error('electronAPI.captureScreenshot is unavailable');
    }
    const result = await window.electronAPI.captureScreenshot(options);
    if (!result?.success) {
      if (result?.canceled) {
        throw new Error('Screenshot capture was canceled');
      }
      throw new Error(result?.error || 'Screenshot capture failed');
    }
    return result;
  }

  formatResult(result, target, mode, options = {}) {
    const destination = this.getScreenshotResultMessage(result);
    if (options.notify !== false) {
      this.showNotification(destination, 'success');
    }
    // A native fallback can only reach the on-screen part of the element, so report the mode
    // that was actually captured instead of the one that was requested.
    const fallback = options.fallback || null;
    const capturedMode = fallback === 'native_visible' ? 'visible' : mode;
    return {
      success: true,
      tool: 'capture_screenshot',
      message: destination,
      target,
      mode: capturedMode,
      requestedMode: mode,
      fallback,
      warning:
        fallback === 'native_visible' && mode === 'full'
          ? 'Full composition was blocked, so only the visible part of the target was captured.'
          : undefined,
      filePath: result.filePath || null,
      fileName: result.fileName || null,
      fileSize: result.fileSize || 0,
      format: result.format || 'png',
      mimeType: result.mimeType || (result.format === 'jpeg' ? 'image/jpeg' : 'image/png'),
      width: result.width,
      height: result.height,
      imageSizeBytes: result.imageSizeBytes || 0,
      imageData: result.imageData || undefined,
      imageDataEncoding: result.imageDataEncoding || undefined,
      maxImageBytes: result.maxImageBytes || undefined,
      copiedToClipboard: !!result.copiedToClipboard,
      opened: !!result.opened,
    };
  }

  getScreenshotResultMessage(result = {}) {
    if (result.filePath) {
      return `Saved screenshot to ${result.filePath}`;
    }
    if (result.copiedToClipboard) {
      return 'Screenshot copied to clipboard';
    }
    if (result.imageData) {
      return 'Captured screenshot image data';
    }
    return 'Screenshot captured';
  }

  getDialogTitle(target) {
    if (target === 'full_application') return 'Save Full Application Screenshot';
    if (target === 'track') return 'Save Track Screenshot';
    return 'Save Tracks Screenshot';
  }

  async renderElementToDataUrl(element, options) {
    if (typeof HTMLCanvasElement !== 'undefined' && element instanceof HTMLCanvasElement) {
      return this.renderCanvasToDataUrl(element, options);
    }

    const rect = element.getBoundingClientRect();
    const width = Math.max(1, Math.ceil(options.mode === 'full' ? element.scrollWidth || rect.width : rect.width));
    const height = Math.max(1, Math.ceil(options.mode === 'full' ? element.scrollHeight || rect.height : rect.height));
    const scale = this.normalizeScale(options.scale);
    const maxPixels = this.normalizeMaxPixels(options.maxPixels);
    const totalPixels = width * height * scale * scale;

    if (totalPixels > maxPixels) {
      throw new Error(
        `Screenshot is too large (${Math.round(totalPixels).toLocaleString()} pixels). Lower scale or capture visible tracks only.`
      );
    }

    const clone = element.cloneNode(true);
    const canvasCopyResult = this.replaceCanvasWithImages(element, clone);
    if (canvasCopyResult.failed > 0) {
      throw new Error('Could not copy canvas into screenshot');
    }
    await this.embedFontFaces(this.inlineComputedStyles(element, clone), clone);
    clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    clone.style.width = `${width}px`;
    clone.style.height = `${height}px`;
    clone.style.minHeight = `${height}px`;
    clone.style.overflow = options.mode === 'full' ? 'visible' : 'hidden';
    clone.style.margin = '0';

    const background = options.background || this.getElementBackground(element, options.format);
    const serialized = new XMLSerializer().serializeToString(clone);
    const svgMarkup = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      `<foreignObject x="0" y="0" width="${width}" height="${height}">`,
      serialized,
      '</foreignObject>',
      '</svg>',
    ].join('');

    const image = await this.loadSvgImage(svgMarkup);
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL(
      `image/${options.format}`,
      options.format === 'jpeg' ? this.normalizeQuality(options.quality) / 100 : undefined
    );
  }

  /**
   * An SVG rendered as an image cannot load external resources, so web fonts have to travel
   * with the markup. Only the faces actually used by the captured subtree are embedded.
   */
  async embedFontFaces(families, clone) {
    try {
      if (!families || families.size === 0) return;

      const blocks = [];
      for (const rule of this.findFontFaceRules(families)) {
        const block = await this.buildEmbeddedFontFaceCss(rule);
        if (block) blocks.push(block);
      }
      if (blocks.length === 0) return;

      const style = document.createElement('style');
      style.setAttribute('style', 'display:none;'); // Never let the rules take part in the layout.
      style.textContent = blocks.join('\n');
      clone.insertBefore(style, clone.firstChild);
    } catch (error) {
      console.warn('[ScreenshotManager] Could not embed fonts into screenshot:', error);
    }
  }

  collectFontFamilies(computed, families) {
    const value = computed?.getPropertyValue?.('font-family');
    if (!value || !families) return;

    for (const family of value.split(',')) {
      const normalized = this.normalizeFontFamily(family);
      if (normalized) families.add(normalized);
    }
  }

  normalizeFontFamily(family) {
    return String(family || '')
      .trim()
      .replace(/^["']|["']$/g, '')
      .toLowerCase();
  }

  findFontFaceRules(families) {
    const rules = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let sheetRules;
      try {
        sheetRules = sheet.cssRules;
      } catch {
        continue; // Cross-origin stylesheet; its faces are not readable.
      }
      for (const rule of Array.from(sheetRules || [])) {
        if (typeof CSSFontFaceRule === 'undefined' || !(rule instanceof CSSFontFaceRule)) continue;
        if (!families.has(this.normalizeFontFamily(rule.style.getPropertyValue('font-family')))) continue;
        if (!this.isFontFaceLoaded(rule)) continue; // Skip faces the page never downloaded.
        rules.push(rule);
      }
    }
    return rules;
  }

  isFontFaceLoaded(rule) {
    if (typeof document.fonts?.forEach !== 'function') return false;

    const family = this.normalizeFontFamily(rule.style.getPropertyValue('font-family'));
    const weight = String(rule.style.getPropertyValue('font-weight') || '').trim();
    let loaded = false;
    document.fonts.forEach(face => {
      if (loaded || face.status !== 'loaded') return;
      if (this.normalizeFontFamily(face.family) !== family) return;
      if (weight && String(face.weight).trim() !== weight) return;
      loaded = true;
    });
    return loaded;
  }

  async buildEmbeddedFontFaceCss(rule) {
    const source = this.getFontFaceSourceUrl(rule);
    if (!source) return '';

    // @font-face sources are relative to the stylesheet, not to the document.
    const baseUrl = rule.parentStyleSheet?.href || document.baseURI;
    const dataUrl = await this.loadFontDataUrl(source.url, baseUrl);
    if (!dataUrl) return '';

    const declarations = ['font-family:' + rule.style.getPropertyValue('font-family')];
    for (const property of ['font-style', 'font-weight', 'unicode-range']) {
      const value = rule.style.getPropertyValue(property);
      if (value) declarations.push(`${property}:${value}`);
    }
    declarations.push(`src:url(${dataUrl}) format("${source.format}")`);
    return `@font-face{${declarations.join(';')};}`;
  }

  getFontFaceSourceUrl(rule) {
    const src = rule.style.getPropertyValue('src') || '';
    const entries = [];
    const pattern = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)\s]+))\s*\)(?:\s*format\(\s*(?:"([^"]+)"|'([^']+)')\s*\))?/g;
    let match;
    while ((match = pattern.exec(src)) !== null) {
      const url = match[1] || match[2] || match[3];
      if (!url || url.startsWith('data:')) continue;
      const format = match[4] || match[5] || (url.split('?')[0].split('.').pop() || '').toLowerCase();
      entries.push({ url, format });
    }

    return entries.find(entry => entry.format === 'woff2') || entries[0] || null;
  }

  async loadFontDataUrl(url, baseUrl) {
    const absoluteUrl = new URL(url, baseUrl || document.baseURI).href;
    if (!this.embeddedFontCache) this.embeddedFontCache = new Map();
    if (this.embeddedFontCache.has(absoluteUrl)) return this.embeddedFontCache.get(absoluteUrl);

    let dataUrl = '';
    try {
      const response = await fetch(absoluteUrl);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        const mimeType = response.headers.get('content-type') || 'font/woff2';
        dataUrl = `data:${mimeType};base64,${this.arrayBufferToBase64(buffer)}`;
      }
    } catch (error) {
      console.warn(`[ScreenshotManager] Could not read font ${absoluteUrl}:`, error);
    }

    this.embeddedFontCache.set(absoluteUrl, dataUrl);
    return dataUrl;
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
  }

  async loadSvgImage(svgMarkup) {
    // Chromium taints the canvas when an SVG carrying <foreignObject> is drawn from a blob: URL,
    // which made every composed capture fall back to a visible-only screenshot. Data URLs stay
    // exportable, so only fall back to a blob when the markup is too large for a data URL.
    try {
      return await this.loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`);
    } catch {
      const blobUrl = URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' }));
      try {
        return await this.loadImage(blobUrl);
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
    }
  }

  renderCanvasToDataUrl(sourceCanvas, options) {
    this.prepareReadsCaptureElement(sourceCanvas);

    if (!sourceCanvas.width || !sourceCanvas.height) {
      throw new Error('Canvas screenshot source is empty');
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = sourceCanvas.width;
    outputCanvas.height = sourceCanvas.height;
    const ctx = outputCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas screenshot rendering context is unavailable');
    }

    if (options.format === 'jpeg') {
      ctx.fillStyle = options.background || '#ffffff';
      ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
    }

    ctx.drawImage(sourceCanvas, 0, 0);

    return outputCanvas.toDataURL(
      `image/${options.format}`,
      options.format === 'jpeg' ? this.normalizeQuality(options.quality) / 100 : undefined
    );
  }

  async captureEachTrackScreenshot(parameters, options) {
    await this.waitForPaint();

    const tracks = this.getCapturableTrackElements();
    if (tracks.length === 0) {
      throw new Error('No rendered tracks are available to capture');
    }

    const originalScrollState = this.captureScrollState();
    const capturedTracks = [];
    const failedTracks = [];

    try {
      for (const track of tracks) {
        const trackParameters = { ...parameters, trackType: track.type };
        const defaultFilename = this.buildDefaultFilename('track', options.mode, options.format, trackParameters);
        const filePath = this.resolveTrackOutputPath(parameters, track.type, options.format, defaultFilename);
        const save = this.shouldSaveScreenshot(parameters, filePath, options.returnImageData);

        try {
          const captureElement =
            this.resolveTrackTypeAlias(track.type) === 'reads'
              ? await this.waitForReadsTrackCaptureElement(track.element, parameters)
              : track.element;
          const result = await this.captureElementScreenshot(captureElement, {
            ...options,
            target: 'track',
            filePath,
            defaultFilename,
            save,
            notify: false,
          });

          capturedTracks.push({
            ...result,
            trackType: track.type,
            trackLabel: track.label,
          });
        } catch (error) {
          console.warn(`[ScreenshotManager] Failed to capture ${track.type} track:`, error);
          failedTracks.push({
            trackType: track.type,
            trackLabel: track.label,
            error: error.message,
          });
        }
      }
    } finally {
      this.restoreScrollState(originalScrollState);
    }

    if (capturedTracks.length === 0) {
      const errorDetails = failedTracks.map(track => `${track.trackType}: ${track.error}`).join('; ');
      throw new Error(`Failed to capture any tracks${errorDetails ? ` (${errorDetails})` : ''}`);
    }

    const filePaths = capturedTracks.map(track => track.filePath).filter(Boolean);
    const action = filePaths.length > 0 ? 'Saved' : 'Captured';
    const subject = filePaths.length > 0 ? 'track screenshot(s)' : 'track screenshot image data';
    const message =
      failedTracks.length > 0
        ? `${action} ${capturedTracks.length} ${subject}; ${failedTracks.length} track(s) failed`
        : `${action} ${capturedTracks.length} ${subject}`;

    this.showNotification(message, failedTracks.length > 0 ? 'warning' : 'success');

    return {
      success: true,
      partial: failedTracks.length > 0,
      tool: 'capture_screenshot',
      message,
      target: 'track',
      trackType: 'all',
      mode: options.mode,
      format: options.format,
      filePaths,
      tracks: capturedTracks,
      failures: failedTracks,
      filePath: filePaths[0] || null,
      fileName: capturedTracks[0]?.fileName || null,
      fileSize: capturedTracks.reduce((total, track) => total + (track.fileSize || 0), 0),
      imageSizeBytes: capturedTracks.reduce((total, track) => total + (track.imageSizeBytes || 0), 0),
      copiedToClipboard: capturedTracks.some(track => track.copiedToClipboard),
      opened: capturedTracks.some(track => track.opened),
    };
  }

  async captureElementScreenshot(element, options) {
    if (options.mode === 'visible') {
      this.scrollElementIntoCaptureView(element);
      await this.waitForPaint();
      return this.captureNativeScreenshot({
        ...options,
        rect: this.getVisibleCaptureRect(element),
      });
    }

    try {
      const imageDataUrl = await this.renderElementToDataUrl(element, {
        target: options.target,
        mode: options.mode,
        format: options.format,
        quality: options.quality,
        scale: options.scale,
        background: options.background,
        maxPixels: options.maxPixels,
      });

      return await this.saveRenderedScreenshot({
        ...options,
        imageDataUrl,
      });
    } catch (error) {
      if (!this.shouldFallbackToNativeCapture(error)) {
        throw error;
      }

      console.warn('[ScreenshotManager] Full track composition failed; using native visible capture:', error);
      this.scrollElementIntoCaptureView(element);
      await this.waitForPaint();
      return this.captureNativeScreenshot({
        ...options,
        rect: this.getVisibleCaptureRect(element),
        fallback: 'native_visible',
      });
    }
  }

  shouldFallbackToNativeCapture(error) {
    const message = String(error?.message || error || '').toLowerCase();
    return (
      message.includes('tainted canvas') ||
      message.includes('tainted canvases') ||
      message.includes('may not be exported') ||
      message.includes('could not copy canvas') ||
      message.includes('unable to render screenshot image')
    );
  }

  resolveTrackOutputPath(parameters, trackType, format, defaultFilename) {
    const requestedPath = this.getRequestedOutputPath(parameters);
    if (!requestedPath) {
      return this.resolveOutputPath(parameters, defaultFilename);
    }

    const resolvedPath = this.resolveOutputPath({ ...parameters, filePath: requestedPath }, defaultFilename);
    if (!resolvedPath) return null;

    const pathModule = this.getPathModule();
    const extension = this.getExtension(format);
    const suffix = this.sanitizeFilenamePart(trackType);
    const existingExtension =
      pathModule && typeof pathModule.extname === 'function'
        ? pathModule.extname(resolvedPath)
        : this.getPathExtension(resolvedPath);

    if (existingExtension) {
      const directory =
        pathModule && typeof pathModule.dirname === 'function'
          ? pathModule.dirname(resolvedPath)
          : this.getPathDirectory(resolvedPath);
      const baseName =
        pathModule && typeof pathModule.basename === 'function'
          ? pathModule.basename(resolvedPath).slice(0, -existingExtension.length)
          : this.getPathBasename(resolvedPath).slice(0, -existingExtension.length);
      const filename = `${baseName}-${suffix}${existingExtension}`;
      return pathModule && typeof pathModule.join === 'function'
        ? pathModule.join(directory, filename)
        : `${directory.replace(/\/+$/g, '')}/${filename}`;
    }

    return `${resolvedPath}-${suffix}.${extension}`;
  }

  getPathExtension(filePath) {
    const basename = this.getPathBasename(filePath);
    const index = basename.lastIndexOf('.');
    return index > 0 ? basename.slice(index) : '';
  }

  getPathDirectory(filePath) {
    const normalized = String(filePath || '').replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? (index === 0 ? '/' : '.') : normalized.slice(0, index);
  }

  getPathBasename(filePath) {
    return (
      String(filePath || '')
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean)
        .pop() || ''
    );
  }

  scrollElementIntoCaptureView(element) {
    if (typeof element?.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  captureScrollState() {
    const scrollElements = [
      document.scrollingElement || document.documentElement,
      document.getElementById('genomeViewerSection'),
      document.getElementById('genomeViewer'),
      document.getElementById('sequenceContent'),
    ].filter(Boolean);

    return scrollElements.map(element => ({
      element,
      left: element.scrollLeft,
      top: element.scrollTop,
    }));
  }

  restoreScrollState(scrollState = []) {
    scrollState.forEach(({ element, left, top }) => {
      if (element) {
        element.scrollLeft = left;
        element.scrollTop = top;
      }
    });
  }

  normalizeScale(scale) {
    const numericScale = Number(scale);
    if (!Number.isFinite(numericScale)) return 1;
    return Math.max(0.25, Math.min(numericScale, 4));
  }

  normalizeMaxPixels(maxPixels) {
    const numericPixels = Number(maxPixels);
    if (!Number.isFinite(numericPixels) || numericPixels <= 0) {
      return this.defaultMaxPixels;
    }
    return Math.max(1000000, Math.min(Math.trunc(numericPixels), 200000000));
  }

  replaceCanvasWithImages(sourceElement, cloneElement) {
    const sourceCanvases = sourceElement.querySelectorAll('canvas');
    const cloneCanvases = cloneElement.querySelectorAll('canvas');
    const result = { copied: 0, failed: 0 };

    sourceCanvases.forEach((sourceCanvas, index) => {
      const cloneCanvas = cloneCanvases[index];
      if (!cloneCanvas) return;

      try {
        const image = document.createElement('img');
        image.src = sourceCanvas.toDataURL('image/png');
        image.width = sourceCanvas.clientWidth || sourceCanvas.width;
        image.height = sourceCanvas.clientHeight || sourceCanvas.height;
        image.style.cssText = cloneCanvas.getAttribute('style') || '';
        image.style.width = sourceCanvas.style.width || `${image.width}px`;
        image.style.height = sourceCanvas.style.height || `${image.height}px`;
        image.style.display = sourceCanvas.style.display || 'block';
        cloneCanvas.replaceWith(image);
        result.copied += 1;
      } catch (error) {
        result.failed += 1;
        console.warn('[ScreenshotManager] Could not copy canvas into screenshot:', error);
      }
    });

    return result;
  }

  inlineComputedStyles(sourceElement, cloneElement) {
    const sourceNodes = [sourceElement, ...sourceElement.querySelectorAll('*')];
    const cloneNodes = [cloneElement, ...cloneElement.querySelectorAll('*')];
    const count = Math.min(sourceNodes.length, cloneNodes.length);
    const fontFamilies = new Set();

    for (let index = 0; index < count; index += 1) {
      const sourceNode = sourceNodes[index];
      const cloneNode = cloneNodes[index];
      const computed = window.getComputedStyle(sourceNode);
      this.collectFontFamilies(computed, fontFamilies);
      let cssText = '';
      for (const property of computed) {
        cssText += `${property}:${computed.getPropertyValue(property)};`;
      }
      cloneNode.setAttribute('style', `${cssText}${cloneNode.getAttribute('style') || ''}`);

      if (sourceNode instanceof HTMLInputElement || sourceNode instanceof HTMLTextAreaElement) {
        cloneNode.setAttribute('value', sourceNode.value);
      }
      if (sourceNode instanceof HTMLSelectElement && cloneNode instanceof HTMLSelectElement) {
        cloneNode.value = sourceNode.value;
      }

      // Stylesheets are not carried into the SVG, so ::before/::after glyphs (icon fonts,
      // badges) would disappear from the capture unless they become real nodes.
      this.inlinePseudoElement(sourceNode, cloneNode, '::before', fontFamilies);
      this.inlinePseudoElement(sourceNode, cloneNode, '::after', fontFamilies);
    }

    return fontFamilies;
  }

  inlinePseudoElement(sourceNode, cloneNode, pseudo, fontFamilies) {
    if (!cloneNode || typeof cloneNode.insertBefore !== 'function') return;

    const computed = window.getComputedStyle(sourceNode, pseudo);
    if (!computed || computed.display === 'none' || computed.visibility === 'hidden') return;

    const text = this.parsePseudoContent(computed.getPropertyValue('content'));
    if (!text) return;

    this.collectFontFamilies(computed, fontFamilies);

    let cssText = '';
    for (const property of computed) {
      if (property === 'content') continue;
      cssText += `${property}:${computed.getPropertyValue(property)};`;
    }

    const span = document.createElement('span');
    span.setAttribute('style', cssText);
    span.textContent = text;

    if (pseudo === '::before') {
      cloneNode.insertBefore(span, cloneNode.firstChild);
    } else {
      cloneNode.appendChild(span);
    }
  }

  parsePseudoContent(content) {
    const value = String(content || '').trim();
    if (!value || value === 'none' || value === 'normal') return '';

    const quoted = /^"((?:[^"\\]|\\.)*)"$/.exec(value) || /^'((?:[^'\\]|\\.)*)'$/.exec(value);
    if (!quoted) return '';

    return quoted[1]
      .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/\\(.)/g, '$1');
  }

  getElementBackground(element, format) {
    if (format === 'jpeg') return '#ffffff';
    const computed = window.getComputedStyle(element);
    const backgroundColor = computed.backgroundColor || '#ffffff';
    return backgroundColor === 'rgba(0, 0, 0, 0)' || backgroundColor === 'transparent' ? '#ffffff' : backgroundColor;
  }

  loadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Unable to render screenshot image'));
      image.src = url;
    });
  }

  waitForPaint() {
    return new Promise(resolve => {
      // Chromium stops firing animation frames while the window is occluded or minimized,
      // so the wait for a repaint has to be bounded or the capture would never finish.
      const timeout = setTimeout(resolve, 300);
      const settle = () => {
        clearTimeout(timeout);
        resolve();
      };
      requestAnimationFrame(() => requestAnimationFrame(settle));
    });
  }

  showNotification(message, type = 'info') {
    if (typeof this.genomeBrowser?.showNotification === 'function') {
      this.genomeBrowser.showNotification(message, type);
    }
  }
}

window.ScreenshotManager = ScreenshotManager;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScreenshotManager;
}
