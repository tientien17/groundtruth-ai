import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WelcomeScreen } from './WelcomeScreen'

function render(component: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  root.render(component)
  return { container, root }
}

describe('WelcomeScreen', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    localStorage.clear()
  })

  it('renders 3-step workflow', async () => {
    const { container } = render(
      <WelcomeScreen sidecarPort={8765} onProjectCreated={vi.fn()} onSkip={vi.fn()} />
    )

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Upload PDFs')
      expect(container.textContent).toContain('Measure & Detect')
      expect(container.textContent).toContain('Export Quantities')
    })
  })

  it('calls POST /projects and onProjectCreated on create click', async () => {
    const projectData = { id: 'proj-1', name: 'Project Demo', path: '/path/demo' }
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => projectData,
    })
    vi.stubGlobal('fetch', mockFetch)
    
    const onProjectCreated = vi.fn()
    const { container } = render(
      <WelcomeScreen sidecarPort={8765} onProjectCreated={onProjectCreated} onSkip={vi.fn()} />
    )

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Create Project')
    })

    const buttons = Array.from(container.querySelectorAll('button'))
    const createButton = buttons.find(b => b.textContent?.includes('Create Project'))
    expect(createButton).toBeTruthy()
    
    createButton?.click()

    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8765/projects',
        expect.objectContaining({ method: 'POST' })
      )
      expect(onProjectCreated).toHaveBeenCalledWith(projectData)
      expect(localStorage.getItem('groundtruth_onboarding_done')).toBe('true')
    })
  })

  it('calls onSkip and sets localStorage on skip click', async () => {
    const onSkip = vi.fn()
    const { container } = render(
      <WelcomeScreen sidecarPort={8765} onProjectCreated={vi.fn()} onSkip={onSkip} />
    )

    await vi.waitFor(() => {
      expect(container.textContent).toContain('Skip for now')
    })

    const buttons = Array.from(container.querySelectorAll('button'))
    const skipButton = buttons.find(b => b.textContent?.includes('Skip for now'))
    expect(skipButton).toBeTruthy()
    
    skipButton?.click()

    await vi.waitFor(() => {
      expect(onSkip).toHaveBeenCalled()
      expect(localStorage.getItem('groundtruth_onboarding_done')).toBe('true')
    })
  })
})
