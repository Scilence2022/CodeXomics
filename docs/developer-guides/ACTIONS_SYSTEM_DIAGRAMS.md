# Actions System Visual Diagrams

**Visual reference for understanding the Actions System architecture and workflows**

---

## System Architecture

### Component Overview

```mermaid
graph TB
    User[User Interface]
    AM[ActionManager]
    CM[CheckpointManager]
    AT[ActionTools MCP]
    GB[GenomeBrowser]
    
    User -->|interactions| AM
    AM -->|backup/restore| CM
    AM -->|genome data| GB
    AT -->|external calls| AM
    
    AM -->|queue management| AQ[Action Queue]
    AM -->|execution| AE[Action Executor]
    AM -->|clipboard| CB[Clipboard]
    AM -->|features| FT[Feature Tracker]
    
    AQ -->|actions| AE
    AE -->|modify| GB
    AE -->|update| FT
    FT -->|adjust| GB
```

### Data Flow

```mermaid
graph LR
    A[User Action] --> B[Create Action Object]
    B --> C[Add to Queue]
    C --> D[Validate & Check Conflicts]
    D --> E{Has Conflicts?}
    E -->|Yes| F[Show Conflict Dialog]
    E -->|No| G[Execute Queue]
    F --> H{User Decision}
    H -->|Proceed| G
    H -->|Cancel| I[End]
    G --> J[Update Features]
    J --> K[Generate GBK]
    K --> L[End]
```

---

## Action Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: addAction()
    Created --> Pending: Queue
    Pending --> Validating: executeAllActions()
    Validating --> Executing: No conflicts
    Validating --> Pending: User cancels
    Executing --> Completed: Success
    Executing --> Failed: Error
    Completed --> [*]
    Failed --> [*]
```

---

## Execution Workflow

### Standard Execution

```mermaid
sequenceDiagram
    participant U as User
    participant AM as ActionManager
    participant GB as GenomeBrowser
    participant CM as CheckpointManager
    
    U->>AM: executeAllActions()
    AM->>AM: Check conflicts
    AM->>CM: Create checkpoint
    AM->>GB: Create data copy
    
    loop For each action
        AM->>AM: Execute action
        AM->>GB: Modify sequence
        AM->>AM: Update features
        AM->>AM: Adjust remaining actions
    end
    
    AM->>AM: Generate GBK
    AM->>GB: Restore original state
    AM->>U: Show success
```

### Execution with Conflicts

```mermaid
sequenceDiagram
    participant U as User
    participant AM as ActionManager
    participant CD as ConflictDialog
    
    U->>AM: executeAllActions()
    AM->>AM: checkActionConflicts()
    AM->>AM: Found conflicts
    AM->>CD: Show dialog
    CD->>U: Display conflicts
    U->>CD: User decision
    
    alt Proceed
        CD->>AM: Continue
        AM->>AM: Execute with conflicts
        AM->>U: Show results
    else Cancel
        CD->>AM: Cancel
        AM->>U: Execution cancelled
    end
```

---

## Clipboard Operations

### Copy Operation

```mermaid
graph TD
    A[User: Copy Sequence] --> B[Get Selection]
    B --> C[Extract Sequence]
    C --> D[Collect Features]
    D --> E[Create Clipboard Data]
    E --> F[Store in clipboard]
    F --> G[Create COPY Action]
    G --> H[Add to Queue]
```

### Paste Operation

```mermaid
graph TD
    A[User: Paste Sequence] --> B{Has Clipboard?}
    B -->|No| C[Show Warning]
    B -->|Yes| D{Has Selection?}
    D -->|Yes| E[Replace Mode]
    D -->|No| F[Insert Mode]
    E --> G[Create PASTE Action]
    F --> G
    G --> H[Add to Queue]
```

---

## Feature Adjustment Process

```mermaid
graph TD
    A[Action Executed] --> B{Action Type}
    
    B -->|INSERT| C[Shift Features Right]
    B -->|DELETE| D[Shift Features Left]
    B -->|REPLACE| E[Complex Adjustment]
    
    C --> F[Update Positions]
    D --> F
    E --> F
    
    F --> G{Feature Overlaps?}
    G -->|Yes| H[Mark for Review]
    G -->|No| I[Complete]
    H --> I
```

---

## Conflict Detection

```mermaid
graph TD
    A[Pending Actions] --> B[Group by Chromosome]
    B --> C[Sort by Position]
    C --> D{Check Overlaps}
    
    D -->|Overlap Found| E[Calculate Severity]
    D -->|No Overlap| F[Continue]
    
    E --> G{Severity}
    G -->|High| H[DELETE/CUT overlap]
    G -->|Medium| I[REPLACE overlap]
    G -->|Low| J[INSERT/PASTE overlap]
    
    H --> K[Record Conflict]
    I --> K
    J --> K
    K --> L[All Actions Checked?]
    L -->|No| D
    L -->|Yes| M[Return Conflicts]
