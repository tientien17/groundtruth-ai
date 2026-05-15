import React from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SheetLibrary } from './SheetLibrary'

const sheets = [
  {
    id: 'sheet-1',
    document_id: 'doc-1',
    sheet_number: 'A-101',
    sheet_title: 'FIRST FLOOR PLAN',
    page_index: 0,
    thumbnail_url: '/thumbs/a101.png',
    sheet_metadata: { discipline: 'A' },
  },
  {
    id: 'sheet-2',
    document_id: 'doc-1',
    sheet_number: 'S-201',
    sheet_title: 'FOUNDATION PLAN',
    page_index: 1,
    thumbnail_url: null,
    sheet_metadata: { discipline: 'S' },
  },
]

function render(component: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(component)
  return { container, root }
}

describe('SheetLibrary', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => sheets,
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('renders sheet grid with extracted metadata', async () => {
    const { container } = render(
      <SheetLibrary projectId="project-1" projectPath="C:/tmp/project" sidecarPort={8765} />,
    )

    await vi.waitFor(() => {
      expect(container.textContent).toContain('A-101')
      expect(container.textContent).toContain('FIRST FLOOR PLAN')
      expect(container.textContent).toContain('S-201')
      expect(container.textContent).toContain('FOUNDATION PLAN')
    })

    expect(container.querySelectorAll('[data-testid="sheet-card"]')).toHaveLength(2)
  })

  it('switches to list view', async () => {
    const { container } = render(
      <SheetLibrary projectId="project-1" projectPath="C:/tmp/project" sidecarPort={8765} />,
    )

    await vi.waitFor(() => expect(container.textContent).toContain('A-101'))

    const listButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'List',
    )
    expect(listButton).toBeTruthy()
    listButton?.click()

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="sheet-list"]')).toBeTruthy()
      expect(container.textContent).toContain('Discipline')
    })
  })
})
