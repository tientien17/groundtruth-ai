/**
 * Tests for QuantityTable.
 */

import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TakeoffItem } from '../Workspace/types'
import { QuantityTable } from './QuantityTable'

const items: TakeoffItem[] = [
  {
    id: 'wall-1',
    label: 'Wall Length',
    type: 'length',
    value: 100,
    unit: 'ft',
    sheetId: 'sheet-1',
    color: '#2563eb',
    classification: 'Walls',
    formula: 'QTY * 1.1',
    finalQuantity: 110,
  },
  {
    id: 'door-1',
    label: 'Door Count',
    type: 'count',
    value: 4,
    unit: 'count',
    sheetId: 'sheet-1',
    color: '#16a34a',
    classification: 'Doors',
  },
]

function render(component: ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(component)
  return { container, root }
}

describe('QuantityTable', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('groups rows by classification and shows quantities', async () => {
    const { container } = render(
      <QuantityTable
        items={items}
        projectId="project-1"
        projectPath="C:/Projects/Demo.gtl"
        sidecarPort={8765}
        sheetId="sheet-1"
      />
    )

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="quantity-row-door-1"]')).toBeTruthy()
      expect(container.querySelector('[data-testid="quantity-row-wall-1"]')).toBeTruthy()
      expect(container.textContent).toContain('Doors')
      expect(container.textContent).toContain('Walls')
      expect(container.textContent).toContain('100')
      expect(container.textContent).toContain('110 ft')
    })
  })

  it('builds project and sheet Excel export links', async () => {
    const { container } = render(
      <QuantityTable
        items={items}
        projectId="project-1"
        projectPath="C:/Projects/Demo.gtl"
        sidecarPort={8765}
        sheetId="sheet-1"
      />
    )

    await vi.waitFor(() => {
      const projectLink = container.querySelector('[data-testid="export-project-link"]') as HTMLAnchorElement
      const sheetLink = container.querySelector('[data-testid="export-sheet-link"]') as HTMLAnchorElement
      expect(projectLink.href).toContain('http://127.0.0.1:8765/projects/project-1/export.xlsx')
      expect(projectLink.href).toContain('project_path=C%3A%2FProjects%2FDemo.gtl')
      expect(sheetLink.href).toContain('sheet_id=sheet-1')
    })
  })

  it('shows an empty state without quantities', async () => {
    const { container } = render(
      <QuantityTable
        items={[]}
        projectId="project-1"
        projectPath="C:/Projects/Demo.gtl"
        sidecarPort={8765}
      />
    )

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="quantity-table-empty"]')).toBeTruthy()
      expect(container.textContent).toContain('No quantities to show yet.')
    })
  })
})
