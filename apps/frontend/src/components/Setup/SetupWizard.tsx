import { useCallback, useEffect, useState } from 'react'

const SIDECAR_URL = 'http://127.0.0.1:8765'

// ── Types ──────────────────────────────────────────────────────────────

type ModelProgress = {
  status: string
  completed?: number
  total?: number | null
  percent?: number
  error?: string
}

type SetupStatus = {
  required: boolean
  cloud_provider?: {
    configured: boolean
    provider?: string
    base_url?: string
    chat_model?: string
    embedding_model?: string
  }
  ollama: {
    running: boolean
    error?: string | null
  }
  models: Record<string, { installed: boolean; progress?: ModelProgress | null }>
}

type SetupMode = 'local' | 'cloud'

type SetupWizardProps = {
  onReady: () => void
}

type CloudProviderForm = {
  provider: string
  base_url: string
  api_key: string
  chat_model: string
  embedding_model: string
}

const REQUIRED_MODELS = ['llama3.2', 'nomic-embed-text'] as const

const INITIAL_CLOUD_FORM: CloudProviderForm = {
  provider: 'openai_compatible',
  base_url: '',
  api_key: '',
  chat_model: 'gpt-4o',
  embedding_model: 'text-embedding-3-small',
}

// ── Component ──────────────────────────────────────────────────────────

