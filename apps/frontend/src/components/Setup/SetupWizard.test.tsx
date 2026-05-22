/**
 * RED phase tests for SetupWizard.
 *
 * These tests validate the component contract before port-mismatch fix.
 * Known bug: frontend defaults to port 8765 but Tauri allocates a random port.
 */

import type React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SetupWizard } from './SetupWizard'

const roots: Root[] = []

function render(component: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  roots.push(root)
  root.render(component)
  return { container, root }
}

function cleanup() {
  for (const root of roots.splice(0)) {
    root.unmount()
  }
  document.body.innerHTML = ''
}

async function clickButton(container: HTMLElement, label: string) {
  await vi.waitFor(() => {
    const button = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes(label),
    )
    expect(button).toBeTruthy()
    button?.click()
  })
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

describe('SetupWizard — port & error behavior', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('shows error message when sidecar is unreachable at given port', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    )
    const onReady = vi.fn()
    const { container } = render(
      <SetupWizard onReady={onReady} sidecarPort={9999} />,
    )

    // Mode selection screen is shown initially
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Choose your AI provider')
    })

    // Click "Offline" to enter offline mode — only now errors surface
    await clickButton(container, 'Offline')

    // Error text from the failed fetch should appear
    await vi.waitFor(() => {
      expect(container.textContent).toContain('Failed to fetch')
    })
  })

  it('calls onReady when setup status returns all models ready', async () => {
    const readyResponse = {
      required: true,
      ollama: { running: true },
      models: {
        'llama3.2': { installed: true, progress: null },
        'nomic-embed-text': { installed: true, progress: null },
      },
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => readyResponse,
      })),
    )
    const onReady = vi.fn()
    const { container } = render(
      <SetupWizard onReady={onReady} sidecarPort={8765} />,
    )

    // Click "Offline" to enter offline mode
    await clickButton(container, 'Offline')

    // The polling effect should detect ready state and fire onReady
    await vi.waitFor(() => {
      expect(onReady).toHaveBeenCalled()
    })
  })

  it('uses the provided sidecarPort in all API URLs', async () => {
    const mockFetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        required: true,
        ollama: { running: true },
        models: {
          'llama3.2': { installed: true },
          'nomic-embed-text': { installed: true },
        },
      }),
    }))
    vi.stubGlobal('fetch', mockFetch)
    const onReady = vi.fn()
    const testPort = 9999

    render(<SetupWizard onReady={onReady} sidecarPort={testPort} />)

    // Wait for at least one fetch call (initial mount check fires immediately)
    await vi.waitFor(() => {
      expect(mockFetch).toHaveBeenCalled()
    })

    // Every API call URL must contain the correct port, never the default 8765
    const calls = mockFetch.mock.calls as unknown as [string, ...unknown[]][]
    for (const [url] of calls) {
      expect(url).toContain(`127.0.0.1:${testPort}`)
      expect(url).not.toContain(`127.0.0.1:8765`)
    }
  })
})

describe('SetupWizard — error category display', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    cleanup()
  })

  it('shows error category label for model download failure', async () => {
    // Initial status response shows ollama running
    const initStatus = {
      required: true,
      ollama: { running: true, error: null },
      models: {
        'llama3.2': { installed: false, progress: null },
        'nomic-embed-text': { installed: false, progress: null },
      },
    }
    // Second status response shows model error with category
    const errorStatus = {
      required: true,
      ollama: { running: true, error: null },
      models: {
        'llama3.2': {
          installed: false,
          progress: {
            status: 'error',
            error: 'Connection refused',
            error_category: 'model_download_failed',
          },
        },
        'nomic-embed-text': { installed: false, progress: null },
      },
    }

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => initStatus })
      .mockResolvedValueOnce({ ok: true, json: async () => initStatus })
      .mockResolvedValue({ ok: true, json: async () => errorStatus })
    vi.stubGlobal('fetch', fetchMock)

    const onReady = vi.fn()
    const { container } = render(
      <SetupWizard onReady={onReady} sidecarPort={9999} />,
    )

    // Enter offline mode and select Ollama
    await clickButton(container, 'Offline')
    await clickButton(container, 'Ollama')
    await clickButton(container, 'Download models')

    // Wait for the error banner to appear with the category label
    await vi.waitFor(() => {
      // The error banner should contain the category label in uppercase
      const text = container.textContent ?? ''
      expect(text).toContain('Model download failed')
      // Should contain the error message from the progress
      expect(text).toContain('Connection refused')
      // Should contain the suggestion text
      expect(text).toContain('internet connection')
    })
  })

  it('shows ollama_not_running banner when ollama is down', async () => {
    const statusResponse = {
      required: true,
      ollama: { running: false, error: 'Connection refused', error_category: 'ollama_not_running' },
      models: {
        'llama3.2': { installed: false, progress: null },
        'nomic-embed-text': { installed: false, progress: null },
      },
    }

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => statusResponse,
      })),
    )

    const onReady = vi.fn()
    const { container } = render(
      <SetupWizard onReady={onReady} sidecarPort={9999} />,
    )

    await clickButton(container, 'Offline')
    await clickButton(container, 'Ollama')

    await vi.waitFor(() => {
      const text = container.textContent ?? ''
      expect(text).toContain('Ollama unreachable')
      expect(text).toContain('Ollama is not reachable')
    })
  })

  it('shows provider validation error category on cloud save failure', async () => {
    // First fetch returns initial status (unconfigured)
    const initStatusResponse = {
      required: true,
      cloud_provider: { configured: false },
      ollama: { running: false, error: 'Connection refused' },
      models: {
        'llama3.2': { installed: false },
        'nomic-embed-text': { installed: false },
      },
    }

    // Cloud save returns structured error category
    const cloudSaveResponse = {
      saved: false,
      error: 'Base URL must start with http:// or https://',
      error_category: 'provider_url_invalid',
    }

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => initStatusResponse })
      .mockResolvedValue({ ok: false, status: 200, json: async () => cloudSaveResponse })
    vi.stubGlobal('fetch', fetchMock)

    const onReady = vi.fn()
    const { container } = render(
      <SetupWizard onReady={onReady} sidecarPort={9999} />,
    )

    // Click cloud provider mode and select 9router
    await clickButton(container, 'Cloud')
    await clickButton(container, '9router')

    // Fill in the form
    const baseUrlInput = container.querySelector('input[type="text"]') as HTMLInputElement
    if (baseUrlInput) {
      setInputValue(baseUrlInput, 'not-a-url')
    }

    // Click save
    await clickButton(container, 'Connect & continue')

    await vi.waitFor(() => {
      const text = container.textContent ?? ''
      expect(text).toContain('Invalid URL')
      expect(text).toContain('Base URL must start with')
    })
  })
})
