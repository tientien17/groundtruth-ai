/**
 * Tests for App component — project creation flow.
 *
 * Renders App with mocked fetch and verifies the full project creation lifecycle:
 * - Setup readiness detection via /setup/status
 * - "Create New Project" button rendering
 * - POST /projects API call on click
 * - Workspace rendering on success
 * - Error display on failure
 *
 * NOTE: SetupWizard and Workspace are mocked as simple placeholders to avoid
 * their internal API calls and complexity -- tests focus on App.tsx only.
 */

import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App'

// Mock SetupWizard to a placeholder — avoids its own fetch calls
vi.mock('./components/Setup/SetupWizard', () => ({
  SetupWizard: function MockSetupWizard() {
    return { $$typeof: Symbol.for('react.element'), type: 'div', props: { 'data-testid': 'setup-wizard' }, key: null, ref: null }
  },
}))

// Mock Workspace to a simple div
vi.mock('./components/Workspace/Workspace', () => ({
  Workspace: function MockWorkspace({ projectId }: { projectId: string }) {
    return { $$typeof: Symbol.for('react.element'), type: 'div', props: { 'data-testid': 'workspace', children: `Workspace: ${projectId}` }, key: null, ref: null }
  },
}))

function render(component: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(component)
  return { container, root }
}

describe('App project creation', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('shows create project button when setup is ready and no project exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ required: false }),
      }),
    )

    const { container } = render(<App />)

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Create New Project')
      expect(container.textContent).toContain('Connected to sidecar on port 8765')
    })
  })

  it('calls POST /projects on button click with correct URL and body', async () => {
    const projectData = { id: 'proj-1', name: 'Project 5/22/2026', path: '/path/proj-1' }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => projectData,
    })
    vi.stubGlobal('fetch', mockFetch)

    const { container } = render(<App />)

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Create New Project')
    })

    const button = container.querySelector('button')
    expect(button).toBeTruthy()
    button?.click()

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765/projects',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"name"'),
        }),
      )
    })
  })

  it('renders workspace after project creation succeeds', async () => {
    const projectData = { id: 'proj-1', name: 'Project 5/22/2026', path: '/path/proj-1' }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => projectData,
    })
    vi.stubGlobal('fetch', mockFetch)

    const { container } = render(<App />)

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Create New Project')
    })

    const button = container.querySelector('button') as HTMLButtonElement
    button?.click()

    await vi.waitFor(() => {
      expect(container.querySelector('[data-testid="workspace"]')).toBeTruthy()
      expect(container.textContent).toContain('Workspace: proj-1')
      expect(container.textContent).not.toContain('Create New Project')
    })
  })

  it('shows error message when project creation fails', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server error' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { container } = render(<App />)

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Create New Project')
    })

    const button = container.querySelector('button') as HTMLButtonElement
    button?.click()

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Failed to create project (500)')
      expect(container.textContent).toContain('Create New Project')
    })
  })
})
