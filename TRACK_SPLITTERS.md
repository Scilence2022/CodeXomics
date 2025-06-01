# Track Splitters - Resizable Track Height System

## Overview

The Electron Genome Browser features an advanced track splitter system that allows users to dynamically adjust the height of individual tracks through an intuitive drag-and-drop interface. This system has been enhanced with improved accessibility, better visual feedback, and seamless integration with the modular architecture.

## ✨ Key Features

### **Interactive Resizing**
- **Drag-and-Drop Interface**: Click and drag splitters between tracks to adjust heights
- **Real-time Feedback**: Visual changes occur immediately during dragging
- **Smooth Animations**: Smooth transitions between height adjustments
- **Minimum Heights**: Intelligent constraints ensure tracks remain functional

### **Enhanced Accessibility**
- **Keyboard Navigation**: Tab to focus splitters, arrow keys to resize
- **Screen Reader Support**: Proper ARIA labels and descriptions
- **Focus Indicators**: Clear visual focus states for keyboard users
- **Accessible Controls**: Space bar to reset to default height

### **Professional Visual Design**
- **Resize Cursors**: Clear visual indication of interactive areas
- **Hover Effects**: Subtle highlighting on mouse hover
- **Active States**: Visual feedback during dragging operations
- **Status Indicators**: Height values displayed during adjustment

## 🎯 User Interface

### **Visual Elements**
```css
.track-splitter {
    height: 8px;
    background: linear-gradient(to right, #e0e0e0, #f0f0f0, #e0e0e0);
    border: 1px solid #ccc;
    cursor: ns-resize;
    position: relative;
    transition: background-color 0.2s;
}

.track-splitter:hover {
    background: linear-gradient(to right, #d0d0d0, #e0e0e0, #d0d0d0);
    border-color: #999;
}

.track-splitter:focus {
    outline: 2px solid #2196f3;
    outline-offset: 1px;
}

.track-splitter.dragging {
    background: linear-gradient(to right, #2196f3, #42a5f5, #2196f3);
    border-color: #1976d2;
}
```

### **Splitter Placement**
Splitters are automatically inserted between visible tracks:
- **Between Gene and Sequence tracks**
- **Between Sequence and GC Content tracks**
- **Between GC Content and Variant tracks**
- **Between Variant and Reads tracks**
- **Between Reads and Protein tracks**

### **Height Constraints**
Each track type has intelligent minimum and maximum height limits:

| Track Type | Minimum Height | Default Height | Maximum Height |
|------------|---------------|----------------|----------------|
| **Gene Track** | 60px | 120px | 400px |
| **Sequence Track** | 20px | 30px | 100px |
| **GC Content** | 80px | 144px | 300px |
| **Variant Track** | 40px | 80px | 200px |
| **Reads Track** | 100px | 150px | 500px |
| **Protein Track** | 60px | 100px | 250px |

## 🔧 Technical Implementation

### **Core Splitter Class**
```javascript
class TrackSplitter {
    constructor(topTrack, bottomTrack, genomeBrowser) {
        this.topTrack = topTrack;
        this.bottomTrack = bottomTrack;
        this.genomeBrowser = genomeBrowser;
        this.isDragging = false;
        this.startY = 0;
        this.startTopHeight = 0;
        this.startBottomHeight = 0;
        
        this.createSplitterElement();
        this.attachEventListeners();
    }
    
    createSplitterElement() {
        this.element = document.createElement('div');
        this.element.className = 'track-splitter';
        this.element.tabIndex = 0;
        this.element.setAttribute('aria-label', 
            `Resize splitter between ${this.topTrack.name} and ${this.bottomTrack.name}`);
        this.element.setAttribute('role', 'separator');
        this.element.setAttribute('aria-orientation', 'horizontal');
        
        // Insert between tracks
        this.bottomTrack.element.parentNode.insertBefore(
            this.element, 
            this.bottomTrack.element
        );
    }
}
```