```

---

## State Management

### Current State (Legacy)

```mermaid
graph LR
    AM[ActionManager]
    AM --> A[actions array]
    AM --> B[clipboard object]
    AM --> C[cursorPosition number]
    AM --> D[sequenceModifications Map]
    AM --> E[originalAnnotations object]
    AM --> F[isExecuting boolean]
```

### Proposed State (Modern)

```mermaid
graph TB
    AS[ActionState]
    AS --> S[Centralized State]
    
    S --> Q[queue array]
    S --> CB[clipboard object]
    S --> IE[isExecuting boolean]
    S --> M[modifications Map]
    S --> H[history array]
    
    AS --> L[Listeners Set]
    AS --> MW[Middlewares array]
    
    L --> N1[Listener 1]
    L --> N2[Listener 2]
    L --> N3[Listener 3]
```

---

## MCP Integration

```mermaid
sequenceDiagram
    participant AI as AI/External Tool
    participant MCP as MCP Server
    participant AT as ActionTools
    participant AM as ActionManager
    participant GB as GenomeBrowser
    
    AI->>MCP: Tool call request
    MCP->>AT: Route to ActionTools
    AT->>AM: Execute action function
    AM->>GB: Perform operation
    GB->>AM: Return result
    AM->>AT: Return result
    AT->>MCP: Format response
    MCP->>AI: Return result
```

---

## Performance Optimization

### Current Architecture (Deep Copy)

```mermaid
graph LR
    A[Original Data<br/>500MB] -->|Deep Copy| B[Execution Copy<br/>500MB]
    B -->|Modify| C[Modified Copy<br/>500MB]
    C -->|Apply| A
    
    style A fill:#f9f
    style B fill:#f9f
    style C fill:#f9f
```

**Memory Usage**: 1.5GB (3x genome size)  
**Time**: 5-60 seconds

### Proposed Architecture (Copy-on-Write)

```mermaid
graph LR
    A[Original Data<br/>500MB] -->|Reference| B[Proxy<br/>1KB]
    B -->|Modifications<br/>Only Changed| C[Modified Chromosomes<br/>50MB]
    C -->|Commit| A
    
    style A fill:#9f9
    style B fill:#9f9
    style C fill:#9f9
```

**Memory Usage**: 600MB (1.2x genome size)  
**Time**: 0.5-6 seconds

---

## Error Handling Flow

```mermaid
graph TD
    A[Execute Action] --> B{Try}
    B -->|Success| C[Update Status: COMPLETED]
    B -->|Error| D[Catch Error]
    
    D --> E{Error Type}
    E -->|ValidationError| F[Show Warning]
    E -->|ActionError| G[Show Error]
    E -->|Other| H[Log & Rethrow]
    
    F --> I[Update Status: FAILED]
    G --> I
    H --> I
    
    C --> J[Continue]
    I --> J
```

---

## Module Organization (Proposed)

```mermaid
graph TB
    AM[ActionManager]
    
    AM --> C[Core]
    AM --> O[Operations]
    AM --> F[Features]
    AM --> E[Export]
    AM --> U[UI]
    AM --> UT[Utils]
    
    C --> C1[ActionQueue]
    C --> C2[ActionExecutor]
    C --> C3[ActionValidator]
    C --> C4[ActionState]
    
    O --> O1[BaseOperation]
    O --> O2[CopyOperation]
    O --> O3[PasteOperation]
    O --> O4[DeleteOperation]
    O --> O5[InsertOperation]
    O --> O6[ReplaceOperation]
    
    F --> F1[FeatureAdjuster]
    F --> F2[FeatureTracker]
    F --> F3[FeatureValidator]
    
    E --> E1[GenbankExporter]
    E --> E2[ExportFormatter]
    
    U --> U1[ActionListUI]
    U --> U2[ActionModals]
    U --> U3[ConflictDialog]
    
    UT --> UT1[SequenceUtils]
    UT --> UT2[PositionUtils]
    UT --> UT3[ValidationUtils]
```

---

## Testing Strategy

```mermaid
graph TB
    T[Testing]
    
    T --> U[Unit Tests]
    T --> I[Integration Tests]
    T --> P[Performance Tests]
    T --> E[E2E Tests]
    
    U --> U1[ActionQueue Tests]
    U --> U2[ActionExecutor Tests]
    U --> U3[Operations Tests]
    U --> U4[Validators Tests]
    
    I --> I1[ActionManager + CheckpointManager]
    I --> I2[ActionManager + MCP]
    I --> I3[ActionManager + UI]
    
    P --> P1[Large Genome Benchmarks]
    P --> P2[Memory Usage Tests]
    P --> P3[Concurrent Operations]
    
    E --> E1[Full Workflow Tests]
    E --> E2[User Scenario Tests]
