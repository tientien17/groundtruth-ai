# GroundTruth Local - UX Improvement Plan

**Date**: 2026-05-22  
**Based on**: Research of civils.ai and togal.ai competitor analysis

---

## Executive Summary

After researching civils.ai and togal.ai, we identified critical UX gaps in GroundTruth Local that prevent users from understanding the workflow. This document outlines specific improvements to match industry standards.

---

## Current State Analysis

### What Users See Now
- Workspace view with "No sheets found"
- Tools visible but not actionable
- No guidance or next steps
- Unclear workflow

### What's Missing
1. **Onboarding/Welcome screen**
2. **Empty state guidance**
3. **Value proposition**
4. **Sample/demo project**
5. **Workflow indicators**
6. **Contextual help**

---

## Competitor Insights

### Civils.ai Strengths
- **3-step workflow**: Upload → Prompt → Export (crystal clear)
- **Natural language**: "measure all paving areas" (user-friendly)
- **Human QA**: AI + expert verification (trust building)
- **ROI calculator**: Immediate business case (value demonstration)
- **Use case segmentation**: For estimators, groundworks, pre-construction

### Togal.ai Strengths
- **Clear promise**: "Takeoff in Minutes. Not Days" (5x faster)
- **Video demo**: Shows product in action immediately
- **Interactive tour**: "Take a Tour" option for exploration
- **Togal.CHAT**: Natural language interface to plans
- **98% accuracy**: Specific, measurable claim

---

## Priority 1: Empty State Improvements

### Current Problem
User sees "No sheets found" with no guidance on what to do next.

### Solution: Enhanced Empty State Component

**Location**: `apps/frontend/src/components/Workspace/SheetsSidebar.tsx`