### **Enhanced Drag Handling**
```javascript
attachEventListeners() {
    // Mouse events
    this.element.addEventListener('mousedown', this.startDrag.bind(this));
    document.addEventListener('mousemove', this.drag.bind(this));
    document.addEventListener('mouseup', this.endDrag.bind(this));
    
    // Keyboard events for accessibility
    this.element.addEventListener('keydown', this.handleKeyboard.bind(this));
    
    // Touch events for mobile support
    this.element.addEventListener('touchstart', this.startTouch.bind(this));
    this.element.addEventListener('touchmove', this.handleTouch.bind(this));
    this.element.addEventListener('touchend', this.endTouch.bind(this));
    
    // Focus events
    this.element.addEventListener('focus', this.onFocus.bind(this));
    this.element.addEventListener('blur', this.onBlur.bind(this));
}

startDrag(event) {
    event.preventDefault();
    this.isDragging = true;
    this.startY = event.clientY;
    this.startTopHeight = this.topTrack.element.offsetHeight;
    this.startBottomHeight = this.bottomTrack.element.offsetHeight;
    
    this.element.classList.add('dragging');
    document.body.style.cursor = 'ns-resize';
    
    // Show height indicators
    this.showHeightIndicators();
}

drag(event) {
    if (!this.isDragging) return;
    
    const deltaY = event.clientY - this.startY;
    const newTopHeight = this.startTopHeight + deltaY;
    const newBottomHeight = this.startBottomHeight - deltaY;
    
    // Apply constraints
    const constrainedHeights = this.applyConstraints(newTopHeight, newBottomHeight);
    
    // Update track heights
    this.updateTrackHeights(constrainedHeights.top, constrainedHeights.bottom);
    
    // Update height indicators
    this.updateHeightIndicators(constrainedHeights.top, constrainedHeights.bottom);
}
```

### **Keyboard Accessibility**
```javascript
handleKeyboard(event) {
    const step = event.shiftKey ? 10 : 2; // Larger steps with Shift
    
    switch (event.key) {
        case 'ArrowUp':
            event.preventDefault();
            this.adjustHeight(-step);
            break;
        case 'ArrowDown':
            event.preventDefault();
            this.adjustHeight(step);
            break;
        case ' ': // Space bar
            event.preventDefault();
            this.resetToDefault();
            break;
        case 'Home':
            event.preventDefault();
            this.setToMinimum();
            break;
        case 'End':
            event.preventDefault();
            this.setToMaximum();
            break;
    }
}

adjustHeight(delta) {
    const currentTopHeight = this.topTrack.element.offsetHeight;
    const currentBottomHeight = this.bottomTrack.element.offsetHeight;
    
    const newTopHeight = currentTopHeight + delta;
    const newBottomHeight = currentBottomHeight - delta;
    
    const constrainedHeights = this.applyConstraints(newTopHeight, newBottomHeight);
    this.updateTrackHeights(constrainedHeights.top, constrainedHeights.bottom);
    
    // Announce change to screen readers
    this.announceHeightChange(constrainedHeights.top, constrainedHeights.bottom);
}
```

## 🎨 Visual Feedback System

### **Height Indicators**
During resizing operations, visual indicators show current track heights:

```javascript
showHeightIndicators() {
    this.topIndicator = this.createHeightIndicator(this.topTrack);
    this.bottomIndicator = this.createHeightIndicator(this.bottomTrack);
}

createHeightIndicator(track) {
    const indicator = document.createElement('div');
    indicator.className = 'height-indicator';
    indicator.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: rgba(33, 150, 243, 0.9);
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
        pointer-events: none;
        z-index: 1000;
    `;
    
    track.element.appendChild(indicator);
    return indicator;
}

