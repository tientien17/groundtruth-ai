import { useEffect, useState } from 'react'

const SIDECAR_URL = 'http://127.0.0.1:8765'

type ModelProgress = {
  status: string
  completed?: number
  total?: number | null
  percent?: number
  error?: string
}

type SetupStatus = {
  required: boolean
  ollama: {
    running: boolean
    error?: string | null
  }
  models: Record<string, { installed: boolean; progress?: ModelProgress | null }>
}

type SetupWizardProps = {
  onReady: () => void
}

const REQUIRED_MODELS = ['llama3.2', 'nomic-embed-text'] as const

export function SetupWizard({ onReady }: SetupWizardProps) {
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [isPulling, setIsPulling] = useState(false)
  const [isInstallingOllama, setIsInstallingOllama] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function refresh() {
      try {
        const nextStatus = await fetchSetupStatus()
        if (cancelled) return
        setStatus(nextStatus)
        setError(null)
        const allModelsReady = requiredModelsReady(nextStatus)
        const hasActivePull = requiredModelEntries(nextStatus).some(([, info]) => isActiveProgress(info.progress))
        const failedProgress = requiredModelEntries(nextStatus).find(([, info]) => info.progress?.status === 'error')

        setIsPulling(hasActivePull)
        if (failedProgress) {
          const [model, info] = failedProgress
          setError(info.progress?.error ?? `${model} download failed`)
        } else {
          setError(null)
        }

        if (allModelsReady) {
          onReady()
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Setup check failed')
      }
    }

    void refresh()
    const interval = window.setInterval(refresh, isPulling || isInstallingOllama ? 1000 : 5000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [isPulling, isInstallingOllama, onReady])

  async function startOllamaInstall() {
    setIsInstallingOllama(true)
    setError(null)
    try {
      const response = await fetch(`${SIDECAR_URL}/setup/ollama/install`, { method: 'POST' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.error) {
        throw new Error(body.error ?? `Ollama install failed: ${response.status}`)
      }
      await waitForOllama()
      setStatus(await fetchSetupStatus())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ollama install failed')
    } finally {
      setIsInstallingOllama(false)
    }
  }

  async function startPull() {
    setIsPulling(true)
    setError(null)
    try {
      const models = status ? missingModels(status) : [...REQUIRED_MODELS]
      const response = await fetch(`${SIDECAR_URL}/setup/models/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.error) {
        throw new Error(body.error ?? `Model download failed: ${response.status}`)
      }
      setStatus(await fetchSetupStatus())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Model download failed')
      setIsPulling(false)
    }
  }

  const models = status ? requiredModelEntries(status) : REQUIRED_MODELS.map((model) => [model, null] as const)
  const setupReady = requiredModelsReady(status)

  return (
    <main style={styles.shell}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>First-run setup</p>
        <h1 style={styles.title}>Prepare local AI models</h1>
        <p style={styles.copy}>
          GroundTruth Local needs Ollama plus llama3.2 and nomic-embed-text before AI features run.
        </p>

        {error ? <p style={styles.error}>{error}</p> : null}
        {status && !status.ollama.running ? (
          <p style={styles.error}>Ollama is not reachable. Install Ollama, then setup continues.</p>
        ) : null}

        {status && !status.ollama.running ? (
          <button type="button" onClick={startOllamaInstall} disabled={isInstallingOllama} style={styles.button}>
            {isInstallingOllama ? 'Installing Ollama…' : 'Install Ollama'}
          </button>
        ) : null}

        <div style={styles.list}>
          {models.map(([model, info]) => {
            const progress = info?.progress
            const percent = getModelPercent(info)
            const displayStatus = getModelStatus(info)
            return (
              <div key={model} style={styles.modelRow}>
                <div style={styles.modelHeader}>
                  <strong>{model}</strong>
                  <span style={displayStatus === 'failed' ? styles.error : undefined}>
                    {displayStatus} · {percent}%
                  </span>
                </div>
                <div style={styles.progressTrack}>
                  <div style={{ ...styles.progressFill, width: `${percent}%` }} />
                </div>
                {progress?.error ? <small style={styles.error}>{progress.error}</small> : null}
              </div>
            )
          })}
        </div>

        <button
          type="button"
          onClick={startPull}
          disabled={!status?.ollama.running || missingModels(status).length === 0 || isPulling || setupReady}
          style={styles.button}
        >
          {isPulling ? 'Downloading models…' : 'Download missing models'}
        </button>

        <button type="button" onClick={onReady} disabled={!setupReady} style={{ ...styles.button, ...styles.secondaryButton }}>
          Get Started
        </button>
      </section>
    </main>
  )
}

async function waitForOllama(timeoutMs = 60000): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const status = await fetchSetupStatus()
    if (status.ollama.running) return
    await new Promise((resolve) => window.setTimeout(resolve, 1000))
  }
  throw new Error('Ollama installed, but service did not respond before timeout')
}

async function fetchSetupStatus(): Promise<SetupStatus> {
  const response = await fetch(`${SIDECAR_URL}/setup/status`)
  if (!response.ok) throw new Error(`Setup status failed: ${response.status}`)
  return response.json()
}

function missingModels(status: SetupStatus | null): string[] {
  if (!status) return []
  return requiredModelEntries(status)
    .filter(([, info]) => !info.installed)
    .map(([model]) => model)
}

function requiredModelEntries(status: SetupStatus): Array<[string, { installed: boolean; progress?: ModelProgress | null }]> {
  return REQUIRED_MODELS.map((model) => [model, status.models[model] ?? { installed: false }])
}

function requiredModelsReady(status: SetupStatus | null): boolean {
  return Boolean(status?.ollama.running && status && requiredModelEntries(status).every(([, info]) => info.installed))
}

function isActiveProgress(progress?: ModelProgress | null): boolean {
  return progress?.status === 'queued' || progress?.status === 'downloading' || progress?.status === 'pulling'
}

function getModelPercent(info: { installed: boolean; progress?: ModelProgress | null } | null): number {
  if (info?.installed) return 100
  return Math.max(0, Math.min(100, info?.progress?.percent ?? 0))
}

function getModelStatus(info: { installed: boolean; progress?: ModelProgress | null } | null): string {
  if (info?.installed) return 'ready'
  if (info?.progress?.status === 'error') return 'failed'
  if ((info?.progress?.percent ?? 0) >= 100 || info?.progress?.status === 'complete') return 'verifying'
  if (isActiveProgress(info?.progress)) return info?.progress?.status === 'queued' ? 'queued' : 'downloading'
  return 'queued'
}

const styles = {
  shell: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f172a', color: '#f8fafc' },
  card: { width: 'min(560px, calc(100vw - 32px))', padding: 32, borderRadius: 24, background: '#111827' },
  eyebrow: { margin: 0, color: '#38bdf8', textTransform: 'uppercase' as const, letterSpacing: 1.5 },
  title: { margin: '8px 0', fontSize: 34 },
  copy: { color: '#cbd5e1', lineHeight: 1.6 },
  list: { display: 'grid', gap: 16, margin: '24px 0' },
  modelRow: { display: 'grid', gap: 8 },
  modelHeader: { display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' },
  progressTrack: { height: 10, overflow: 'hidden', borderRadius: 999, background: '#334155' },
  progressFill: { height: '100%', borderRadius: 999, background: '#22c55e', transition: 'width 200ms ease' },
  button: { width: '100%', padding: 14, borderRadius: 12, border: 0, background: '#38bdf8', fontWeight: 700 },
  secondaryButton: { marginTop: 12, background: '#22c55e' },
  error: { color: '#fca5a5' },
}
