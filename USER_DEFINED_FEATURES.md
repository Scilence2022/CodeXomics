# User-Defined Features System

## Overview

The Electron Genome Browser includes a comprehensive system for creating custom genomic annotations directly within the browser interface. This feature allows researchers to add their own annotations, notes, and feature types while maintaining visual distinction from loaded genome data.

## ✨ Key Features

### **Interactive Feature Creation**
- **Sequence Selection**: Click and drag in the sequence track to precisely select genomic regions
- **Toolbar Integration**: Quick access buttons for common feature types
- **Modal Interface**: Comprehensive form for detailed feature creation
- **Real-time Validation**: Instant feedback on position bounds and required fields

### **Comprehensive Feature Types**
- **Quick Access**: Gene, CDS, rRNA, tRNA, Comment/Note
- **Extended Types**: Promoter, Terminator, Regulatory, Signal Peptide, Repeat Region, Misc Feature, and Other
- **Custom Types**: Ability to specify custom feature types for specialized research

### **Visual Integration**
- **Distinctive Styling**: Dashed borders and green highlighting for user-created features
- **Edit Icon Overlay**: Small edit symbol indicating user-created annotations
- **Seamless Display**: User features integrated with existing genomic annotations
- **Strand Visualization**: Proper forward/reverse strand representation

## 🎯 Usage Workflow

### **Method 1: Sequence Selection (Recommended)**
```
1. Navigate to desired genomic region
2. Click and drag in the sequence track to select region
3. Choose feature type from "Add Features" toolbar
4. Modal opens with pre-populated coordinates
5. Fill in name, strand, and description
6. Click "Add Feature" to create annotation
```

### **Method 2: Direct Coordinate Entry**
```
1. Click any feature type button in toolbar
2. Enter coordinates manually in modal form
3. Specify strand direction (forward/reverse)
4. Add name and description
5. Save feature
```

### **Method 3: AI-Assisted Creation**
```
1. Use AI chat: "Create a gene annotation from 1000 to 2000"
2. AI automatically fills form with specified parameters
3. Review and modify details as needed
4. Confirm creation
```

## 🎨 Feature Types & Styling

### **Quick Access Types** (Green buttons)
| Type | Usage | Visual Style |
|------|-------|--------------|
| **Gene** | Gene regions and loci | Green dashed border, gene icon |
| **CDS** | Coding sequences | Blue-green with CDS badge |
| **rRNA** | Ribosomal RNA genes | Purple with rRNA badge |
| **tRNA** | Transfer RNA genes | Orange with tRNA badge |
| **Comment/Note** | General annotations | Gray with note icon |

### **Extended Types** (Dropdown menu)
| Type | Usage | Research Applications |
|------|-------|---------------------|
| **Promoter** | Regulatory regions | Transcription start sites, TATA boxes |
| **Terminator** | Transcription end points | Rho-independent, intrinsic terminators |
| **Regulatory** | Control elements | Enhancers, silencers, operators |
| **Signal Peptide** | Protein targeting | Secretion signals, localization |
| **Repeat Region** | Repetitive sequences | Transposons, tandem repeats |
| **Misc Feature** | General features | Binding sites, origins |
| **Other** | Custom types | Researcher-specific annotations |

## 📝 Feature Creation Form

### **Required Fields**
- **Feature Type**: Selected automatically based on button clicked
- **Name**: Descriptive name for the feature (e.g., "lacZ gene", "T7 promoter")
- **Start Position**: Beginning coordinate (1-based)
- **End Position**: Ending coordinate (inclusive)

### **Optional Fields**
- **Strand**: Forward (+) or Reverse (-) orientation
- **Description**: Detailed description, notes, or references
- **Custom Type**: For "Other" category, specify custom feature type

### **Validation & Error Handling**
- **Position Bounds**: Ensures coordinates are within chromosome/sequence limits
- **Logical Validation**: Start position must be ≤ end position
- **Duplicate Detection**: Warns about overlapping annotations with same name
- **Character Limits**: Enforces reasonable limits on text fields

## 🔧 Technical Implementation

### **Data Storage**
- **Session Persistence**: Features stored in memory during browser session
- **Chromosome Organization**: Features organized by chromosome for efficient access
- **JSON Structure**: Simple object format for easy serialization
- **No File Modification**: Original genome files remain unchanged