updateHeightIndicators(topHeight, bottomHeight) {
    if (this.topIndicator) {
        this.topIndicator.textContent = `${Math.round(topHeight)}px`;
    }
    if (this.bottomIndicator) {
        this.bottomIndicator.textContent = `${Math.round(bottomHeight)}px`;
    }
}
```

### **Constraint System**
Intelligent constraints ensure tracks remain functional:

```javascript
applyConstraints(topHeight, bottomHeight) {
    const topConstraints = this.getTrackConstraints(this.topTrack.type);
    const bottomConstraints = this.getTrackConstraints(this.bottomTrack.type);
    
    // Apply minimum constraints first
    const constrainedTop = Math.max(topHeight, topConstraints.min);
    const constrainedBottom = Math.max(bottomHeight, bottomConstraints.min);
    
    // Apply maximum constraints
    const finalTop = Math.min(constrainedTop, topConstraints.max);
    const finalBottom = Math.min(constrainedBottom, bottomConstraints.max);
    
    // Ensure total height conservation if needed
    return this.conserveHeight(finalTop, finalBottom);
}

getTrackConstraints(trackType) {
    const constraints = {
        'gene': { min: 60, max: 400, default: 120 },
        'sequence': { min: 20, max: 100, default: 30 },
        'gc': { min: 80, max: 300, default: 144 },
        'variant': { min: 40, max: 200, default: 80 },
        'reads': { min: 100, max: 500, default: 150 },
        'protein': { min: 60, max: 250, default: 100 }
    };
    
    return constraints[trackType] || { min: 50, max: 200, default: 100 };
}
```

## 💾 State Persistence

### **Configuration Storage**
Track heights are automatically saved and restored:

```javascript
saveTrackHeights() {
    const heights = {};
    
    this.tracks.forEach(track => {
        heights[track.type] = {
            height: track.element.offsetHeight,
            visible: track.visible,
            order: track.order
        };
    });
    
    // Save to ConfigManager for persistence
    if (this.genomeBrowser.configManager) {
        this.genomeBrowser.configManager.set('ui.trackHeights', heights);
        this.genomeBrowser.configManager.saveConfig();
    } else {
        // Fallback to localStorage
        localStorage.setItem('trackHeights', JSON.stringify(heights));
    }
}

restoreTrackHeights() {
    let heights;
    
    if (this.genomeBrowser.configManager) {
        heights = this.genomeBrowser.configManager.get('ui.trackHeights');
    } else {
        const stored = localStorage.getItem('trackHeights');
        heights = stored ? JSON.parse(stored) : {};
    }
    
    if (heights) {
        this.tracks.forEach(track => {
            const config = heights[track.type];
            if (config && config.height) {
                track.element.style.height = `${config.height}px`;
            }
        });
    }
}
```

### **Reset Functionality**
Users can reset all tracks to default heights:

```javascript
resetAllTracksToDefault() {
    this.tracks.forEach(track => {
        const constraints = this.getTrackConstraints(track.type);
        track.element.style.height = `${constraints.default}px`;
    });
    
    this.saveTrackHeights();
    this.showNotification('Track heights reset to defaults');
}
```

## 📱 Mobile & Touch Support

### **Touch Events**
Full support for mobile devices:

```javascript
startTouch(event) {
    if (event.touches.length === 1) {
        const touch = event.touches[0];
        this.startDrag({
            clientY: touch.clientY,
            preventDefault: () => event.preventDefault()
        });
    }
}

handleTouch(event) {
    if (this.isDragging && event.touches.length === 1) {
        const touch = event.touches[0];
        this.drag({ clientY: touch.clientY });
    }
}

endTouch(event) {
    if (this.isDragging) {
        this.endDrag();
    }
}
```

### **Responsive Design**
Splitters adapt to different screen sizes:

```css
@media (max-width: 768px) {
    .track-splitter {
        height: 12px; /* Larger touch targets */
        min-height: 12px;
    }
    
    .height-indicator {
        font-size: 12px !important;
        padding: 4px 8px !important;
    }
}