```

---

## Migration Strategy

```mermaid
graph LR
    A[Phase 1<br/>Performance] --> B[Phase 2<br/>Consolidation]
    B --> C[Phase 3<br/>Testing]
    C --> D[Phase 4<br/>Modularization]
    
    A -->|Week 1-2| A1[GenomeDataProxy]
    A1 --> A2[Benchmarks]
    
    B -->|Week 2-3| B1[Merge Implementations]
    B1 --> B2[Compatibility Layer]
    
    C -->|Week 3-4| C1[Add JSDoc]
    C1 --> C2[Write Tests]
    C2 --> C3[CI/CD Setup]
    
    D -->|Week 4+| D1[Extract Modules]
    D1 --> D2[Dependency Injection]
```

---

## Command Pattern Architecture (Modern)

```mermaid
graph TB
    Client[Client Code]
    Registry[Command Registry]
    
    Client -->|execute| Registry
    
    Registry --> C1[action:setCursorPosition]
    Registry --> C2[action:paste]
    Registry --> C3[action:delete]
    Registry --> C4[action:copy]
    Registry --> C5[action:executeAll]
    
    C1 --> E[Executor]
    C2 --> E
    C3 --> E
    C4 --> E
    C5 --> E
    
    E --> V[Validator]
    E --> H[Hooks]
    E --> M[Metrics]
    
    V -->|validate| R[Result]
    H -->|before/after| R
    M -->|track| R
    
    R --> Client
```

---

## Decision Tree: Which Implementation?

```mermaid
graph TD
    A[Choose Implementation] --> B{Project Status}
    
    B -->|New Project| C[Use Modern]
    B -->|Existing Project| D{Can Refactor?}
    
    D -->|Yes| E{Timeline}
    D -->|No| F[Use Legacy with Patches]
    
    E -->|Long| C
    E -->|Short| F
    
    C --> G[ModernActionManager]
    F --> H[ActionManager]
    
    G --> I[Benefits: Clean architecture, testable, performant]
    H --> J[Benefits: Battle-tested, feature-complete]
```

---

## Data Models

### Action Object

```mermaid
classDiagram
    class Action {
        +int id
        +string type
        +string target
        +string details
        +ActionMetadata metadata
        +string status
        +Date timestamp
        +number estimatedTime
        +object result
        +string error
        +Date executionStart
        +Date executionEnd
        +number actualTime
    }
    
    class ActionMetadata {
        +string chromosome
        +number start
        +number end
        +string strand
        +ClipboardData clipboardData
        +string selectionSource
    }
    
    Action --> ActionMetadata
```

### Clipboard Data

```mermaid
classDiagram
    class ClipboardData {
        +string type
        +string sequence
        +string source
        +Date timestamp
        +SelectionInfo sourceInfo
        +ComprehensiveData comprehensiveData
    }
    
    class ComprehensiveData {
        +RegionInfo region
        +Feature[] features
        +Variant[] variants
        +Read[] reads
        +Metadata metadata
    }
    
    ClipboardData --> ComprehensiveData
```

---

## Performance Comparison

### Memory Usage

```mermaid
graph LR
    subgraph Current
        A[Original<br/>500MB] --- B[Copy<br/>500MB] --- C[Modified<br/>500MB]
    end
    
    subgraph Optimized
        D[Original<br/>500MB] --- E[Proxy<br/>1KB] --- F[Changes<br/>50MB]
    end
    
    Current -.->|1500MB total| X[High Memory]
    Optimized -.->|600MB total| Y[Low Memory]
    
    style X fill:#f99
    style Y fill:#9f9
```

### Execution Time

```mermaid
xychart-beta
    title "Execution Time by Genome Size"
    x-axis [1MB, 10MB, 50MB, 100MB]
    y-axis "Time (seconds)" 0 --> 120
    line [0.5, 5, 30, 60]
    line [0.05, 0.5, 3, 6]
```

- Line 1: Current (red)
- Line 2: Optimized (green)

---

## Summary

These diagrams illustrate:

1. **System Architecture**: Component relationships and data flow
2. **Execution Workflow**: Step-by-step process with error handling
3. **Feature Management**: How genomic features are tracked and adjusted
4. **Performance**: Current bottlenecks and proposed optimizations
5. **Migration Path**: Phased approach to improvements
6. **Testing Strategy**: Comprehensive coverage plan

**Usage**: Refer to these diagrams when:
- Understanding system architecture
- Planning modifications
- Debugging issues
- Onboarding new developers
- Presenting to stakeholders

---

**Last Updated**: 2025-11-03  
**Maintained By**: GenomeAIStudio Team
