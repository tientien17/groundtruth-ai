/**
 * Tests for Workspace components.
 */

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SheetViewer } from './SheetViewer'
import { SheetsSidebar } from './SheetsSidebar'
import { ToolsSidebar } from './ToolsSidebar'
import { TakeoffItemsSidebar } from './TakeoffItemsSidebar'
import { TextSearchTool } from '../Search/TextSearchTool'
import type { SheetSummary } from '../Library/types'
import type { TakeoffItem } from './types'

// Mock sheet data
const mockSheet: SheetSummary = {
  id: 'sheet-1',
  document_id: 'doc-1',
  sheet_number: 'A-001',
  sheet_title: 'Floor Plan',
  page_index: 0,
  thumbnail_url: 'http://example.com/thumb.png',
  sheet_metadata: {},
}

const mockSheets: SheetSummary[] = [
  mockSheet,
  {
    id: 'sheet-2',
    document_id: 'doc-1',
    sheet_number: 'A-002',
    sheet_title: 'Elevation',
    page_index: 1,
    thumbnail_url: null,
    sheet_metadata: {},
  },
]

const mockTakeoffItems: TakeoffItem[] = [
  {
    id: 'item-1',
    sheet_id: 'sheet-1',
    classification_id: null,
    type: 'linear',
    source: 'manual',
    confidence: null,
    scale_id: null,
    quantity_raw: 120.5,
    quantity_unit: 'ft',
    created_by: 'user',
    geometry: null,
  },
]

function render(component: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(component)
  return { container, root }
}

describe('SheetViewer', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should show loading state', async () => {
    const { container } = render(<SheetViewer projectId="project-1" sheet={null} loading sidecarPort={8000} projectPath="/project" />)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="sheet-viewer-loading"]')).toBeTruthy()
      expect(container.textContent).toContain('Loading sheet...')
    })
  })

  it('should show error state', async () => {
    const { container } = render(<SheetViewer projectId="project-1" sheet={null} error="Failed to load" sidecarPort={8000} projectPath="/project" />)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="sheet-viewer-error"]')).toBeTruthy()
      expect(container.textContent).toContain('Failed to load sheet')
    })
  })

  it('should show empty state when no sheet selected', async () => {
    const { container } = render(<SheetViewer projectId="project-1" sheet={null} sidecarPort={8000} projectPath="/project" />)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="sheet-viewer-empty"]')).toBeTruthy()
      expect(container.textContent).toContain('No sheet selected')
    })
  })

  it('should render sheet with image', async () => {
    const { container } = render(<SheetViewer projectId="project-1" sheet={mockSheet} sidecarPort={8000} projectPath="/project" />)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="sheet-viewer"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="sheet-image"]')).toBeTruthy()
    })
  })

  it('should render zoom controls', async () => {
    const { container } = render(<SheetViewer projectId="project-1" sheet={mockSheet} sidecarPort={8000} projectPath="/project" />)
    await vi.waitFor(() => {
      expect(container.querySelector('[title="Zoom in"]')).toBeTruthy()
      expect(container.querySelector('[title="Zoom out"]')).toBeTruthy()
      expect(container.querySelector('[title="Reset view"]')).toBeTruthy()
    })
  })
})

describe('TextSearchTool', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('fetches text candidates and reports current sheet count', async () => {
    const onCandidatesChange = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          { document_id: 'doc-1', sheet_id: 'sheet-1', page_index: 0, text: 'SD-1', bbox: [10, 20, 30, 40] },
          { document_id: 'doc-1', sheet_id: 'sheet-2', page_index: 1, text: 'SD-1', bbox: [50, 60, 70, 80] },
        ],
      }),
    })))

    const { container } = render(
      <TextSearchTool
        projectId="project-1"
        projectPath="C:/Projects/Demo.gtl"
        sidecarPort={8765}
        currentSheetId="sheet-1"
        onCandidatesChange={onCandidatesChange}
      />
    )

    await vi.waitFor(() => expect(container.querySelector('#text-search-input')).toBeTruthy())
    const input = container.querySelector('#text-search-input') as HTMLInputElement
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, 'SD-1')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    await vi.waitFor(() => {
      expect(onCandidatesChange).toHaveBeenCalledWith([
        { document_id: 'doc-1', sheet_id: 'sheet-1', page_index: 0, text: 'SD-1', bbox: [10, 20, 30, 40] },
        { document_id: 'doc-1', sheet_id: 'sheet-2', page_index: 1, text: 'SD-1', bbox: [50, 60, 70, 80] },
      ])
      expect(container.querySelector('[data-testid="text-search-count"]')?.textContent).toContain('2 candidates, 1 on current sheet')
    })
  })
})