@media (max-width: 480px) {
    .track-splitter {
        height: 16px; /* Even larger for small screens */
    }
}
```

## 🚀 Performance Optimization

### **Efficient Updates**
```javascript
updateTrackHeights(topHeight, bottomHeight) {
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
        this.topTrack.element.style.height = `${topHeight}px`;
        this.bottomTrack.element.style.height = `${bottomHeight}px`;
        
        // Trigger resize events for track content updates
        this.topTrack.onResize && this.topTrack.onResize(topHeight);
        this.bottomTrack.onResize && this.bottomTrack.onResize(bottomHeight);
    });
}
```

### **Debounced Saving**
```javascript
debouncedSave = this.debounce(() => {
    this.saveTrackHeights();
}, 300);

debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
```

## 🎮 User Experience Features

### **Keyboard Shortcuts**
| Key Combination | Action |
|----------------|--------|
| **Tab** | Focus next splitter |
| **Shift+Tab** | Focus previous splitter |
| **↑/↓** | Adjust height (2px steps) |
| **Shift+↑/↓** | Adjust height (10px steps) |
| **Space** | Reset to default height |
| **Home** | Set to minimum height |
| **End** | Set to maximum height |

### **Context Menu** (Right-click)
```javascript
showContextMenu(event) {
    const menu = [
        { label: 'Reset to Default', action: () => this.resetToDefault() },
        { label: 'Minimize', action: () => this.setToMinimum() },
        { label: 'Maximize', action: () => this.setToMaximum() },
        { separator: true },
        { label: 'Reset All Tracks', action: () => this.resetAllTracksToDefault() }
    ];
    
    this.showContextMenu(event.clientX, event.clientY, menu);
}
```

## 🛠️ Integration with Track System

### **Automatic Splitter Creation**
```javascript
// In TrackRenderer.js - enhanced with splitter support
createTrackWithSplitter(trackType, data) {
    const track = this.createTrackBase(trackType, data.chromosome);
    
    // Restore saved height
    const savedHeight = this.getSavedTrackHeight(trackType);
    if (savedHeight) {
        track.trackContent.style.height = `${savedHeight}px`;
    }
    
    // Add splitter if there's a previous track
    const previousTrack = this.getLastVisibleTrack();
    if (previousTrack) {
        const splitter = new TrackSplitter(previousTrack, track, this.genomeBrowser);
        this.splitters.push(splitter);
    }
    
    return track;
}
```

### **Track Visibility Integration**
```javascript
updateSplittersOnVisibilityChange() {
    // Remove splitters for hidden tracks
    this.splitters = this.splitters.filter(splitter => {
        if (!splitter.topTrack.visible || !splitter.bottomTrack.visible) {
            splitter.destroy();
            return false;
        }
        return true;
    });
    
    // Add splitters for newly adjacent tracks
    this.addMissingSplitters();
}
```

## 🧪 Testing & Quality Assurance

### **Cross-browser Compatibility**
- **Chrome/Chromium**: Full feature support
- **Firefox**: Complete compatibility with minor styling adjustments  
- **Safari**: Full support with webkit prefixes
- **Edge**: Complete feature parity

### **Accessibility Testing**
- **Screen reader compatibility** (NVDA, JAWS, VoiceOver)
- **Keyboard-only navigation** verification
- **High contrast mode** support
- **Focus management** testing

## 🔮 Future Enhancements

### **Planned Features**
- **Preset Layouts**: Save and restore custom height configurations
- **Animation Options**: Configurable animation speeds and styles
- **Advanced Constraints**: User-defined minimum and maximum heights
- **Gesture Support**: Multi-touch gestures for mobile devices

### **Advanced Functionality**
- **Proportional Resizing**: Maintain aspect ratios between tracks
- **Auto-sizing**: Automatic height adjustment based on content
- **Split Layouts**: Horizontal splitting for side-by-side comparisons
- **Snap-to-Grid**: Discrete height steps for consistent layouts

This track splitter system provides an intuitive and powerful way to customize the genome browser display, ensuring optimal use of screen space while maintaining excellent accessibility and user experience across all devices and interaction methods. 