window.CircosScene = (() => {
  const radians = degrees => (degrees * Math.PI) / 180;
  const TAU = 2 * Math.PI;
  const arc = d3.arc();
  const polar = (angle, radius) => [Math.cos(angle) * radius, Math.sin(angle) * radius];
  const angleAt = (chr, position) => chr.startAngle + (position / chr.length) * (chr.endAngle - chr.startAngle);

  function ring(startAngle, endAngle, inner, outer) {
    return arc({
      startAngle: startAngle + Math.PI / 2,
      endAngle: endAngle + Math.PI / 2,
      innerRadius: inner,
      outerRadius: outer,
    });
  }

  function formatBp(value) {
    if (value >= 1e9) return `${+(value / 1e9).toPrecision(3)} Gb`;
    if (value >= 1e6) return `${+(value / 1e6).toPrecision(3)} Mb`;
    if (value >= 1e3) return `${+(value / 1e3).toPrecision(3)} kb`;
    return `${value} bp`;
  }

  function layout(plotter) {
    const { data, multiTrackManager, trackData } = plotter;
    const theme = plotter.getCurrentTheme();
    const paths = [];
    const labels = [];
    const hitBands = new Map();
    const linkHits = [];
    const legend = [];
    const inner = plotter.radius * plotter.innerRadiusRatio;
    const outer = inner + plotter.chromosomeWidth;
    // Keep at least 75% of the circle for sequence when plotting fragmented assemblies.
    const gap = radians(Math.min(plotter.chromosomeGap, 90 / data.chromosomes.length));
    const span = TAU - gap * data.chromosomes.length;
    let angle = radians(plotter.startAngle);
    const chromosomes = new Map(
      data.chromosomes.map((chr, index) => {
        const endAngle = angle + span * (chr.length / data.metadata.totalLength);
        const layout = {
          ...chr,
          startAngle: angle,
          endAngle,
          color: chr.color || theme.chromosomes[index % theme.chromosomes.length],
        };
        angle = endAngle + gap;
        return [chr.name, layout];
      })
    );

    function addRing(chr, start, end, lower, upper, style, tooltip, target) {
      const startAngle = angleAt(chr, start);
      const endAngle = angleAt(chr, end);
      paths.push({ ...style, d: ring(startAngle, endAngle, lower, upper) });
      if (tooltip) addHit(lower, upper, { startAngle, endAngle, tooltip, target });
    }

    function addHit(lower, upper, region) {
      const key = `${lower}:${upper}`;
      if (!hitBands.has(key)) hitBands.set(key, { lower, upper, regions: [] });
      hitBands.get(key).regions.push(region);
    }

    if (plotter.showLinks && data.links.length) {
      for (const link of data.links) {
        const source = polar(angleAt(chromosomes.get(link.source.chromosome), link.source.start), inner);
        const target = polar(angleAt(chromosomes.get(link.target.chromosome), link.target.start), inner);
        const path = d3.path();
        path.moveTo(...source);
        path.quadraticCurveTo(0, 0, ...target);
        const strength = link.value >= 0.7 ? 'strong' : link.value >= 0.4 ? 'medium' : 'weak';
        const d = path.toString();
        const width = 0.6 + link.value * 4;
        paths.push({
          d,
          stroke: theme.links[strength],
          width,
          opacity: plotter.linkOpacity,
          dash: strength === 'strong' ? [] : strength === 'medium' ? [5, 2] : [3, 3],
        });
        linkHits.push({
          path: new Path2D(d),
          width,
          tooltip: [
            `${link.source.chromosome} → ${link.target.chromosome}`,
            `${link.type || 'Link'} · ${Math.round(link.value * 100)}%`,
          ],
        });
      }
      legend.push({ label: 'Links by strength', color: theme.links.strong });
    }

    let extent = outer;
    for (const chr of chromosomes.values()) {
      addRing(
        chr,
        0,
        chr.length,
        inner,
        outer,
        {
          fill: chr.color,
          stroke: plotter.strokeColor,
          width: plotter.strokeWidth,
        },
        [chr.name, formatBp(chr.length)],
        { chromosome: chr.name }
      );
      const arcLength = (chr.endAngle - chr.startAngle) * outer;
      if (plotter.showTicks && arcLength >= 32) {
        const step = Math.max(1, d3.tickStep(0, chr.length, Math.max(1, arcLength / 65)));
        const path = d3.path();
        for (let position = 0; position < chr.length; position += step) {
          const at = angleAt(chr, position);
          path.moveTo(...polar(at, inner));
          path.lineTo(...polar(at, Math.max(0, inner - 5)));
          const [x, y] = polar(at, Math.max(0, inner - 16));
          labels.push({ x, y, text: formatBp(position), size: 9, rotation: 0 });
        }
        paths.push({ d: path.toString(), stroke: theme.ticks, width: 1 });
      }
    }

    const groups = multiTrackManager.groupGenesByType(data.genes);
    let radius = outer + 5;
    if (plotter.showGenes) {
      for (const [type, config] of Object.entries(multiTrackManager.geneTracks)) {
        const genes = groups.get(type) || [];
        if (!config.enabled || !genes.length) continue;
        const lanes = type === 'protein_coding' && genes.length > 2000 ? multiTrackManager.cdsDensityTracks : 1;
        const laneEnds = new Map();
        for (const gene of genes) {
          const chr = chromosomes.get(gene.chromosome);
          if (!laneEnds.has(chr.name)) laneEnds.set(chr.name, Array(lanes).fill(0));
          const ends = laneEnds.get(chr.name);
          let lane = ends.findIndex(end => end <= gene.start);
          if (lane < 0) lane = ends.indexOf(Math.min(...ends));
          ends[lane] = Math.max(ends[lane], gene.end);
          const lower = radius + lane * (plotter.geneHeight + 2);
          const tooltip = [
            gene.name,
            gene.type,
            `${chr.name}:${(gene.start + 1).toLocaleString()}–${gene.end.toLocaleString()} (${gene.strand})`,
            gene.description,
          ].filter(Boolean);
          for (const segment of gene.segments.length ? gene.segments : [gene]) {
            addRing(
              chr,
              segment.start,
              segment.end,
              lower,
              lower + plotter.geneHeight,
              {
                fill: config.color,
                opacity: 0.85,
                stroke: theme.stroke,
                width: gene.strand === '-' ? 0.5 : 0,
                dash: [2, 1],
              },
              tooltip,
              gene
            );
          }
        }
        legend.push({ label: config.name, color: config.color });
        radius += lanes * (plotter.geneHeight + 2) + 3;
        extent = Math.max(extent, radius);
      }
    }

    for (const [key, label, visible] of [
      ['gc_content', 'GC content', plotter.showGCContent],
      ['gc_skew', 'GC skew', plotter.showGCSkew],
      ['wig', plotter.wigName || data.metadata.wigName || 'WIG', plotter.showWigData],
    ]) {
      if (!visible) continue;
      const points =
        key === 'wig' && plotter.source === 'genome' && plotter.wigName !== plotter.renderedWigName
          ? null
          : trackData[key];
      if (!points?.some(point => point.value !== null)) continue;
      let minimum = key === 'gc_skew' ? -1 : 0;
      let maximum = key === 'gc_content' ? 100 : 1;
      if (key === 'wig') {
        minimum = 0;
        maximum = 0;
        for (const { value } of points) {
          if (value === null) continue;
          minimum = Math.min(minimum, value);
          maximum = Math.max(maximum, value);
        }
      }
      const height = plotter.wigTrackHeight;
      const magnitude = Math.max(Math.abs(minimum), maximum) || 1;
      const low = minimum / magnitude;
      const span = maximum / magnitude - low || 1;
      const radialValue = value => radius + (height * (value / magnitude - low)) / span;
      const baseline = radialValue(0);
      const positive = plotter.getTrackColor(key, theme);
      const negative = theme.tracks.baseline;
      for (const { chromosome, start, end, value } of points) {
        if (value === null) continue;
        const chr = chromosomes.get(chromosome);
        const at = radialValue(value);
        const unit = key === 'gc_content' ? '%' : '';
        const upper = Math.max(baseline, at);
        addRing(chr, start, end, value === 0 ? upper - 0.7 : Math.min(baseline, at), upper, {
          fill: value <= 0 ? negative : positive,
          opacity: 0.85,
        });
        addHit(radius, radius + height, {
          startAngle: angleAt(chr, start),
          endAngle: angleAt(chr, end),
          tooltip: [
            label,
            `${chr.name}:${(start + 1).toLocaleString()}–${end.toLocaleString()}`,
            `${+value.toPrecision(4)}${unit}`,
          ],
        });
      }
      legend.push({
        label: `${label} (${minimum} to ${+maximum.toPrecision(4)}${key === 'gc_content' ? '%' : ''})`,
        color: positive,
        negative: minimum < 0 ? negative : null,
      });
      radius += height + 7;
      extent = Math.max(extent, radius);
    }

    if (plotter.showLabels) {
      const labelRadius = extent + plotter.labelDistance;
      for (const chr of chromosomes.values()) {
        const arcLength = (chr.endAngle - chr.startAngle) * labelRadius;
        if (arcLength < 14 && chromosomes.size > 8) continue;
        const midAngle = (chr.startAngle + chr.endAngle) / 2;
        const name = chr.name.length > 24 ? `${chr.name.slice(0, 23)}…` : chr.name;
        const [x, y] = polar(midAngle, labelRadius);
        const rotation = Math.atan2(Math.sin(midAngle), Math.cos(midAngle));
        labels.push({
          x,
          y,
          text: name,
          size: 12,
          rotation: Math.abs(rotation) > Math.PI / 2 ? rotation + Math.PI : rotation,
        });
        extent = Math.max(extent, labelRadius + name.length * 3.6);
      }
    }

    for (const band of hitBands.values()) {
      band.regions.sort((a, b) => a.startAngle - b.startAngle);
      let furthestEnd = -Infinity;
      for (const region of band.regions) {
        furthestEnd = Math.max(furthestEnd, region.endAngle);
        region.furthestEnd = furthestEnd;
      }
    }
    return { paths, labels, hitBands: [...hitBands.values()], linkHits, legend, inner, extent, textColor: theme.text };
  }

  return { layout, formatBp, TAU };
})();
