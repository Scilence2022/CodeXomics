# Plugin Test Window - Copy/Paste Quick Guide

## Overview

Plugin Test windows now include full copy/paste functionality through three convenient methods: menu bar buttons, keyboard shortcuts, and right-click context menu.

## How to Use

### Method 1: Menu Bar (Visual)

At the top of every Plugin Test window, you'll find a menu bar with the following buttons:

- **📋 Copy** - Copy selected text
- **📄 Paste** - Paste clipboard content
- **✂️ Cut** - Cut selected text
- **📝 Select All** - Select all content
- **🔄 Refresh** - Reload the window

Simply click the button to perform the action.

### Method 2: Keyboard Shortcuts (Fast)

**On macOS:**

- `Cmd+C` - Copy
- `Cmd+V` - Paste
- `Cmd+X` - Cut
- `Cmd+A` - Select All
- `Cmd+R` - Refresh

**On Windows/Linux:**

- `Ctrl+C` - Copy
- `Ctrl+V` - Paste
- `Ctrl+X` - Cut
- `Ctrl+A` - Select All
- `Ctrl+R` - Refresh

### Method 3: Context Menu (Convenient)

Right-click anywhere in the test window to open a context menu with clipboard options:

- Copy
- Paste
- Cut
- Select All

## Common Use Cases

### Copying Test Results

1. Select the text you want to copy (drag to highlight)
2. Press `Cmd/Ctrl+C` or click the Copy button
3. A green notification will confirm "Copied to clipboard!"

### Pasting Demo Data

1. Click in an input field or text area
2. Press `Cmd/Ctrl+V` or click the Paste button
3. The clipboard content will be inserted at the cursor

### Copying Error Messages

1. When a test fails, select the error message
2. Use any copy method to save it to clipboard
3. Paste into your issue tracker or debugging notes

### Copying Generated Code

1. Many plugins generate code examples
2. Select the code snippet
3. Copy it to use in your own projects

## Tips & Tricks

**Quick Select All**: Double-click the Select All button or press `Cmd/Ctrl+A` to instantly select everything in the current view.

**Copy Long Results**: When test results are very long, use Select All then Copy to capture everything at once.

**Multiple Windows**: Each Plugin Test window has its own independent menu system - you can copy from one and paste into another.

**Visual Feedback**: Watch for the green toast notifications in the top-right corner to confirm your operations succeeded.

## Troubleshooting

**Q: Nothing happens when I press Cmd/Ctrl+C**

- A: Make sure you have text selected first. Try selecting some text with your mouse.

**Q: Paste doesn't work**

- A: Click inside an input field or text area first. Paste only works in editable areas.

**Q: Context menu doesn't appear**

- A: Make sure you're right-clicking, not left-clicking. On macOS, you can also use Ctrl+Click.

**Q: Wrong keyboard shortcuts for my OS**

- A: The system should auto-detect your platform. Try refreshing the window if shortcuts seem incorrect.

## Feature Availability

✅ Available in all Plugin Test windows
✅ Works with demo windows
✅ Works with enhanced test suites  
✅ Compatible with all plugin types

---

_This feature was added to improve the Plugin Testing experience. For technical details, see PLUGIN_TEST_COPY_PASTE_IMPLEMENTATION.md_