describe('SheetsSidebar', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should show loading state', async () => {
    const { container } = render(
      <SheetsSidebar
        sheets={[]}
        selectedSheetId={null}
        onSelectSheet={() => {}}
        loading
      />
    )
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Loading...')
    })
  })

  it('should show empty state', async () => {
    const { container } = render(
      <SheetsSidebar
        sheets={[]}
        selectedSheetId={null}
        onSelectSheet={() => {}}
      />
    )
    await vi.waitFor(() => {
      expect(container.textContent).toContain('No sheets found')
    })
  })

  it('should render list of sheets', async () => {
    const { container } = render(
      <SheetsSidebar
        sheets={mockSheets}
        selectedSheetId="sheet-1"
        onSelectSheet={() => {}}
      />
    )
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="sheet-item-sheet-1"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="sheet-item-sheet-2"]')).toBeTruthy()
      expect(container.textContent).toContain('A-001')
      expect(container.textContent).toContain('A-002')
    })
  })

  it('should highlight selected sheet', async () => {
    const { container } = render(
      <SheetsSidebar
        sheets={mockSheets}
        selectedSheetId="sheet-1"
        onSelectSheet={() => {}}
      />
    )
    await vi.waitFor(() => {
      const selectedButton = container.querySelector('[data-testid="sheet-item-sheet-1"]')
      expect(selectedButton?.className).toContain('bg-blue-50')
    })
  })

  it('should call onSelectSheet when clicked', async () => {
    const onSelectSheet = vi.fn()
    const { container } = render(
      <SheetsSidebar
        sheets={mockSheets}
        selectedSheetId="sheet-1"
        onSelectSheet={onSelectSheet}
      />
    )
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="sheet-item-sheet-2"]')).toBeTruthy()
    })
    const button = container.querySelector('[data-testid="sheet-item-sheet-2"]') as HTMLButtonElement
    button?.click()
    expect(onSelectSheet).toHaveBeenCalledWith('sheet-2')
  })
})

describe('ToolsSidebar', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should render all tools', async () => {
    const { container } = render(<ToolsSidebar activeTool="select" onSelectTool={() => {}} />)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="tool-select"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="tool-pan"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="tool-measure-length"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="tool-measure-area"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="tool-count"]')).toBeTruthy()
    })
  })

  it('should highlight active tool', async () => {
    const { container } = render(<ToolsSidebar activeTool="pan" onSelectTool={() => {}} />)
    await vi.waitFor(() => {
      const panButton = container.querySelector('[data-testid="tool-pan"]')
      expect(panButton?.className).toContain('bg-blue-100')
    })
  })

  it('should call onSelectTool when clicked', async () => {
    const onSelectTool = vi.fn()
    const { container } = render(<ToolsSidebar activeTool="select" onSelectTool={onSelectTool} />)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="tool-measure-length"]')).toBeTruthy()
    })
    const button = container.querySelector('[data-testid="tool-measure-length"]') as HTMLButtonElement
    button?.click()
    expect(onSelectTool).toHaveBeenCalledWith('measure-length')
  })
})

describe('TakeoffItemsSidebar', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('should show empty state', async () => {
    const { container } = render(<TakeoffItemsSidebar items={[]} />)
    await vi.waitFor(() => {
      expect(container.textContent).toContain('No takeoff items yet.')
    })
  })

  it('should render list of items', async () => {
    const { container } = render(<TakeoffItemsSidebar items={mockTakeoffItems} />)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="takeoff-item-item-1"]')).toBeTruthy()
      expect(container.textContent).toContain('item-1')
      expect(container.textContent).toContain('120.5 ft')
    })
  })

  it('should call onSelectItem when clicked', async () => {
    const onSelectItem = vi.fn()
    const { container } = render(<TakeoffItemsSidebar items={mockTakeoffItems} onSelectItem={onSelectItem} />)
    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="takeoff-item-item-1"]')).toBeTruthy()
    })
    const button = container.querySelector('[data-testid="takeoff-item-item-1"]') as HTMLButtonElement
    button?.click()
    expect(onSelectItem).toHaveBeenCalledWith('item-1')
  })

  it('should highlight selected item', async () => {
    const { container } = render(<TakeoffItemsSidebar items={mockTakeoffItems} selectedItemId="item-1" />)
    await vi.waitFor(() => {
      const selectedItem = container.querySelector('[data-testid="takeoff-item-item-1"]')
      expect(selectedItem?.className).toContain('bg-blue-50')
    })
  })
})
