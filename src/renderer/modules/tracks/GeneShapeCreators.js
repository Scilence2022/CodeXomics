'use strict';

/**
 * @module GeneShapeCreators
 * @description Static utility class for creating SVG gene shapes, gradients,
 *              text labels, and interaction handlers for genome track rendering.
 *
 *              Extracted from TrackRenderer.js (lines ~1669-3288) to separate
 *              SVG shape generation concerns from track layout and rendering logic.
 *
 *              Methods that require TrackRenderer instance state (e.g., color
 *              helpers, genome browser queries, viewport, event handlers) accept
 *              a `self` parameter referencing the TrackRenderer instance.
 *              Pure SVG-path generation methods are truly static and do not
 *              require a TrackRenderer reference.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

class GeneShapeCreators {
  // ---------------------------------------------------------------------------
  // Gradient helpers
  // ---------------------------------------------------------------------------

  /**
   * Create SVG gradient for gene visualization.
   * @param {Object}      self       - TrackRenderer instance (for self.lightenColor)
   * @param {SVGDefsElement} defs    - SVG <defs> element
   * @param {string}      gradientId - Unique id for the gradient
   * @param {string}      baseColor  - Base colour for the gradient
   * @returns {SVGLinearGradientElement}
   */
  static createSVGGeneGradient(self, defs, gradientId, baseColor) {
    const gradient = document.createElementNS(SVG_NS, 'linearGradient');
    gradient.setAttribute('id', gradientId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '100%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS(SVG_NS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', baseColor);

    const stop2 = document.createElementNS(SVG_NS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', self.lightenColor(baseColor, 20));

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);

    return gradient;
  }

  /**
   * Create specialised gradients for different gene types.
   * @param {SVGDefsElement} defs - SVG <defs> element
   */
  static createSpecializedGradients(defs) {
    const gradients = [
      { id: 'promoter-gradient', color1: '#1e40af', color2: '#3b82f6' },
      { id: 'terminator-gradient', color1: '#7f1d1d', color2: '#dc2626' },
      { id: 'regulatory-gradient', color1: '#c2410c', color2: '#f97316' },
      { id: 'repeat-gradient', color1: '#374151', color2: '#6b7280' },
      { id: 'trna-gradient', color1: '#166534', color2: '#22c55e' },
      { id: 'rrna-gradient', color1: '#14532d', color2: '#16a34a' },
      { id: 'mrna-gradient', color1: '#15803d', color2: '#4ade80' },
      { id: 'comment-gradient', color1: '#7c3aed', color2: '#a855f7' },
    ];

    gradients.forEach(gradientDef => {
      const gradient = document.createElementNS(SVG_NS, 'linearGradient');
      gradient.setAttribute('id', gradientDef.id);
      gradient.setAttribute('x1', '0%');
      gradient.setAttribute('y1', '0%');
      gradient.setAttribute('x2', '100%');
      gradient.setAttribute('y2', '100%');

      const stop1 = document.createElementNS(SVG_NS, 'stop');
      stop1.setAttribute('offset', '0%');
      stop1.setAttribute('stop-color', gradientDef.color1);

      const stop2 = document.createElementNS(SVG_NS, 'stop');
      stop2.setAttribute('offset', '100%');
      stop2.setAttribute('stop-color', gradientDef.color2);

      gradient.appendChild(stop1);
      gradient.appendChild(stop2);
      defs.appendChild(gradient);
    });
  }

  // ---------------------------------------------------------------------------
  // Main shape dispatcher
  // ---------------------------------------------------------------------------

  /**
   * Create SVG shape for gene (with directional indicators based on size and
   * specialised shapes by type).
   * @param {Object}  self            - TrackRenderer instance (for colour helpers)
   * @param {Object}  gene            - Gene data object
   * @param {number}  width           - Shape width in px
   * @param {number}  height          - Shape height in px
   * @param {string}  gradientId      - URL-ready gradient id
   * @param {Object}  operonInfo      - Operon metadata
   * @param {boolean} [isLeftTruncated=false]
   * @param {boolean} [isRightTruncated=false]
   * @param {number}  [strokeWidth=1] - Zoom-based stroke width
   * @returns {SVGPathElement}
   */
  static createSVGGeneShape(
    self,
    gene,
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated = false,
    isRightTruncated = false,
    strokeWidth = 1
  ) {
    const isForward = gene.strand !== -1;
    const geneType = gene.type.toLowerCase();

    // Create specialised shapes for specific gene types
    if (GeneShapeCreators.shouldUseSpecializedShape(geneType)) {
      return GeneShapeCreators.createSpecializedGeneShape(
        self,
        gene,
        width,
        height,
        gradientId,
        operonInfo,
        isLeftTruncated,
        isRightTruncated,
        strokeWidth
      );
    }

    const path = document.createElementNS(SVG_NS, 'path');
    let pathData;

    if (width < 8) {
      // For small genes, use triangle shape as requested by user
      // Triangle width matches gene width exactly
      if (isForward) {
        // Forward triangle (pointing right)
        if (isLeftTruncated) {
          // Add jagged left edge
          pathData = GeneShapeCreators.createJaggedTrianglePath(width, height, true, false, isForward);
        } else if (isRightTruncated) {
          // Add jagged right edge
          pathData = GeneShapeCreators.createJaggedTrianglePath(width, height, false, true, isForward);
        } else {
          // Normal triangle - exact width match
          pathData = `M 0 0
                               L ${width} ${height / 2}
                               L 0 ${height}
                               Z`;
        }
      } else {
        // Reverse triangle (pointing left)
        if (isLeftTruncated) {
          // Add jagged left edge
          pathData = GeneShapeCreators.createJaggedTrianglePath(width, height, true, false, isForward);
        } else if (isRightTruncated) {
          // Add jagged right edge
          pathData = GeneShapeCreators.createJaggedTrianglePath(width, height, false, true, isForward);
        } else {
          // Normal triangle - exact width match
          pathData = `M ${width} 0
                               L 0 ${height / 2}
                               L ${width} ${height}
                               Z`;
        }
      }
      path.setAttribute(
        'class',
        `gene-triangle ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
      );
    } else {
      // For larger genes, use arrow shape with dynamic arrow size
      // Calculate appropriate arrow size based on gene width
      const arrowSize = Math.max(2, Math.min(width * 0.3, 15));

      if (isForward) {
        // Forward arrow (pointing right)
        if (isLeftTruncated) {
          // Add jagged left edge
          pathData = GeneShapeCreators.createJaggedArrowPath(width, height, arrowSize, true, false, isForward);
        } else if (isRightTruncated) {
          // Add jagged right edge (but keep arrow tip)
          pathData = GeneShapeCreators.createJaggedArrowPath(width, height, arrowSize, false, true, isForward);
        } else {
          // Normal forward arrow
          pathData = `M 0 0
                               L ${width - arrowSize} 0
                               L ${width} ${height / 2}
                               L ${width - arrowSize} ${height}
                               L 0 ${height}
                               Z`;
        }
      } else {
        // Reverse arrow (pointing left)
        if (isLeftTruncated) {
          // Add jagged left edge (but keep arrow tip)
          pathData = GeneShapeCreators.createJaggedArrowPath(width, height, arrowSize, true, false, isForward);
        } else if (isRightTruncated) {
          // Add jagged right edge
          pathData = GeneShapeCreators.createJaggedArrowPath(width, height, arrowSize, false, true, isForward);
        } else {
          // Normal reverse arrow
          pathData = `M ${arrowSize} 0
                               L ${width} 0
                               L ${width} ${height}
                               L ${arrowSize} ${height}
                               L 0 ${height / 2}
                               Z`;
        }
      }
      path.setAttribute(
        'class',
        `gene-arrow ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
      );
    }

    path.setAttribute('d', pathData);
    path.setAttribute('fill', `url(#${gradientId})`);

    // Use zoom-based stroke width (passed as parameter)
    if (strokeWidth > 0) {
      path.setAttribute('stroke', self.darkenColor(operonInfo.color, 20));
      path.setAttribute('stroke-width', strokeWidth.toString());
    } else {
      path.setAttribute('stroke', 'transparent');
      path.setAttribute('stroke-width', '0');
    }
    return path;
  }

  /**
   * Check if gene type should use specialised shape.
   * @param {string} geneType
   * @returns {boolean}
   */
  static shouldUseSpecializedShape(geneType) {
    const specializedTypes = [
      'promoter',
      'terminator',
      'regulatory',
      'repeat_region',
      'trna',
      'rrna',
      'mrna',
      'comment',
      'note',
      'misc_feature',
    ];
    return specializedTypes.includes(geneType);
  }

  /**
   * Create specialised shapes for specific gene types.
   * @param {Object}  self            - TrackRenderer instance
   * @param {Object}  gene
   * @param {number}  width
   * @param {number}  height
   * @param {string}  gradientId
   * @param {Object}  operonInfo
   * @param {boolean} [isLeftTruncated=false]
   * @param {boolean} [isRightTruncated=false]
   * @param {number}  [strokeWidth=1] - Zoom-based stroke width
   * @returns {SVGElement|null}
   */
  static createSpecializedGeneShape(
    self,
    gene,
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated = false,
    isRightTruncated = false,
    strokeWidth = 1
  ) {
    const geneType = gene.type.toLowerCase();
    const isForward = gene.strand !== -1;

    switch (geneType) {
      case 'promoter':
        return GeneShapeCreators.createPromoterShape(
          width,
          height,
          'promoter-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'terminator':
        return GeneShapeCreators.createTerminatorShape(
          width,
          height,
          'terminator-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'regulatory':
        return GeneShapeCreators.createRegulatoryShape(
          self,
          width,
          height,
          'regulatory-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'repeat_region':
        return GeneShapeCreators.createRepeatShape(
          width,
          height,
          'repeat-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'trna':
        return GeneShapeCreators.createTRNAShape(
          width,
          height,
          'trna-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'rrna':
        return GeneShapeCreators.createRRNAShape(
          width,
          height,
          'rrna-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'mrna':
        return GeneShapeCreators.createMRNAShape(
          self,
          width,
          height,
          'mrna-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      case 'comment':
      case 'note':
      case 'misc_feature':
        return GeneShapeCreators.createCommentShape(
          self,
          width,
          height,
          'comment-gradient',
          operonInfo,
          isLeftTruncated,
          isRightTruncated,
          isForward,
          strokeWidth
        );
      default:
        // Fallback to regular arrow/triangle
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Specialised gene-type shapes
  // ---------------------------------------------------------------------------

  /**
   * Create promoter shape - bent elbow arrow indicating transcription start.
   * Design: A distinctive bent arrow (⌐ or ⌙ shape) that clearly shows direction.
   * @param {number}  width
   * @param {number}  height
   * @param {string}  gradientId
   * @param {Object}  operonInfo
   * @param {boolean} isLeftTruncated
   * @param {boolean} isRightTruncated
   * @param {boolean} isForward
   * @param {number}  [strokeWidth=1] - Zoom-based stroke width
   * @returns {SVGGElement}
   */
  static createPromoterShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute(
      'class',
      `gene-promoter ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    // Purple color scheme for promoter (matching reference)
    const fillColor = '#a855f7'; // Purple
    const strokeColor = '#7c3aed'; // Darker purple

    if (isLeftTruncated || isRightTruncated) {
      // For truncated promoters, use simplified jagged shape
      const path = document.createElementNS(SVG_NS, 'path');
      let pathData;
      if (isLeftTruncated) {
        pathData = GeneShapeCreators.createJaggedPromoterPath(width, height, true, false, isForward);
      } else {
        pathData = GeneShapeCreators.createJaggedPromoterPath(width, height, false, true, isForward);
      }
      path.setAttribute('d', pathData);
      path.setAttribute('fill', fillColor);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', strokeWidth.toString());
      group.appendChild(path);
      return group;
    }

    // New design: Circle at origin + horizontal arrow extending upward
    // The arrow extends into negative Y space (above the element's bounding box)
    const circleRadius = Math.max(3, Math.min(height * 0.25, width * 0.15));
    const arrowThickness = Math.max(2, height * 0.15);
    const arrowHeadSize = Math.max(4, height * 0.3);

    // Upward extension amount (how far the arrow goes above y=0)
    const upwardExtension = height * 0.6;

    // Circle position (at the bottom, center of element width for origin point)
    const circleX = isForward ? circleRadius + 2 : width - circleRadius - 2;
    const circleY = height - circleRadius - 2;

    // Create the circle at the origin
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', circleX);
    circle.setAttribute('cy', circleY);
    circle.setAttribute('r', circleRadius);
    circle.setAttribute('fill', fillColor);
    circle.setAttribute('stroke', strokeColor);
    circle.setAttribute('stroke-width', strokeWidth.toString());
    group.appendChild(circle);

    // Create the arrow line (horizontal with arrowhead)
    // Arrow starts from circle, goes up briefly, then horizontally to the arrowhead
    const arrowPath = document.createElementNS(SVG_NS, 'path');
    const arrowY = -upwardExtension + height * 0.5; // Y position of arrow (extends upward)

    let arrowPathData;
    if (isForward) {
      // Arrow pointing right
      const arrowStartX = circleX;
      const arrowEndX = width - 2;

      arrowPathData = `
                M ${arrowStartX} ${circleY - circleRadius}
                L ${arrowStartX} ${arrowY}
                L ${arrowEndX - arrowHeadSize} ${arrowY}
                L ${arrowEndX - arrowHeadSize} ${arrowY - arrowHeadSize / 2}
                L ${arrowEndX} ${arrowY + arrowThickness / 2}
                L ${arrowEndX - arrowHeadSize} ${arrowY + arrowThickness + arrowHeadSize / 2}
                L ${arrowEndX - arrowHeadSize} ${arrowY + arrowThickness}
                L ${arrowStartX + arrowThickness} ${arrowY + arrowThickness}
                L ${arrowStartX + arrowThickness} ${circleY - circleRadius}
                Z
            `;
    } else {
      // Arrow pointing left
      const arrowStartX = circleX;
      const arrowEndX = 2;

      arrowPathData = `
                M ${arrowStartX} ${circleY - circleRadius}
                L ${arrowStartX} ${arrowY}
                L ${arrowEndX + arrowHeadSize} ${arrowY}
                L ${arrowEndX + arrowHeadSize} ${arrowY - arrowHeadSize / 2}
                L ${arrowEndX} ${arrowY + arrowThickness / 2}
                L ${arrowEndX + arrowHeadSize} ${arrowY + arrowThickness + arrowHeadSize / 2}
                L ${arrowEndX + arrowHeadSize} ${arrowY + arrowThickness}
                L ${arrowStartX - arrowThickness} ${arrowY + arrowThickness}
                L ${arrowStartX - arrowThickness} ${circleY - circleRadius}
                Z
            `;
    }

    arrowPath.setAttribute('d', arrowPathData);
    arrowPath.setAttribute('fill', fillColor);
    arrowPath.setAttribute('stroke', strokeColor);
    arrowPath.setAttribute('stroke-width', strokeWidth.toString());
    arrowPath.setAttribute('stroke-linejoin', 'round');
    group.appendChild(arrowPath);

    return group;
  }

  /**
   * Create terminator shape - T-shaped stem-loop/hairpin design.
   * Design: A T-shaped form with a stem and a loop/ball at top,
   * representing transcription termination.
   * @param {number}  width
   * @param {number}  height
   * @param {string}  gradientId
   * @param {Object}  operonInfo
   * @param {boolean} isLeftTruncated
   * @param {boolean} isRightTruncated
   * @param {boolean} isForward
   * @param {number}  [strokeWidth=1] - Zoom-based stroke width
   * @returns {SVGGElement}
   */
  static createTerminatorShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute(
      'class',
      `gene-terminator ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    // Red color scheme for terminator (matching reference)
    const fillColor = '#ef4444'; // Red
    const strokeColor = '#b91c1c'; // Darker red

    if (isLeftTruncated || isRightTruncated) {
      // For truncated terminators, use simplified jagged shape
      const path = document.createElementNS(SVG_NS, 'path');
      let pathData;
      if (isLeftTruncated) {
        pathData = GeneShapeCreators.createJaggedTerminatorPath(width, height, true, false);
      } else {
        pathData = GeneShapeCreators.createJaggedTerminatorPath(width, height, false, true);
      }
      path.setAttribute('d', pathData);
      path.setAttribute('fill', fillColor);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', strokeWidth.toString());
      group.appendChild(path);
      return group;
    }

    // New design: Lollipop shape (vertical stem + filled circle at top)
    // The element extends into negative Y space (above the element's bounding box)
    const stemWidth = Math.max(2, width * 0.15);
    const circleRadius = Math.max(3, Math.min(height * 0.3, width * 0.25));

    // Upward extension amount
    const upwardExtension = height * 0.6;

    // Stem position (center of element width)
    const centerX = width / 2;
    const stemBottom = height - 2;
    const stemTop = -upwardExtension + circleRadius + 2; // Top of stem, leaving room for circle

    // Create the vertical stem
    const stem = document.createElementNS(SVG_NS, 'rect');
    stem.setAttribute('x', centerX - stemWidth / 2);
    stem.setAttribute('y', stemTop);
    stem.setAttribute('width', stemWidth);
    stem.setAttribute('height', stemBottom - stemTop);
    stem.setAttribute('fill', fillColor);
    stem.setAttribute('stroke', strokeColor);
    stem.setAttribute('stroke-width', strokeWidth.toString());
    group.appendChild(stem);

    // Create the circle at the top
    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', centerX);
    circle.setAttribute('cy', stemTop - circleRadius + 2);
    circle.setAttribute('r', circleRadius);
    circle.setAttribute('fill', fillColor);
    circle.setAttribute('stroke', strokeColor);
    circle.setAttribute('stroke-width', strokeWidth.toString());
    group.appendChild(circle);

    return group;
  }

  /**
   * Create regulatory shape (diamond/rhombus).
   * @param {Object}  self            - TrackRenderer instance (for self.darkenColor)
   * @param {number}  width
   * @param {number}  height
   * @param {string}  gradientId
   * @param {Object}  operonInfo
   * @param {boolean} isLeftTruncated
   * @param {boolean} isRightTruncated
   * @param {boolean} isForward
   * @param {number}  [strokeWidth=1] - Zoom-based stroke width
   * @returns {SVGPathElement}
   */
  static createRegulatoryShape(
    self,
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const path = document.createElementNS(SVG_NS, 'path');
    let pathData;

    if (isLeftTruncated) {
      pathData = GeneShapeCreators.createJaggedRegulatoryPath(width, height, true, false);
    } else if (isRightTruncated) {
      pathData = GeneShapeCreators.createJaggedRegulatoryPath(width, height, false, true);
    } else {
      // Diamond shape
      pathData = `M ${width / 2} 0
                       L ${width} ${height / 2}
                       L ${width / 2} ${height}
                       L 0 ${height / 2} Z`;
    }

    path.setAttribute('d', pathData);
    path.setAttribute('fill', `url(#${gradientId})`);

    // Use zoom-based stroke width (passed as parameter)
    if (strokeWidth > 0) {
      path.setAttribute('stroke', self.darkenColor(operonInfo.color, 20));
      path.setAttribute('stroke-width', strokeWidth.toString());
    } else {
      path.setAttribute('stroke', 'transparent');
      path.setAttribute('stroke-width', '0');
    }
    path.setAttribute(
      'class',
      `gene-regulatory ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );
    return path;
  }

  /**
   * Create repeat region shape (stacked capsules).
   * @param {number}  width
   * @param {number}  height
   * @param {string}  gradientId
   * @param {Object}  operonInfo
   * @param {boolean} isLeftTruncated
   * @param {boolean} isRightTruncated
   * @param {boolean} isForward
   * @param {number}  [strokeWidth=1] - Zoom-based stroke width
   * @returns {SVGGElement}
   */
  static createRepeatShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute(
      'class',
      `gene-repeat ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    // Colors from user request
    const fillColor = '#ef4444'; // Solid red
    const strokeColor = '#991b1b'; // Darker red stroke

    if (isLeftTruncated || isRightTruncated) {
      // Keep jagged edges for truncated repeats
      const path = document.createElementNS(SVG_NS, 'path');
      let pathData;

      if (isLeftTruncated) {
        pathData = GeneShapeCreators.createJaggedRepeatPath(width, height, true, false);
      } else {
        pathData = GeneShapeCreators.createJaggedRepeatPath(width, height, false, true);
      }

      path.setAttribute('d', pathData);
      path.setAttribute('fill', fillColor);

      if (strokeWidth > 0) {
        path.setAttribute('stroke', strokeColor);
        path.setAttribute('stroke-width', strokeWidth.toString());
      } else {
        path.setAttribute('stroke', 'transparent');
        path.setAttribute('stroke-width', '0');
      }
      group.appendChild(path);
    } else {
      // Stacked capsules design (3 stacked rounded rectangles)
      const capsuleCount = 3;
      // Add small spacing between capsules if height allows, otherwise stick together
      const spacing = height < 12 ? 0 : height / 20;
      const totalSpacing = spacing * (capsuleCount - 1);
      const capsuleHeight = (height - totalSpacing) / capsuleCount;
      const rx = capsuleHeight / 2; // Full rounding

      for (let i = 0; i < capsuleCount; i++) {
        const rect = document.createElementNS(SVG_NS, 'rect');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', i * (capsuleHeight + spacing));
        rect.setAttribute('width', width);
        rect.setAttribute('height', capsuleHeight);
        rect.setAttribute('rx', rx); // Rounded ends
        rect.setAttribute('ry', rx);

        rect.setAttribute('fill', fillColor);

        if (strokeWidth > 0) {
          rect.setAttribute('stroke', strokeColor);
          rect.setAttribute('stroke-width', strokeWidth.toString());
        } else {
          rect.setAttribute('stroke', 'transparent');
          rect.setAttribute('stroke-width', '0');
        }
        group.appendChild(rect);
      }
    }

    return group;
  }

  /**
   * Create tRNA shape - elegant rounded chevron design.
   * Design: A professional-looking rounded chevron that represents tRNA.
   * @param {number}  width
   * @param {number}  height
   * @param {string}  gradientId
   * @param {Object}  operonInfo
   * @param {boolean} isLeftTruncated
   * @param {boolean} isRightTruncated
   * @param {boolean} isForward
   * @param {number}  [strokeWidth=1] - Zoom-based stroke width
   * @returns {SVGGElement}
   */
  static createTRNAShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute(
      'class',
      `gene-trna ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    // Use tRNA-specific colors - vibrant lime green (different from rRNA's emerald)
    const fillColor = '#65a30d'; // Lime green for tRNA
    const fillColorLight = '#a3e635'; // Lighter lime for gradient
    const strokeColor = '#4d7c0f'; // Darker lime stroke

    // Create gradient definition for depth
    const defs = document.createElementNS(SVG_NS, 'defs');
    const gradId = `trna-grad-${Math.random().toString(36).substr(2, 9)}`;
    const gradient = document.createElementNS(SVG_NS, 'linearGradient');
    gradient.setAttribute('id', gradId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS(SVG_NS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', fillColorLight);

    const stop2 = document.createElementNS(SVG_NS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', fillColor);

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    group.appendChild(defs);

    // Calculate shape dimensions with proper padding
    const verticalPadding = height * 0.1;
    const shapeHeight = height - verticalPadding * 2;
    const shapeY = verticalPadding;
    const cornerRadius = Math.min(shapeHeight / 3, 6);

    // Chevron indent (pointing inward from the side)
    const chevronIndent = Math.min(width * 0.12, 8);

    if (isLeftTruncated || isRightTruncated) {
      // For truncated tRNA, use clean zigzag edges
      const path = document.createElementNS(SVG_NS, 'path');
      const zigzagDepth = Math.min(3, height * 0.12);
      const zigzagCount = 3;
      const zigzagStep = shapeHeight / zigzagCount;

      let pathData;
      if (isLeftTruncated) {
        // Left edge has clean zigzag, right edge is chevron
        pathData = `M ${zigzagDepth} ${shapeY}`;
        for (let i = 0; i < zigzagCount; i++) {
          const y = shapeY + zigzagStep * i;
          pathData += ` L 0 ${y + zigzagStep / 2}`;
          pathData += ` L ${zigzagDepth} ${y + zigzagStep}`;
        }
        pathData += ` L ${width - chevronIndent} ${shapeY + shapeHeight}`;
        pathData += ` L ${width} ${shapeY + shapeHeight / 2}`;
        pathData += ` L ${width - chevronIndent} ${shapeY}`;
        pathData += ` Z`;
      } else {
        // Right edge has clean zigzag, left edge is chevron
        pathData = `M ${chevronIndent} ${shapeY}`;
        pathData += ` L ${width - zigzagDepth} ${shapeY}`;
        for (let i = 0; i < zigzagCount; i++) {
          const y = shapeY + zigzagStep * i;
          pathData += ` L ${width} ${y + zigzagStep / 2}`;
          pathData += ` L ${width - zigzagDepth} ${y + zigzagStep}`;
        }
        pathData += ` L ${chevronIndent} ${shapeY + shapeHeight}`;
        pathData += ` L 0 ${shapeY + shapeHeight / 2}`;
        pathData += ` Z`;
      }

      path.setAttribute('d', pathData);
      path.setAttribute('fill', `url(#${gradId})`);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', strokeWidth.toString());
      path.setAttribute('stroke-linejoin', 'round');
      group.appendChild(path);
    } else {
      // Full chevron/hexagon shape
      const path = document.createElementNS(SVG_NS, 'path');

      // Create a hexagon-like chevron shape (pointed on both ends if wide enough)
      let pathData;
      if (width > 20) {
        // Wide enough for proper chevron on both sides
        pathData = `M ${chevronIndent} ${shapeY}
                           L ${width - chevronIndent} ${shapeY}
                           L ${width} ${shapeY + shapeHeight / 2}
                           L ${width - chevronIndent} ${shapeY + shapeHeight}
                           L ${chevronIndent} ${shapeY + shapeHeight}
                           L 0 ${shapeY + shapeHeight / 2}
                           Z`;
      } else {
        // Narrow - just use rounded rectangle with chevron on right
        pathData = `M ${cornerRadius} ${shapeY}
                           L ${width - chevronIndent} ${shapeY}
                           L ${width} ${shapeY + shapeHeight / 2}
                           L ${width - chevronIndent} ${shapeY + shapeHeight}
                           L ${cornerRadius} ${shapeY + shapeHeight}
                           Q 0 ${shapeY + shapeHeight} 0 ${shapeY + shapeHeight - cornerRadius}
                           L 0 ${shapeY + cornerRadius}
                           Q 0 ${shapeY} ${cornerRadius} ${shapeY}
                           Z`;
      }

      path.setAttribute('d', pathData);
      path.setAttribute('fill', `url(#${gradId})`);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', strokeWidth.toString());
      path.setAttribute('stroke-linejoin', 'round');
      group.appendChild(path);
    }

    // Add a small decorative circle at the pointed end when wide enough
    if (width > 40 && height > 10) {
      const dotRadius = Math.min(height * 0.12, 3);
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', (width - chevronIndent - dotRadius - 2).toString());
      dot.setAttribute('cy', (height / 2).toString());
      dot.setAttribute('r', dotRadius.toString());
      dot.setAttribute('fill', fillColorLight);
      dot.setAttribute('opacity', '0.6');
      group.appendChild(dot);
    }

    return group;
  }

  /**
   * Create rRNA shape - elegant capsule/pill design with decorative stripes.
   * Design: A professional-looking rounded capsule that clearly differentiates rRNA.
   * @param {number}  width
   * @param {number}  height
   * @param {string}  gradientId
   * @param {Object}  operonInfo
   * @param {boolean} isLeftTruncated
   * @param {boolean} isRightTruncated
   * @param {boolean} isForward
   * @param {number}  [strokeWidth=1] - Zoom-based stroke width
   * @returns {SVGGElement}
   */
  static createRRNAShape(
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute(
      'class',
      `gene-rrna ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    // Use rRNA-specific colors - elegant emerald green
    const fillColor = '#059669'; // Emerald green for rRNA
    const fillColorLight = '#34d399'; // Lighter emerald for gradient
    const strokeColor = '#047857'; // Darker emerald stroke
    const stripeColor = '#10b981'; // Stripe accent color

    // Create gradient definition for depth
    const defs = document.createElementNS(SVG_NS, 'defs');
    const gradId = `rrna-grad-${Math.random().toString(36).substr(2, 9)}`;
    const gradient = document.createElementNS(SVG_NS, 'linearGradient');
    gradient.setAttribute('id', gradId);
    gradient.setAttribute('x1', '0%');
    gradient.setAttribute('y1', '0%');
    gradient.setAttribute('x2', '0%');
    gradient.setAttribute('y2', '100%');

    const stop1 = document.createElementNS(SVG_NS, 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('stop-color', fillColorLight);

    const stop2 = document.createElementNS(SVG_NS, 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('stop-color', fillColor);

    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    group.appendChild(defs);

    // Calculate capsule dimensions with proper padding
    const verticalPadding = height * 0.1;
    const capsuleHeight = height - verticalPadding * 2;
    const capsuleY = verticalPadding;
    const cornerRadius = Math.min(capsuleHeight / 2, 8);

    if (isLeftTruncated || isRightTruncated) {
      // For truncated rRNA, use clean zigzag edges instead of ugly jagged
      const path = document.createElementNS(SVG_NS, 'path');
      const zigzagDepth = Math.min(3, height * 0.12);
      const zigzagCount = 3;
      const zigzagStep = capsuleHeight / zigzagCount;

      let pathData;
      if (isLeftTruncated) {
        // Left edge has clean zigzag, right edge is rounded
        pathData = `M ${zigzagDepth} ${capsuleY}`;
        for (let i = 0; i < zigzagCount; i++) {
          const y = capsuleY + zigzagStep * i;
          pathData += ` L 0 ${y + zigzagStep / 2}`;
          pathData += ` L ${zigzagDepth} ${y + zigzagStep}`;
        }
        pathData += ` L ${width - cornerRadius} ${capsuleY + capsuleHeight}`;
        pathData += ` Q ${width} ${capsuleY + capsuleHeight} ${width} ${capsuleY + capsuleHeight - cornerRadius}`;
        pathData += ` L ${width} ${capsuleY + cornerRadius}`;
        pathData += ` Q ${width} ${capsuleY} ${width - cornerRadius} ${capsuleY}`;
        pathData += ` Z`;
      } else {
        // Right edge has clean zigzag, left edge is rounded
        pathData = `M ${cornerRadius} ${capsuleY}`;
        pathData += ` L ${width - zigzagDepth} ${capsuleY}`;
        for (let i = 0; i < zigzagCount; i++) {
          const y = capsuleY + zigzagStep * i;
          pathData += ` L ${width} ${y + zigzagStep / 2}`;
          pathData += ` L ${width - zigzagDepth} ${y + zigzagStep}`;
        }
        pathData += ` L ${cornerRadius} ${capsuleY + capsuleHeight}`;
        pathData += ` Q 0 ${capsuleY + capsuleHeight} 0 ${capsuleY + capsuleHeight - cornerRadius}`;
        pathData += ` L 0 ${capsuleY + cornerRadius}`;
        pathData += ` Q 0 ${capsuleY} ${cornerRadius} ${capsuleY}`;
        pathData += ` Z`;
      }

      path.setAttribute('d', pathData);
      path.setAttribute('fill', `url(#${gradId})`);
      path.setAttribute('stroke', strokeColor);
      path.setAttribute('stroke-width', strokeWidth.toString());
      group.appendChild(path);
    } else {
      // Full capsule/pill shape with rounded ends
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', capsuleY.toString());
      rect.setAttribute('width', width.toString());
      rect.setAttribute('height', capsuleHeight.toString());
      rect.setAttribute('rx', cornerRadius.toString());
      rect.setAttribute('ry', cornerRadius.toString());
      rect.setAttribute('fill', `url(#${gradId})`);
      rect.setAttribute('stroke', strokeColor);
      rect.setAttribute('stroke-width', strokeWidth.toString());
      group.appendChild(rect);
    }

    // Add decorative horizontal stripes for visual distinction (if wide enough)
    if (width > 30 && height > 8) {
      const stripeCount = 2;
      const stripeSpacing = capsuleHeight / (stripeCount + 1);
      const stripeWidth = Math.min(width * 0.7, width - 10);
      const stripeX = (width - stripeWidth) / 2;

      for (let i = 1; i <= stripeCount; i++) {
        const stripe = document.createElementNS(SVG_NS, 'line');
        const stripeY = capsuleY + stripeSpacing * i;
        stripe.setAttribute('x1', stripeX.toString());
        stripe.setAttribute('y1', stripeY.toString());
        stripe.setAttribute('x2', (stripeX + stripeWidth).toString());
        stripe.setAttribute('y2', stripeY.toString());
        stripe.setAttribute('stroke', stripeColor);
        stripe.setAttribute('stroke-width', Math.max(1, height * 0.08).toString());
        stripe.setAttribute('stroke-linecap', 'round');
        stripe.setAttribute('opacity', '0.4');
        group.appendChild(stripe);
      }
    }

    return group;
  }

  /**
   * Create mRNA shape (wavy line/sine wave).
   * @param {Object}  self            - TrackRenderer instance (for self.darkenColor)
   * @param {number}  width
   * @param {number}  height
   * @param {string}  gradientId
   * @param {Object}  operonInfo
   * @param {boolean} isLeftTruncated
   * @param {boolean} isRightTruncated
   * @param {boolean} isForward
   * @param {number}  [strokeWidth=1] - Zoom-based stroke width
   * @returns {SVGPathElement}
   */
  static createMRNAShape(
    self,
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const path = document.createElementNS(SVG_NS, 'path');
    let pathData;

    if (isLeftTruncated || isRightTruncated) {
      if (isLeftTruncated) {
        pathData = GeneShapeCreators.createJaggedRNAPath(width, height, true, false);
      } else {
        pathData = GeneShapeCreators.createJaggedRNAPath(width, height, false, true);
      }
    } else {
      // Sine wave shape
      const waveCount = Math.max(2, Math.floor(width / 10));
      const waveHeight = height * 0.3;
      const centerY = height / 2;

      pathData = `M 0 ${centerY}`;

      for (let i = 0; i <= waveCount * 4; i++) {
        const x = (i / (waveCount * 4)) * width;
        const y = centerY + Math.sin((i / waveCount) * Math.PI) * waveHeight;
        pathData += ` L ${x} ${y}`;
      }

      // Create filled shape by adding bottom path
      pathData += ` L ${width} ${centerY + waveHeight * 0.5}`;
      for (let i = waveCount * 4; i >= 0; i--) {
        const x = (i / (waveCount * 4)) * width;
        const y = centerY + Math.sin((i / waveCount) * Math.PI) * waveHeight * 0.5 + waveHeight * 0.25;
        pathData += ` L ${x} ${y}`;
      }
      pathData += ` Z`;
    }

    path.setAttribute('d', pathData);
    path.setAttribute('fill', `url(#${gradientId})`);

    // Use zoom-based stroke width (passed as parameter)
    if (strokeWidth > 0) {
      path.setAttribute('stroke', self.darkenColor(operonInfo.color, 20));
      path.setAttribute('stroke-width', strokeWidth.toString());
    } else {
      path.setAttribute('stroke', 'transparent');
      path.setAttribute('stroke-width', '0');
    }
    path.setAttribute(
      'class',
      `gene-mrna ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );
    return path;
  }

  /**
   * Create comment/note shape (speech bubble or annotation marker).
   * @param {Object}  self            - TrackRenderer instance (for self.darkenColor)
   * @param {number}  width
   * @param {number}  height
   * @param {string}  gradientId
   * @param {Object}  operonInfo
   * @param {boolean} isLeftTruncated
   * @param {boolean} isRightTruncated
   * @param {boolean} isForward
   * @param {number}  [strokeWidth=1] - Zoom-based stroke width
   * @returns {SVGGElement}
   */
  static createCommentShape(
    self,
    width,
    height,
    gradientId,
    operonInfo,
    isLeftTruncated,
    isRightTruncated,
    isForward,
    strokeWidth = 1
  ) {
    const group = document.createElementNS(SVG_NS, 'g');
    group.setAttribute(
      'class',
      `gene-comment ${isLeftTruncated ? 'left-truncated' : ''} ${isRightTruncated ? 'right-truncated' : ''}`
    );

    if (isLeftTruncated || isRightTruncated) {
      // For truncated comments, use simplified shape
      const path = document.createElementNS(SVG_NS, 'path');
      let pathData;

      if (isLeftTruncated) {
        pathData = GeneShapeCreators.createJaggedCommentPath(width, height, true, false);
      } else {
        pathData = GeneShapeCreators.createJaggedCommentPath(width, height, false, true);
      }

      path.setAttribute('d', pathData);
      path.setAttribute('fill', `url(#${gradientId})`);
      path.setAttribute('stroke', self.darkenColor(operonInfo.color, 20));
      path.setAttribute('stroke-width', strokeWidth.toString());
      group.appendChild(path);
      return group;
    }

    if (width < 15) {
      // Small comment - simple rounded rectangle with corner indicator
      const rect = document.createElementNS(SVG_NS, 'rect');
      rect.setAttribute('x', 0);
      rect.setAttribute('y', height * 0.1);
      rect.setAttribute('width', width);
      rect.setAttribute('height', height * 0.8);
      rect.setAttribute('rx', Math.min(3, width * 0.2));
      rect.setAttribute('ry', Math.min(3, height * 0.15));
      rect.setAttribute('fill', `url(#${gradientId})`);
      rect.setAttribute('stroke', self.darkenColor(operonInfo.color, 20));
      rect.setAttribute('stroke-width', strokeWidth.toString());

      // Small indicator dot
      const dot = document.createElementNS(SVG_NS, 'circle');
      dot.setAttribute('cx', width * 0.8);
      dot.setAttribute('cy', height * 0.8);
      dot.setAttribute('r', Math.min(2, width * 0.1));
      dot.setAttribute('fill', self.darkenColor(operonInfo.color, 30));

      group.appendChild(rect);
      group.appendChild(dot);
    } else {
      // Large comment - speech bubble shape
      const bubbleHeight = height * 0.7;
      const bubbleY = height * 0.1;
      const cornerRadius = Math.min(4, height * 0.15);
      const tailSize = Math.min(6, height * 0.2);

      // Main bubble body (rounded rectangle)
      const bubble = document.createElementNS(SVG_NS, 'rect');
      bubble.setAttribute('x', 0);
      bubble.setAttribute('y', bubbleY);
      bubble.setAttribute('width', width * 0.85);
      bubble.setAttribute('height', bubbleHeight);
      bubble.setAttribute('rx', cornerRadius);
      bubble.setAttribute('ry', cornerRadius);
      bubble.setAttribute('fill', `url(#${gradientId})`);
      bubble.setAttribute('stroke', self.darkenColor(operonInfo.color, 20));
      bubble.setAttribute('stroke-width', '1');

      // Speech bubble tail (small triangle pointing down-right)
      const tail = document.createElementNS(SVG_NS, 'path');
      const tailX = width * 0.75;
      const tailY = bubbleY + bubbleHeight;
      const tailPath = `M ${tailX} ${tailY}
                             L ${tailX + tailSize} ${tailY + tailSize}
                             L ${tailX + tailSize * 0.5} ${tailY} Z`;
      tail.setAttribute('d', tailPath);
      tail.setAttribute('fill', `url(#${gradientId})`);
      tail.setAttribute('stroke', self.darkenColor(operonInfo.color, 20));
      tail.setAttribute('stroke-width', '1');

      // Comment icon (three dots inside bubble)
      const dotSpacing = width * 0.15;
      const dotY = bubbleY + bubbleHeight * 0.5;
      const dotRadius = Math.min(1.5, height * 0.08);

      for (let i = 0; i < 3; i++) {
        const dot = document.createElementNS(SVG_NS, 'circle');
        dot.setAttribute('cx', width * 0.2 + i * dotSpacing);
        dot.setAttribute('cy', dotY);
        dot.setAttribute('r', dotRadius);
        dot.setAttribute('fill', self.darkenColor(operonInfo.color, 40));
        group.appendChild(dot);
      }

      group.appendChild(bubble);
      group.appendChild(tail);
    }

    return group;
  }

  // ---------------------------------------------------------------------------
  // Jagged / truncated-edge path generators (pure SVG, no TrackRenderer state)
  // ---------------------------------------------------------------------------

  /**
   * Create jagged path for truncated triangular genes.
   * @param {number}  width
   * @param {number}  height
   * @param {boolean} isLeftJagged
   * @param {boolean} isRightJagged
   * @param {boolean} isForward
   * @returns {string} SVG path data
   */
  static createJaggedTrianglePath(width, height, isLeftJagged, isRightJagged, isForward) {
    const jaggedDepth = Math.min(4, height * 0.2); // Depth of jagged cuts
    const jaggedStep = Math.max(2, height / 6); // Height of each jagged tooth
    const arrowSize = Math.max(8, Math.min(width * 0.3, height * 0.8)); // Dynamic arrow size

    if (isForward) {
      // Forward triangle (pointing right)
      if (isLeftJagged) {
        // Left edge (截断面) is jagged - vertical jagged line
        return `M ${jaggedDepth} 0
                       L 0 ${jaggedStep}
                       L ${jaggedDepth} ${jaggedStep * 2}
                       L 0 ${jaggedStep * 3}
                       L ${jaggedDepth} ${jaggedStep * 4}
                       L 0 ${height}
                       L ${width} ${height / 2}
                       L ${jaggedDepth} 0
                       Z`;
      } else if (isRightJagged) {
        // Right edge (截断面) is jagged - vertical jagged line
        return `M 0 0
                       L ${width - jaggedDepth} ${jaggedStep}
                       L ${width} 0
                       L ${width - jaggedDepth} ${jaggedStep * 2}
                       L ${width} ${jaggedStep * 3}
                       L ${width - jaggedDepth} ${jaggedStep * 4}
                       L ${width} ${height}
                       L 0 ${height}
                       Z`;
      }
    } else {
      // Reverse triangle (pointing left)
      if (isLeftJagged) {
        // Left edge (截断面) is jagged - vertical jagged line
        return `M ${jaggedDepth} 0
                       L 0 ${jaggedStep}
                       L ${jaggedDepth} ${jaggedStep * 2}
                       L 0 ${jaggedStep * 3}
                       L ${jaggedDepth} ${jaggedStep * 4}
                       L 0 ${height}
                       L ${width} ${height}
                       L ${width} 0
                       Z`;
      } else if (isRightJagged) {
        // Right edge (截断面) is jagged - vertical jagged line
        return `M ${arrowSize} 0
                       L ${width - jaggedDepth} 0
                       L ${width} ${jaggedStep}
                       L ${width - jaggedDepth} ${jaggedStep * 2}
                       L ${width} ${jaggedStep * 3}
                       L ${width - jaggedDepth} ${jaggedStep * 4}
                       L ${width} ${height}
                       L ${arrowSize} ${height}
                       L 0 ${height / 2}
                       Z`;
      }
    }

    // Fallback - return normal arrow if no jagged edges
    if (isForward) {
      return `M 0 0 L ${width - arrowSize} 0 L ${width} ${height / 2} L ${width - arrowSize} ${height} L 0 ${height} Z`;
    } else {
      return `M ${arrowSize} 0 L ${width} 0 L ${width} ${height} L ${arrowSize} ${height} L 0 ${height / 2} Z`;
    }
  }

  /**
   * Create jagged arrow path for truncated arrow-shaped genes.
   * @param {number}  width
   * @param {number}  height
   * @param {number}  arrowSize
   * @param {boolean} isLeftJagged
   * @param {boolean} isRightJagged
   * @param {boolean} isForward
   * @returns {string} SVG path data
   */
  static createJaggedArrowPath(width, height, arrowSize, isLeftJagged, isRightJagged, isForward) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);

    if (isForward) {
      // Forward arrow (pointing right)
      if (isLeftJagged) {
        // Left edge is jagged
        return `M ${jaggedDepth} 0
                       L 0 ${jaggedStep}
                       L ${jaggedDepth} ${jaggedStep * 2}
                       L 0 ${jaggedStep * 3}
                       L ${jaggedDepth} ${jaggedStep * 4}
                       L 0 ${height}
                       L ${width - arrowSize} ${height}
                       L ${width} ${height / 2}
                       L ${width - arrowSize} 0
                       L ${jaggedDepth} 0
                       Z`;
      } else if (isRightJagged) {
        // Right edge is completely jagged (no arrow tip for truncated genes)
        return `M 0 0
                       L ${width - jaggedDepth} 0
                       L ${width} ${jaggedStep}
                       L ${width - jaggedDepth} ${jaggedStep * 2}
                       L ${width} ${jaggedStep * 3}
                       L ${width - jaggedDepth} ${jaggedStep * 4}
                       L ${width} ${height}
                       L 0 ${height}
                       Z`;
      }
    } else {
      // Reverse arrow (pointing left)
      if (isLeftJagged) {
        // Left edge is completely jagged (no arrow tip for truncated genes)
        return `M ${jaggedDepth} 0
                       L 0 ${jaggedStep}
                       L ${jaggedDepth} ${jaggedStep * 2}
                       L 0 ${jaggedStep * 3}
                       L ${jaggedDepth} ${jaggedStep * 4}
                       L 0 ${height}
                       L ${width} ${height}
                       L ${width} 0
                       Z`;
      } else if (isRightJagged) {
        // Right edge is jagged
        return `M ${arrowSize} 0
                       L ${width - jaggedDepth} 0
                       L ${width} ${jaggedStep}
                       L ${width - jaggedDepth} ${jaggedStep * 2}
                       L ${width} ${jaggedStep * 3}
                       L ${width - jaggedDepth} ${jaggedStep * 4}
                       L ${width} ${height}
                       L ${arrowSize} ${height}
                       L 0 ${height / 2}
                       Z`;
      }
    }

    // Fallback - return normal arrow
    if (isForward) {
      return `M 0 0 L ${width - arrowSize} 0 L ${width} ${height / 2} L ${width - arrowSize} ${height} L 0 ${height} Z`;
    } else {
      return `M ${arrowSize} 0 L ${width} 0 L ${width} ${height} L ${arrowSize} ${height} L 0 ${height / 2} Z`;
    }
  }

  /**
   * Jagged edge path for truncated promoter shapes.
   * @param {number}  width
   * @param {number}  height
   * @param {boolean} isLeftJagged
   * @param {boolean} isRightJagged
   * @param {boolean} isForward
   * @returns {string} SVG path data
   */
  static createJaggedPromoterPath(width, height, isLeftJagged, isRightJagged, isForward) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);
    const flagHeight = height * 0.6;

    if (isLeftJagged) {
      return `M ${jaggedDepth} ${height}
                   L 0 ${height - jaggedStep}
                   L ${jaggedDepth} ${height - jaggedStep * 2}
                   L 0 ${height - jaggedStep * 3}
                   L ${jaggedDepth} ${height - flagHeight}
                   L ${width * 0.8} ${height - flagHeight}
                   L ${width} ${height - flagHeight + height * 0.15}
                   L ${width * 0.8} ${height - flagHeight + height * 0.3}
                   L ${jaggedDepth} ${height - flagHeight + height * 0.3}
                   L ${jaggedDepth} ${height} Z`;
    } else {
      return `M 0 ${height}
                   L 0 ${height - flagHeight}
                   L ${width * 0.8} ${height - flagHeight}
                   L ${width} ${height - flagHeight + height * 0.15}
                   L ${width * 0.8} ${height - flagHeight + height * 0.3}
                   L 0 ${height - flagHeight + height * 0.3}
                   L 0 ${height} Z`;
    }
  }

  /**
   * Jagged edge path for truncated terminator shapes.
   * @param {number}  width
   * @param {number}  height
   * @param {boolean} isLeftJagged
   * @param {boolean} isRightJagged
   * @returns {string} SVG path data
   */
  static createJaggedTerminatorPath(width, height, isLeftJagged, isRightJagged) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);
    const stemWidth = Math.max(4, width * 0.2);
    const barHeight = height * 0.3;

    if (isLeftJagged) {
      return `M ${jaggedDepth} 0
                   L 0 ${jaggedStep}
                   L ${jaggedDepth} ${jaggedStep * 2}
                   L 0 ${jaggedStep * 3}
                   L ${jaggedDepth} ${barHeight}
                   L ${width / 2 - stemWidth / 2} ${barHeight}
                   L ${width / 2 - stemWidth / 2} ${height}
                   L ${width / 2 + stemWidth / 2} ${height}
                   L ${width / 2 + stemWidth / 2} ${barHeight}
                   L ${width} ${barHeight}
                   L ${width} 0
                   L ${jaggedDepth} 0 Z`;
    } else {
      return `M 0 0
                   L ${width - jaggedDepth} 0
                   L ${width} ${jaggedStep}
                   L ${width - jaggedDepth} ${jaggedStep * 2}
                   L ${width} ${jaggedStep * 3}
                   L ${width - jaggedDepth} ${barHeight}
                   L ${width / 2 + stemWidth / 2} ${barHeight}
                   L ${width / 2 + stemWidth / 2} ${height}
                   L ${width / 2 - stemWidth / 2} ${height}
                   L ${width / 2 - stemWidth / 2} ${barHeight}
                   L 0 ${barHeight} Z`;
    }
  }

  /**
   * Jagged edge path for truncated regulatory (diamond) shapes.
   * @param {number}  width
   * @param {number}  height
   * @param {boolean} isLeftJagged
   * @param {boolean} isRightJagged
   * @returns {string} SVG path data
   */
  static createJaggedRegulatoryPath(width, height, isLeftJagged, isRightJagged) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);

    if (isLeftJagged) {
      return `M ${jaggedDepth} ${height * 0.2}
                   L 0 ${jaggedStep}
                   L ${jaggedDepth} ${jaggedStep * 2}
                   L 0 ${jaggedStep * 3}
                   L ${jaggedDepth} ${height * 0.8}
                   L ${width / 2} ${height}
                   L ${width} ${height / 2}
                   L ${width / 2} 0
                   L ${jaggedDepth} ${height * 0.2} Z`;
    } else {
      return `M ${width / 2} 0
                   L ${width - jaggedDepth} ${height * 0.2}
                   L ${width} ${jaggedStep}
                   L ${width - jaggedDepth} ${jaggedStep * 2}
                   L ${width} ${jaggedStep * 3}
                   L ${width - jaggedDepth} ${height * 0.8}
                   L ${width / 2} ${height}
                   L 0 ${height / 2} Z`;
    }
  }

  /**
   * Jagged edge path for truncated repeat region shapes.
   * @param {number}  width
   * @param {number}  height
   * @param {boolean} isLeftJagged
   * @param {boolean} isRightJagged
   * @returns {string} SVG path data
   */
  static createJaggedRepeatPath(width, height, isLeftJagged, isRightJagged) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);

    if (isLeftJagged) {
      return `M ${jaggedDepth} 0
                   L 0 ${jaggedStep}
                   L ${jaggedDepth} ${jaggedStep * 2}
                   L 0 ${jaggedStep * 3}
                   L ${jaggedDepth} ${jaggedStep * 4}
                   L 0 ${height}
                   L ${width} ${height}
                   L ${width} 0
                   L ${jaggedDepth} 0 Z`;
    } else {
      return `M 0 0
                   L ${width - jaggedDepth} 0
                   L ${width} ${jaggedStep}
                   L ${width - jaggedDepth} ${jaggedStep * 2}
                   L ${width} ${jaggedStep * 3}
                   L ${width - jaggedDepth} ${jaggedStep * 4}
                   L ${width} ${height}
                   L 0 ${height} Z`;
    }
  }

  /**
   * Jagged edge path for truncated mRNA/RNA shapes.
   * @param {number}  width
   * @param {number}  height
   * @param {boolean} isLeftJagged
   * @param {boolean} isRightJagged
   * @returns {string} SVG path data
   */
  static createJaggedRNAPath(width, height, isLeftJagged, isRightJagged) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);

    if (isLeftJagged) {
      return `M ${jaggedDepth} 0
                   L 0 ${jaggedStep}
                   L ${jaggedDepth} ${jaggedStep * 2}
                   L 0 ${jaggedStep * 3}
                   L ${jaggedDepth} ${jaggedStep * 4}
                   L 0 ${height}
                   L ${width} ${height}
                   L ${width} 0
                   L ${jaggedDepth} 0 Z`;
    } else {
      return `M 0 0
                   L ${width - jaggedDepth} 0
                   L ${width} ${jaggedStep}
                   L ${width - jaggedDepth} ${jaggedStep * 2}
                   L ${width} ${jaggedStep * 3}
                   L ${width - jaggedDepth} ${jaggedStep * 4}
                   L ${width} ${height}
                   L 0 ${height} Z`;
    }
  }

  /**
   * Jagged edge path for truncated comment/note shapes.
   * @param {number}  width
   * @param {number}  height
   * @param {boolean} isLeftJagged
   * @param {boolean} isRightJagged
   * @returns {string} SVG path data
   */
  static createJaggedCommentPath(width, height, isLeftJagged, isRightJagged) {
    const jaggedDepth = Math.min(4, height * 0.2);
    const jaggedStep = Math.max(2, height / 6);
    const bubbleHeight = height * 0.7;
    const bubbleY = height * 0.1;

    if (isLeftJagged) {
      return `M ${jaggedDepth} ${bubbleY}
                   L 0 ${bubbleY + jaggedStep}
                   L ${jaggedDepth} ${bubbleY + jaggedStep * 2}
                   L 0 ${bubbleY + jaggedStep * 3}
                   L ${jaggedDepth} ${bubbleY + bubbleHeight}
                   L ${width * 0.85} ${bubbleY + bubbleHeight}
                   L ${width * 0.85} ${bubbleY}
                   L ${jaggedDepth} ${bubbleY} Z`;
    } else {
      return `M 0 ${bubbleY}
                   L ${width * 0.85 - jaggedDepth} ${bubbleY}
                   L ${width * 0.85} ${bubbleY + jaggedStep}
                   L ${width * 0.85 - jaggedDepth} ${bubbleY + jaggedStep * 2}
                   L ${width * 0.85} ${bubbleY + jaggedStep * 3}
                   L ${width * 0.85 - jaggedDepth} ${bubbleY + bubbleHeight}
                   L 0 ${bubbleY + bubbleHeight}
                   L 0 ${bubbleY} Z`;
    }
  }

  // ---------------------------------------------------------------------------
  // Text label helpers
  // ---------------------------------------------------------------------------

  /**
   * Create SVG text label for gene with advanced anti-stretch protection.
   * @param {Object} self     - TrackRenderer instance (for self.genomeBrowser)
   * @param {Object} gene     - Gene data object
   * @param {number} width    - Available width in px
   * @param {number} height   - Available height in px
   * @param {Object} settings - Rendering settings object
   * @returns {SVGGElement|null}
   */
  static createSVGGeneText(self, gene, width, height, settings) {
    const geneName =
      self.genomeBrowser.getQualifierValue(gene.qualifiers, 'gene') ||
      self.genomeBrowser.getQualifierValue(gene.qualifiers, 'locus_tag') ||
      self.genomeBrowser.getQualifierValue(gene.qualifiers, 'product') ||
      gene.type;

    // Use fixed font size to prevent stretching, with reasonable scaling
    const baseFontSize = settings?.fontSize || 11;
    const maxFontSize = Math.min(baseFontSize, height * 0.7);
    const minFontSize = 8;
    const fontSize = Math.max(minFontSize, Math.min(maxFontSize, baseFontSize));

    // Smart text truncation based on available width and font size
    let displayText = geneName;
    const estimatedCharWidth = fontSize * 0.6; // Approximate character width
    const maxChars = Math.floor(width / estimatedCharWidth);

    if (geneName.length > maxChars && maxChars > 3) {
      displayText = geneName.substring(0, maxChars - 3) + '...';
    } else if (maxChars <= 3) {
      displayText = '...';
    }

    // Create a transform group to isolate text from SVG stretching
    const textGroup = document.createElementNS(SVG_NS, 'g');
    textGroup.setAttribute('class', 'svg-text-protected');

    // Add resize-resistant attributes
    textGroup.setAttribute('data-original-width', width);
    textGroup.setAttribute('data-original-height', height);
    textGroup.setAttribute('data-gene-name', geneName);

    // Create text element with fixed sizing
    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', width / 2);
    text.setAttribute('y', height / 2);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', `${fontSize}px`); // Use px for consistent sizing
    text.setAttribute('font-family', settings?.fontFamily || 'Arial, sans-serif');
    text.setAttribute('font-weight', '500'); // Slightly bold for better readability
    text.setAttribute('fill', settings?.geneNameColor || '#333333');
    text.setAttribute('pointer-events', 'none');

    // Enhanced protection against stretching
    text.style.vectorEffect = 'non-scaling-stroke';
    text.style.transformOrigin = 'center';
    text.style.transform = 'scale(1, 1)'; // Force 1:1 aspect ratio

    // Additional resize protection attributes
    text.setAttribute('data-original-font-size', fontSize);
    text.setAttribute('data-resize-protected', 'true');

    text.textContent = displayText;
    textGroup.appendChild(text);

    return textGroup;
  }

  /**
   * Update SVG text elements to handle window resize properly.
   * This method recalculates text sizes and positions after resize.
   * @param {SVGElement} svgContainer   - The SVG container element
   * @param {number}     containerWidth - New container width
   */
  static updateSVGTextForResize(svgContainer, containerWidth) {
    if (!svgContainer) return;

    const textElements = svgContainer.querySelectorAll('text[data-resize-protected="true"]');

    textElements.forEach(textElement => {
      const originalFontSize = parseFloat(textElement.getAttribute('data-original-font-size'));
      const geneGroup = textElement.closest('g.svg-gene-element');

      if (geneGroup && originalFontSize) {
        // Get the current transform to understand positioning
        const transform = geneGroup.getAttribute('transform');
        if (transform) {
          const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
          if (translateMatch) {
            const x = parseFloat(translateMatch[1]);
            const y = parseFloat(translateMatch[2]);

            // Recalculate text positioning based on new container width
            const textGroup = textElement.parentElement;
            const originalWidth = parseFloat(textGroup.getAttribute('data-original-width'));
            const originalHeight = parseFloat(textGroup.getAttribute('data-original-height'));

            if (originalWidth && originalHeight) {
              // Update text position within its group
              textElement.setAttribute('x', originalWidth / 2);
              textElement.setAttribute('y', originalHeight / 2);

              // Maintain original font size to prevent stretching
              textElement.setAttribute('font-size', `${originalFontSize}px`);

              // Ensure transform protection is maintained
              textElement.style.vectorEffect = 'non-scaling-stroke';
              textElement.style.transform = 'scale(1, 1)';
            }
          }
        }
      }
    });

    console.log('🔤 Updated', textElements.length, 'SVG text elements for resize');
  }

  // ---------------------------------------------------------------------------
  // Interaction handlers
  // ---------------------------------------------------------------------------

  /**
   * Add interaction handlers to SVG gene element.
   * @param {Object}      self       - TrackRenderer instance (for genomeBrowser, viewport, event handlers)
   * @param {SVGGElement} geneGroup  - The SVG group element for the gene
   * @param {Object}      gene       - Gene data object
   * @param {Array}       operons    - Array of operon data
   * @param {Object}      operonInfo - Operon metadata for this gene
   * @param {number}      rowIndex   - Row index of the gene
   */
  static addSVGGeneInteraction(self, geneGroup, gene, operons, operonInfo, rowIndex) {
    // Add data attributes for reliable gene identification
    geneGroup.setAttribute('data-gene-start', gene.start);
    geneGroup.setAttribute('data-gene-end', gene.end);
    geneGroup.setAttribute('data-gene-type', gene.type);
    const geneNameAttr = self.genomeBrowser.getQualifierValue(gene.qualifiers, 'gene');
    if (geneNameAttr) {
      geneGroup.setAttribute('data-gene-name', geneNameAttr);
    }
    const locusTagAttr = self.genomeBrowser.getQualifierValue(gene.qualifiers, 'locus_tag');
    if (locusTagAttr) {
      geneGroup.setAttribute('data-locus-tag', locusTagAttr);
    }

    // Create comprehensive tooltip
    const geneName =
      self.genomeBrowser.getQualifierValue(gene.qualifiers, 'gene') ||
      self.genomeBrowser.getQualifierValue(gene.qualifiers, 'locus_tag') ||
      self.genomeBrowser.getQualifierValue(gene.qualifiers, 'product') ||
      gene.type;
    const geneInfo = `${geneName} (${gene.type})`;
    const positionInfo = `${gene.start}-${gene.end} (${gene.strand === -1 ? '-' : '+'} strand)`;
    const operonDisplay = operonInfo.isInOperon ? `\nOperon: ${operonInfo.operonName}` : '\nSingle gene';
    const rowInfo = `\nRow: ${rowIndex + 1}`;

    // Add truncation info for partially visible genes
    const viewport = self.getCurrentViewport();
    const isLeftTruncated = gene.start < viewport.start;
    const isRightTruncated = gene.end > viewport.end;
    let truncationInfo = '';

    if (isLeftTruncated && isRightTruncated) {
      truncationInfo = '\n⚠️ Gene extends beyond both edges of current view';
    } else if (isLeftTruncated) {
      truncationInfo = '\n⚠️ Gene extends beyond left edge of current view';
    } else if (isRightTruncated) {
      truncationInfo = '\n⚠️ Gene extends beyond right edge of current view';
    }

    // Add tooltip using title element
    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = `${geneInfo}\nPosition: ${positionInfo}${operonDisplay}${rowInfo}${truncationInfo}`;
    geneGroup.appendChild(title);

    // Add hover effects
    geneGroup.style.cursor = 'pointer';
    geneGroup.addEventListener('mouseenter', () => {
      geneGroup.style.opacity = '0.8';
      geneGroup.style.transform = geneGroup.getAttribute('transform') + ' scale(1.05)';
    });

    geneGroup.addEventListener('mouseleave', () => {
      geneGroup.style.opacity = '1';
      geneGroup.style.transform = geneGroup.getAttribute('transform');
    });

    // Add click handler
    geneGroup.addEventListener('click', () => {
      self.showGeneDetails(gene, operonInfo);
    });

    // Add right-click context menu for opening in new tab
    geneGroup.addEventListener('contextmenu', e => {
      e.preventDefault();
      self.showGeneContextMenu(e, gene);
    });

    // Handle selection state
    if (
      self.genomeBrowser.selectedGene &&
      self.genomeBrowser.selectedGene.gene &&
      self.genomeBrowser.selectedGene.gene.start === gene.start &&
      self.genomeBrowser.selectedGene.gene.end === gene.end &&
      self.genomeBrowser.selectedGene.gene.type === gene.type
    ) {
      geneGroup.setAttribute('class', geneGroup.getAttribute('class') + ' selected');
      geneGroup.style.filter = 'drop-shadow(0 0 6px rgba(0,100,200,0.8))';
    }
  }
}

module.exports = GeneShapeCreators;
