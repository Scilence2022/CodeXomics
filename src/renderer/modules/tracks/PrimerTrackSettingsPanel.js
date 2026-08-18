'use strict';

/**
 * @module PrimerTrackSettingsPanel
 * @description Settings panel for the Primers track.
 *
 *              The exposed knobs are the ones that change how oligo arrows
 *              read: how big they are, how many rows they may use, and whether
 *              names, predicted sites and amplicon spans are drawn. Track
 *              height is deliberately absent — the track sizes itself to the
 *              rows it packs, and dragging the resize handle overrides that.
 *
 *              Methods take the TrackRenderer instance as `self`, matching the
 *              convention used by GeneShapeCreators and FeatureGlyphLegend.
 */

class PrimerTrackSettingsPanel {
  /** Panel markup for the track settings modal. */
  static content(self, settings) {
    const style = TrackRenderer.PRIMER_TRACK_STYLE;
    const layoutMode = self.normalizeLayoutMode(settings.layoutMode);
    const fontFamily = settings.fontFamily || 'Arial, sans-serif';

    return `
            <div class="primers-settings-tabs">
                <div class="llm-provider-tabs">
                    <button class="tab-button active" data-tab="primers-layout">
                        <i class="fas fa-arrows-alt-h"></i> Arrows
                    </button>
                    <button class="tab-button" data-tab="primers-labels">
                        <i class="fas fa-font"></i> Labels
                    </button>
                    <button class="tab-button" data-tab="primers-content">
                        <i class="fas fa-filter"></i> Content
                    </button>
                </div>

                <div class="llm-provider-config">
                    <!-- ARROWS TAB -->
                    <div class="tab-content active" id="primers-layout-tab">
                        <div class="settings-section">
                            <h4>Arrow Geometry</h4>
                            <div class="form-group">
                                <label for="primersGlyphHeight">Arrow Height (px):</label>
                                <input type="number" id="primersGlyphHeight" class="form-input" min="6" max="28" value="${settings.geneHeight || style.glyphHeight}">
                                <div class="help-text">Thickness of each oligo arrow.</div>
                            </div>
                            <div class="form-group">
                                <label for="primersMinGlyphWidth">Minimum Arrow Width (px):</label>
                                <input type="number" id="primersMinGlyphWidth" class="form-input" min="2" max="40" value="${settings.minGlyphWidth || style.minGlyphWidth}">
                                <div class="help-text">
                                    A 20 nt oligo is a fraction of a pixel when zoomed out, so arrows narrower than this
                                    are drawn at this width, centred on the site. Lower it to keep more zoom levels
                                    exactly to scale; raise it to make distant primers easier to see and click.
                                </div>
                            </div>
                        </div>
                        <div class="settings-section">
                            <h4>Rows</h4>
                            <div class="form-group">
                                <label for="primersMaxRows">Maximum Rows:</label>
                                <input type="number" id="primersMaxRows" class="form-input" min="1" max="10" value="${settings.maxRows || style.maxRows}">
                                <div class="help-text">Sites beyond this many rows are stacked onto the last row, never hidden.</div>
                            </div>
                            <div class="form-group">
                                <label for="primersLayoutMode">Layout Mode:</label>
                                <select id="primersLayoutMode" class="form-select">
                                    <option value="packed" ${layoutMode === 'packed' ? 'selected' : ''}>Packed (rows as needed)</option>
                                    <option value="singleRow" ${layoutMode === 'singleRow' ? 'selected' : ''}>Single row</option>
                                </select>
                                <div class="help-text">Packed spreads overlapping sites across rows; single row keeps the track compact.</div>
                            </div>
                        </div>
                    </div>

                    <!-- LABELS TAB -->
                    <div class="tab-content" id="primers-labels-tab">
                        <div class="settings-section">
                            <h4>Primer Names</h4>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="primersShowLabels" ${settings.showLabels !== false ? 'checked' : ''}>
                                    Show primer names
                                </label>
                                <div class="help-text">Names are dropped automatically when a view is too crowded to fit them.</div>
                            </div>
                            <div class="form-group">
                                <label for="primersFontSize">Font Size (px):</label>
                                <input type="number" id="primersFontSize" class="form-input" min="9" max="14" value="${settings.fontSize || style.fontSize}">
                            </div>
                            <div class="form-group">
                                <label for="primersLabelColor">Label Color:</label>
                                <input type="color" id="primersLabelColor" class="form-input" value="${settings.geneNameColor || style.labelColor}">
                                <div class="help-text">Used for names drawn beside an arrow; names inside an arrow stay white.</div>
                            </div>
                            <div class="form-group">
                                <label for="primersFontFamily">Font Family:</label>
                                <select id="primersFontFamily" class="form-select">
                                    <option value="Arial, sans-serif" ${fontFamily === 'Arial, sans-serif' ? 'selected' : ''}>Arial</option>
                                    <option value="Helvetica, sans-serif" ${fontFamily === 'Helvetica, sans-serif' ? 'selected' : ''}>Helvetica</option>
                                    <option value="monospace" ${fontFamily === 'monospace' ? 'selected' : ''}>Monospace</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- CONTENT TAB -->
                    <div class="tab-content" id="primers-content-tab">
                        <div class="settings-section">
                            <h4>What To Draw</h4>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="primersShowPredicted" ${settings.showPredicted !== false ? 'checked' : ''}>
                                    Show predicted binding sites
                                </label>
                                <div class="help-text">
                                    Real-time off-target hits, drawn as pale hollow arrows. Turn off to keep only pinned sites.
                                </div>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" id="primersShowAmplicons" ${settings.showAmplicons !== false ? 'checked' : ''}>
                                    Show amplicon spans
                                </label>
                                <div class="help-text">
                                    Measured span with product size for a paired forward/reverse primer that are both in view.
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
  }

  /**
   * Read the panel back into a settings object. Every field falls back to the
   * shipped geometry so a blank or out-of-range input cannot produce a track
   * nobody can read.
   */
  static collect(self, modal) {
    const style = TrackRenderer.PRIMER_TRACK_STYLE;
    return {
      geneHeight: parseInt(modal.querySelector('#primersGlyphHeight')?.value) || style.glyphHeight,
      minGlyphWidth: parseInt(modal.querySelector('#primersMinGlyphWidth')?.value) || style.minGlyphWidth,
      maxRows: parseInt(modal.querySelector('#primersMaxRows')?.value) || style.maxRows,
      layoutMode: self.normalizeLayoutMode(modal.querySelector('#primersLayoutMode')?.value),
      showLabels: modal.querySelector('#primersShowLabels')?.checked !== false,
      fontSize: parseInt(modal.querySelector('#primersFontSize')?.value) || style.fontSize,
      geneNameColor: modal.querySelector('#primersLabelColor')?.value || style.labelColor,
      fontFamily: modal.querySelector('#primersFontFamily')?.value || 'Arial, sans-serif',
      showPredicted: modal.querySelector('#primersShowPredicted')?.checked !== false,
      showAmplicons: modal.querySelector('#primersShowAmplicons')?.checked !== false,
    };
  }
}

if (typeof window !== 'undefined') {
  window.PrimerTrackSettingsPanel = PrimerTrackSettingsPanel;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrimerTrackSettingsPanel;
}