### **Visual Rendering**
```javascript
// User features get special styling
if (feature.isUserDefined) {
    geneElement.style.border = '2px dashed #10b981';
    geneElement.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
    // Add edit icon overlay
    const editIcon = document.createElement('span');
    editIcon.className = 'edit-icon';
    editIcon.innerHTML = '✏️';
}
```

### **Integration with Existing System**
- **Unified Display**: User features appear alongside loaded annotations
- **Search Integration**: User features included in search results
- **Track Rendering**: Seamless integration with gene track visualization
- **Conflict Resolution**: Handles overlapping features gracefully

## 🎯 Use Cases & Applications

### **Research Applications**
- **Functional Annotation**: Add functional information to predicted genes
- **Experimental Results**: Mark regions of interest from wet lab experiments
- **Hypothesis Generation**: Annotate potential regulatory elements
- **Data Integration**: Combine multiple data sources in single view

### **Educational Use**
- **Teaching Tools**: Create examples for students to understand genome organization
- **Interactive Learning**: Allow students to practice genome annotation
- **Comparative Analysis**: Highlight differences between related genomes
- **Concept Illustration**: Demonstrate gene regulation and organization

### **Data Analysis**
- **Quality Control**: Mark problematic regions or sequencing artifacts
- **Custom Annotations**: Add laboratory-specific or project-specific annotations
- **Temporal Tracking**: Note changes or updates to genome understanding
- **Collaboration**: Share important regions with collaborators

## 🔍 Integration with Search & AI

### **Search Functionality**
- **Text Search**: User-defined features included in gene name searches
- **Position Search**: AI can find features near specific coordinates
- **Type Filtering**: Search by specific feature types
- **Description Search**: Search within user-added descriptions

### **AI Assistant Integration**
```
User Commands:
"Create a promoter annotation at position 1000-1100"
"Add a comment about the interesting region from 5000 to 5500"
"Mark this region as a potential regulatory element"
"Find user-defined features in this area"
```

## ⚠️ Limitations & Considerations

### **Current Limitations**
- **Session Persistence**: Features lost when browser closes (no file saving yet)
- **Export Options**: Cannot export user features to standard formats (planned)
- **Editing Capability**: No direct editing of created features (planned)
- **Batch Operations**: No bulk import/export functionality (planned)

### **Best Practices**
- **Descriptive Names**: Use clear, descriptive names for easy identification
- **Consistent Naming**: Develop naming conventions for project consistency
- **Documentation**: Include detailed descriptions for complex annotations
- **Regular Screenshots**: Save important views as images for documentation

### **Performance Considerations**
- **Memory Usage**: Large numbers of features may impact performance
- **Rendering Speed**: Complex overlapping features may slow visualization
- **Search Performance**: Many features may slow search operations

## 🚀 Future Enhancements

### **Planned Features**
- **Persistent Storage**: Save features to files for permanent storage
- **Export Functionality**: Export to GFF, BED, and other standard formats
- **Feature Editing**: Direct editing and deletion of created features
- **Import Capability**: Import features from external files
- **Collaboration**: Share feature sets between users

### **Advanced Features**
- **Feature Validation**: Check against known databases for accuracy
- **Automatic Annotation**: AI-powered suggestion of feature types
- **Version Control**: Track changes and annotations over time
- **Integration**: Direct connection to annotation databases

### **User Experience Improvements**
- **Keyboard Shortcuts**: Faster feature creation workflows
- **Templates**: Pre-defined feature templates for common use cases
- **Batch Operations**: Create multiple features simultaneously
- **Advanced Search**: Complex queries across user annotations

## 🛠️ Troubleshooting

### **Common Issues**

**Feature not appearing**:
- Check that coordinates are within sequence bounds
- Verify feature name doesn't conflict with existing annotations
- Ensure proper strand selection for visualization

**Coordinates incorrect**:
- Remember coordinates are 1-based (first base is position 1)
- Start position must be less than or equal to end position
- Check chromosome/sequence length limits

**Visual styling issues**:
- User features should have dashed green borders
- If styling missing, check browser compatibility
- Ensure no CSS conflicts with custom stylesheets

**Performance problems**:
- Limit number of features to reasonable amounts (<1000)
- Avoid very long feature names or descriptions
- Consider using more specific genomic regions

### **Technical Support**
- Check browser console for error messages
- Verify genome file is properly loaded before adding features
- Ensure JavaScript is enabled and running properly
- Contact support with specific error messages and reproduction steps

This user-defined features system provides a powerful and intuitive way to enhance genome annotation directly within the browser, making it an essential tool for researchers, educators, and anyone working with genomic data. 