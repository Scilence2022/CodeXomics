/* global CircosData */

window.MultiTrackGeneManager = class MultiTrackGeneManager {
  constructor(plotter) {
    this.plotter = plotter;
    this.geneTracks = {
      protein_coding: { name: 'Protein coding', enabled: true },
      non_coding: { name: 'Non-coding RNA', enabled: true },
      tRNA: { name: 'tRNA', enabled: true },
      rRNA: { name: 'rRNA', enabled: true },
      regulatory: { name: 'Regulatory', enabled: true },
      pseudogene: { name: 'Pseudogene', enabled: true },
      other: { name: 'Other features', enabled: false },
    };
    this.cdsDensityTracks = 3;
    this.setTheme(plotter.getCurrentTheme());
    this.addTrackControls();
  }

  setTheme(theme) {
    for (const [type, config] of Object.entries(this.geneTracks)) {
      config.color =
        theme.genes[type] ||
        (type === 'tRNA' ? theme.tracks.gc_skew : type === 'rRNA' ? theme.tracks.wig_data : theme.genes.default);
      const picker = document.getElementById(`trackColorPicker-${type}`);
      if (picker) picker.value = config.color;
    }
  }

  addTrackControls() {
    const container = document.getElementById('controls');
    for (const [type, config] of Object.entries(this.geneTracks)) {
      const row = document.createElement('div');
      row.className = 'checkbox-group gene-track-control';
      const enabled = document.createElement('input');
      enabled.type = 'checkbox';
      enabled.id = `track-${type}`;
      enabled.checked = config.enabled;
      enabled.addEventListener('change', () => {
        config.enabled = enabled.checked;
        this.plotter.redrawPlot();
      });
      const label = document.createElement('label');
      label.htmlFor = enabled.id;
      label.textContent = config.name;
      const count = document.createElement('span');
      count.id = `count-${type}`;
      count.className = 'gene-count';
      const color = document.createElement('input');
      color.type = 'color';
      color.id = `trackColorPicker-${type}`;
      color.value = config.color;
      color.setAttribute('aria-label', `${config.name} color`);
      color.addEventListener('input', () => {
        config.color = color.value;
        this.plotter.redrawPlot();
      });
      row.append(enabled, label, count, color);
      container.append(row);
    }
    const density = document.getElementById('cds-density-tracks');
    density.addEventListener('change', () => {
      this.cdsDensityTracks = Math.max(1, Math.min(5, Math.round(density.valueAsNumber || 3)));
      density.value = this.cdsDensityTracks;
      this.plotter.redrawPlot();
    });
  }

  groupGenesByType(genes) {
    if (this.genes === genes) return this.groups;
    const groups = new Map();
    for (const gene of genes) {
      if (gene.type.toLowerCase() === 'source') continue;
      const type = Object.hasOwn(this.geneTracks, gene.track) ? gene.track : CircosData.featureTrack(gene.type);
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push(gene);
    }
    for (const group of groups.values()) {
      group.sort((a, b) => a.chromosome.localeCompare(b.chromosome) || a.start - b.start || a.end - b.end);
    }
    for (const type of Object.keys(this.geneTracks)) {
      document.getElementById(`count-${type}`).textContent = (groups.get(type)?.length || 0).toLocaleString();
    }
    this.genes = genes;
    this.groups = groups;
    return groups;
  }
};