**New Empty State Design**:
```
┌─────────────────────────────────┐
│  📄 No Sheets Yet               │
│                                 │
│  Get started by uploading       │
│  your first PDF drawing         │
│                                 │
│  ┌─────────────────────────┐   │
│  │  📤 Upload PDF          │   │
│  └─────────────────────────┘   │
│                                 │
│  or                             │
│                                 │
│  ┌─────────────────────────┐   │
│  │  🎯 Try Sample Project  │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

**Implementation**:
- Add "Upload PDF" button that opens file picker
- Add "Try Sample Project" button that loads pre-configured demo
- Include brief text explaining what sheets are
- Show example thumbnail image

---

## Priority 2: Onboarding Flow

### Current Problem
No welcome screen or tutorial when user first opens the app.

### Solution: Welcome Screen Component

**Location**: New file `apps/frontend/src/components/Onboarding/WelcomeScreen.tsx`

**Welcome Screen Design**:
```
┌──────────────────────────────────────────────┐
│  Welcome to GroundTruth Local                │
│                                              │
│  Offline-first construction takeoff with     │
│  local AI - no cloud required                │
│                                              │
│  How it works:                               │
│  1️⃣  Upload PDF drawings                     │
│  2️⃣  Select a sheet to view                  │
│  3️⃣  Use tools to measure (Length/Area/Count)│
│  4️⃣  Export quantities to Excel              │
│                                              │
│  ┌────────────────┐  ┌──────────────────┐   │
│  │ Create Project │  │ Load Sample Demo │   │
│  └────────────────┘  └──────────────────┘   │
└──────────────────────────────────────────────┘
```

**Features**:
- Show only on first launch (localStorage flag)
- "Skip" option for returning users
- "Create Project" button (primary CTA)
- "Load Sample Demo" button (secondary CTA)
- Brief 4-step workflow explanation

---

## Priority 3: Workflow Progress Indicator

### Current Problem
User doesn't know where they are in the workflow or what comes next.

### Solution: Progress Stepper Component

**Location**: New component in `apps/frontend/src/components/Workspace/WorkflowStepper.tsx`

**Progress Indicator Design**:
```
┌────────────────────────────────────────────────────┐
│  1. Upload PDF  →  2. Select Sheet  →  3. Measure  │
│     ✅               ⏸️ Current          ⬜          │
└────────────────────────────────────────────────────┘
```

**States**:
- ✅ Completed (green)
- ⏸️ Current (blue, pulsing)
- ⬜ Not started (gray)

**Position**: Top of Workspace, below title bar

---

## Priority 4: Sample/Demo Project

### Current Problem
New users have no PDFs to test with and don't understand the value.

### Solution: Pre-loaded Demo Project

**Implementation**:
1. Include sample PDF in `fixtures/` directory
2. Add "Load Demo Project" button in empty state
3. Demo project includes:
   - 1-2 sample construction drawings
   - Pre-made measurements (length, area, count examples)
   - Populated quantity table
   - Example classifications

**Benefits**:
- Users see the end result immediately
- Understand what the app does
- Can explore features without own PDFs
- Reduces time-to-value

**Location**: 
- Button in empty state
- Button in welcome screen
- Menu item in top navigation

---

## Priority 5: Contextual Help & Tooltips

### Current Problem
Tools are visible but users don't know when/how to use them.

### Solution: Tooltips and Help Text

**Tool Tooltips**:
- **Select**: "Click to select and pan around the drawing"
- **Pan**: "Drag to move the drawing around"
- **Length**: "Click points to measure linear distances (walls, pipes, etc.)"
- **Area**: "Click to draw a polygon and measure area (rooms, paving, etc.)"
- **Count**: "Click to count items (doors, windows, fixtures, etc.)"

**Implementation**:
- Add `title` attribute to each tool button
- Consider using a tooltip library (e.g., `@radix-ui/react-tooltip`)
- Show keyboard shortcuts if applicable

---

## Priority 6: Value Proposition Banner

### Current Problem
User doesn't understand what the app does or why it's valuable.

### Solution: Brief Value Prop in Header

**Location**: Top of app, below title

**Design**:
```
┌────────────────────────────────────────────────────┐
│  GroundTruth Local                                 │
│  Offline construction takeoff • Local AI • No cloud│
└────────────────────────────────────────────────────┘
```

**Alternative** (if more space):
```
┌────────────────────────────────────────────────────┐
│  GroundTruth Local                                 │
│  📐 Measure drawings  •  🤖 AI-assisted  •  📊 Export│
└────────────────────────────────────────────────────┘
```

---

## Priority 7: Upload PDF Flow

### Current Problem
No obvious way to upload PDFs from the Workspace view.

### Solution: Multiple Upload Entry Points

**Entry Points**:
1. **Empty state button**: "Upload PDF" (primary)
2. **Sheets sidebar header**: "+" button to add more sheets
3. **Drag & drop zone**: Entire center area when no sheet selected
4. **Menu bar**: File → Upload PDF

**Drag & Drop Design**:
```
┌──────────────────────────────────────┐
│                                      │
│         📄                           │
│                                      │
│    Drag PDF here to upload           │
│                                      │
│    or click to browse                │
│                                      │
└──────────────────────────────────────┘
```

---

## Implementation Priority

### Phase 1 (Immediate - 1-2 days)
1. ✅ Enhanced empty state with "Upload PDF" button
2. ✅ Tooltips for all tools
3. ✅ Value proposition in header

### Phase 2 (Short-term - 3-5 days)
4. ✅ Welcome screen component
5. ✅ Workflow progress indicator
6. ✅ Drag & drop upload zone

### Phase 3 (Medium-term - 1 week)
7. ✅ Sample/demo project with pre-loaded data
8. ✅ Contextual help system
9. ✅ Onboarding tutorial (optional)

---

## Success Metrics

**Before Improvements**:
- User confusion: High (user doesn't know what to do)
- Time to first measurement: Unknown (blocked by confusion)
- Feature discovery: Low (tools not understood)

**After Improvements**:
- User confusion: Low (clear guidance at every step)
- Time to first measurement: <5 minutes (with demo project)
- Feature discovery: High (tooltips + sample project)

---

## Technical Notes

### Files to Modify
1. `apps/frontend/src/components/Workspace/SheetsSidebar.tsx` - Empty state
2. `apps/frontend/src/components/Workspace/Workspace.tsx` - Upload handlers
3. `apps/frontend/src/App.tsx` - Welcome screen logic
4. New: `apps/frontend/src/components/Onboarding/WelcomeScreen.tsx`
5. New: `apps/frontend/src/components/Workspace/WorkflowStepper.tsx`
6. New: `apps/frontend/src/components/Workspace/DragDropZone.tsx`

### Dependencies Needed
- `@radix-ui/react-tooltip` (for tooltips)
- Sample PDF fixture in `fixtures/sample-drawing.pdf`

---

## Appendix: Competitor Feature Comparison

| Feature | Civils.ai | Togal.ai | GroundTruth Local (Current) | GroundTruth Local (Proposed) |
|---------|-----------|----------|----------------------------|------------------------------|
| Clear workflow | ✅ 3 steps | ✅ Video demo | ❌ Hidden | ✅ Progress indicator |
| Empty state guidance | ✅ | ✅ | ❌ | ✅ Upload CTA |
| Sample/demo project | ❌ | ✅ Tour | ❌ | ✅ Pre-loaded demo |
| Natural language | ✅ Prompts | ✅ Chat | ❌ | 🔮 Future feature |
| Value proposition | ✅ 90% faster | ✅ 5x faster | ❌ | ✅ Header banner |
| Tooltips/help | ✅ | ✅ | ❌ | ✅ All tools |
| Onboarding | ✅ | ✅ | ❌ | ✅ Welcome screen |

---

## Next Steps

1. **Review this document** with the team
2. **Prioritize features** based on effort vs. impact
3. **Create design mockups** for key screens
4. **Implement Phase 1** improvements first
5. **User test** with 2-3 construction professionals
6. **Iterate** based on feedback

---

**Questions or feedback?** Open an issue or discuss in the team channel.