export function SetupWizard({ onReady }: SetupWizardProps) {
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [mode, setMode] = useState<SetupMode | null>(null)
  const [isPulling, setIsPulling] = useState(false)
  const [isInstallingOllama, setIsInstallingOllama] = useState(false)
  const [isSavingCloud, setIsSavingCloud] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cloudForm, setCloudForm] = useState<CloudProviderForm>(INITIAL_CLOUD_FORM)

  // Poll setup status when in local mode
  useEffect(() => {
    if (mode !== 'local') return
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
  }, [mode, isPulling, isInstallingOllama, onReady])

  // Check initial status on mount — if cloud already configured, we're done
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const s = await fetchSetupStatus()
        if (cancelled) return
        if (s.cloud_provider?.configured) {
          onReady()
          return
        }
        setStatus(s)
      } catch {
        // sidecar might not be up yet; surface nothing, let user pick mode
      }
    }
    void check()
    return () => { cancelled = true }
  }, [onReady])

  const startOllamaInstall = useCallback(async () => {
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
  }, [])

  const startPull = useCallback(async () => {
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
  }, [status])

  const saveCloudProvider = useCallback(async () => {
    if (!cloudForm.base_url.trim()) {
      setError('Base URL is required')
      return
    }
    setIsSavingCloud(true)
    setError(null)
    try {
      const payload: Record<string, string> = {
        provider: cloudForm.provider,
        base_url: cloudForm.base_url.replace(/\/+$/, ''),
        chat_model: cloudForm.chat_model,
        embedding_model: cloudForm.embedding_model,
      }
      if (cloudForm.api_key.trim()) {
        payload.api_key = cloudForm.api_key
      }

      const response = await fetch(`${SIDECAR_URL}/setup/provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.error) {
        throw new Error(body.error ?? `Save failed: ${response.status}`)
      }
      onReady()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save provider config')
      setIsSavingCloud(false)
    }
  }, [cloudForm, onReady])

  // ── Mode picker ──────────────────────────────────────────────────────

  if (mode === null) {
    return (
      <main style={styles.shell}>
        <section style={styles.card}>
          <p style={styles.eyebrow}>First-run setup</p>
          <h1 style={styles.title}>Choose your AI provider</h1>
          <p style={styles.copy}>
            GroundTruth Local works with local models (Ollama) or any OpenAI-compatible
            endpoint — including LM Studio, vLLM, cloud providers, or a remote Ollama
            instance.
          </p>

          {error ? <p style={styles.error}>{error}</p> : null}

          <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
            <button type="button" onClick={() => setMode('local')} style={styles.choiceCard}>
              <strong style={{ fontSize: 18 }}>Local AI</strong>
              <span style={{ color: '#94a3b8', fontSize: 14 }}>
                Install Ollama and download models to run entirely on your machine
              </span>
            </button>
            <button type="button" onClick={() => setMode('cloud')} style={styles.choiceCard}>
              <strong style={{ fontSize: 18 }}>Connect existing provider</strong>
              <span style={{ color: '#94a3b8', fontSize: 14 }}>
                Use any OpenAI-compatible API — LM Studio, vLLM, OpenAI, or remote Ollama
              </span>
            </button>
          </div>
        </section>
      </main>
    )
  }

  // ── Cloud provider form ──────────────────────────────────────────────

  if (mode === 'cloud') {
    return (
      <main style={styles.shell}>
        <section style={styles.card}>
          <p style={styles.eyebrow}>Connect provider</p>
          <h1 style={{ ...styles.title, fontSize: 28 }}>OpenAI-compatible endpoint</h1>
          <p style={styles.copy}>
            Enter your provider details. Works with{' '}
            <strong>LM Studio, Ollama (remote), vLLM, OpenAI,</strong> or any API
            that speaks the OpenAI chat completions format.
          </p>

          {error ? <p style={styles.error}>{error}</p> : null}

          <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
            <label style={styles.fieldLabel}>
              Provider type
              <select
                value={cloudForm.provider}
                onChange={(e) => setCloudForm({ ...cloudForm, provider: e.target.value })}
                style={styles.input}
              >
                <option value="openai_compatible">OpenAI-compatible</option>
                <option value="vllm">vLLM</option>
              </select>
            </label>

            <label style={styles.fieldLabel}>
              Base URL *
              <input
                type="url"
                value={cloudForm.base_url}
                onChange={(e) => setCloudForm({ ...cloudForm, base_url: e.target.value })}
                placeholder="http://localhost:1234/v1"
                style={styles.input}
              />
            </label>

            <label style={styles.fieldLabel}>
              API key
              <input
                type="password"
                value={cloudForm.api_key}
                onChange={(e) => setCloudForm({ ...cloudForm, api_key: e.target.value })}
                placeholder="Optional — leave blank if not required"
                style={styles.input}
              />
            </label>

            <label style={styles.fieldLabel}>
              Chat model *
              <input
                type="text"
                value={cloudForm.chat_model}
                onChange={(e) => setCloudForm({ ...cloudForm, chat_model: e.target.value })}
                placeholder="gpt-4o"
                style={styles.input}
              />
            </label>

            <label style={styles.fieldLabel}>
              Embedding model *
              <input
                type="text"
                value={cloudForm.embedding_model}
                onChange={(e) => setCloudForm({ ...cloudForm, embedding_model: e.target.value })}
                placeholder="text-embedding-3-small"
                style={styles.input}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={saveCloudProvider}
            disabled={isSavingCloud || !cloudForm.base_url || !cloudForm.chat_model || !cloudForm.embedding_model}
            style={{ ...styles.button, marginTop: 24 }}
          >
            {isSavingCloud ? 'Saving…' : 'Connect & continue'}
          </button>

          <button
            type="button"
            onClick={() => { setMode('local'); setError(null); setIsSavingCloud(false) }}
            style={{ ...styles.linkButton, marginTop: 12 }}
          >
            ← Use local AI instead
          </button>
        </section>
      </main>
    )
  }

  // ── Local Ollama flow ────────────────────────────────────────────────

  const models = status ? requiredModelEntries(status) : REQUIRED_MODELS.map((model) => [model, null] as const)
  const setupReady = requiredModelsReady(status)

  return (
    <main style={styles.shell}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>Local AI setup</p>
        <h1 style={styles.title}>Prepare local models</h1>
        <p style={styles.copy}>
          GroundTruth Local needs Ollama plus <strong>llama3.2</strong> and{' '}
          <strong>nomic-embed-text</strong> before AI features run.
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

        <button
          type="button"
          onClick={() => { setMode('cloud'); setError(null); setIsPulling(false) }}
          style={{ ...styles.linkButton, marginTop: 12 }}
        >
          Connect a different provider instead →
        </button>
      </section>
    </main>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForOllama(timeoutMs = 60000): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const status: SetupStatus = await fetchSetupStatus()
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

function requiredModelEntries(
  status: SetupStatus,
): Array<[string, { installed: boolean; progress?: ModelProgress | null }]> {
  return REQUIRED_MODELS.map((model) => [model, status.models[model] ?? { installed: false }])
}

function requiredModelsReady(status: SetupStatus | null): boolean {
  return Boolean(
    status?.ollama.running &&
      status &&
      requiredModelEntries(status).every(([, info]) => info.installed),
  )
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

// ── Styles ──────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0f172a', color: '#f8fafc' },
  card: { width: 'min(560px, calc(100vw - 32px))', padding: 32, borderRadius: 24, background: '#111827' },
  eyebrow: { margin: 0, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: 1.5 } as React.CSSProperties,
  title: { margin: '8px 0', fontSize: 34 },
  copy: { color: '#cbd5e1', lineHeight: 1.6 },

  choiceCard: {
    display: 'block',
    width: '100%',
    padding: 20,
    borderRadius: 16,
    border: '2px solid #334155',
    background: '#1e293b',
    cursor: 'pointer',
    textAlign: 'left',
  } as React.CSSProperties,

  button: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    border: 0,
    background: '#38bdf8',
    fontWeight: 700,
    cursor: 'pointer',
  } as React.CSSProperties,

  secondaryButton: {
    background: '#334155',
    color: '#e2e8f0',
  } as React.CSSProperties,

  linkButton: {
    display: 'block',
    width: '100%',
    padding: 10,
    borderRadius: 12,
    border: 0,
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    fontSize: 14,
    textDecoration: 'underline',
  } as React.CSSProperties,

  fieldLabel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 13,
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  } as React.CSSProperties,

  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: 12,
    borderRadius: 10,
    border: '1px solid #334155',
    background: '#0f172a',
    color: '#f1f5f9',
    fontSize: 14,
    outline: 'none',
  } as React.CSSProperties,

  list: { display: 'grid', gap: 16, margin: '24px 0' },
  modelRow: { display: 'grid', gap: 8 },
  modelHeader: { display: 'flex', justifyContent: 'space-between', color: '#e2e8f0' },
  progressTrack: { height: 10, overflow: 'hidden', borderRadius: 999, background: '#334155' },
  progressFill: { height: '100%', borderRadius: 999, background: '#22c55e', transition: 'width 200ms ease' },
  error: { color: '#fca5a5' },
}
