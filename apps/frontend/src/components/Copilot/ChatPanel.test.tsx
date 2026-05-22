import type React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ChatPanel } from './ChatPanel'

function render(component: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(component)
  return { container, root }
}

describe('ChatPanel', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('shows prompt and thinking-safe submit controls', async () => {
    const { container } = render(
      <ChatPanel projectId="project-1" projectPath="/project" sidecarPort={8000} />,
    )

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="copilot-chat"]')).toBeTruthy()
      expect(container.textContent).toContain('Answers only from indexed PDFs.')
      expect(container.querySelector('button[type="submit"]')).toBeTruthy()
    })
  })

  it('renders citations as sheet/page buttons after answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        answer: 'Use detail on C-201. [1]',
        citations: [
          {
            index: 1,
            document_id: 'doc-1',
            sheet_id: 'sheet-1',
            sheet_number: 'C-201',
            page: 3,
            text: 'reinforced concrete headwall detail',
            score: 0.9,
          },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    const onSelectSheet = vi.fn()
    const { container } = render(
      <ChatPanel
        projectId="project-1"
        projectPath="/project"
        sidecarPort={8000}
        onSelectSheet={onSelectSheet}
      />,
    )

    await vi.waitFor(() => expect(container.querySelector('input[type="text"]')).toBeTruthy())
    const input = container.querySelector('input[type="text"]') as HTMLInputElement
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set
      valueSetter?.call(input, 'Where is headwall?')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    const form = container.querySelector('form') as HTMLFormElement
    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Use detail on C-201. [1]')
      expect(container.textContent).toContain('Sheet C-201')
      expect(container.textContent).toContain('Page 3')
    })

    ;(container.querySelectorAll('button[type="button"]')[1] as HTMLButtonElement).click()
    expect(onSelectSheet).toHaveBeenCalledWith('sheet-1')
  })
})
