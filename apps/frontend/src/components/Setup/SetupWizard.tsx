import { useCallback, useEffect, useState } from 'react'

const baseUrl = (port: number) => `http://127.0.0.1:${port}`

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
  sidecarPort?: number
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

export function SetupWizard({ onReady, sidecarPort = 8765 }: SetupWizardProps) {
  const SIDECAR_URL = baseUrl(sidecarPort)
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
        const nextStatus = await fetchSetupStatus(sidecarPort)
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
  }, [mode, isPulling, isInstallingOllama, onReady, sidecarPort])

  // Check initial status on mount — if cloud already configured, we're done
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const s = await fetchSetupStatus(sidecarPort)
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
  }, [onReady, sidecarPort])

  const startOllamaInstall = useCallback(async () => {
    setIsInstallingOllama(true)
    setError(null)
    try {
      const response = await fetch(`${SIDECAR_URL}/setup/ollama/install`, { method: 'POST' })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.error) {
        throw new Error(body.error ?? `Ollama install failed: ${response.status}`)
      }
      await waitForOllama(sidecarPort)
      setStatus(await fetchSetupStatus(sidecarPort))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ollama install failed')
    } finally {
      setIsInstallingOllama(false)
    }
  }, [sidecarPort])

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
      setStatus(await fetchSetupStatus(sidecarPort))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Model download failed')
      setIsPulling(false)
    }
  }, [status, sidecarPort])

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
      const response = await fetch(`${SIDECAR_URL}/setup/cloud-provider`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || body.error) {
        throw new Error(body.error ?? `Cloud provider setup failed: ${response.status}`)
      }
      onReady()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cloud provider setup failed')
    } finally {
      setIsSavingCloud(false)
    }
  }, [cloudForm, onReady, sidecarPort])

  // ── Mode selection ───────────────────────────────────────────────────

  if (mode === null) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-900 text-slate-50">
        <section className="w-full max-w-[560px] mx-4 p-8 rounded-3xl bg-slate-800">
          <p className="m-0 text-sky-400 uppercase tracking-widest text-xs font-semibold">First-run setup</p>
          <h1 className="mt-2 mb-0 text-3xl font-semibold">Choose your AI provider</h1>
          <p className="text-slate-300 leading-relaxed mt-3">
            GroundTruth Local works with local models (Ollama) or any OpenAI-compatible
            endpoint — including LM Studio, vLLM, cloud providers, or a remote Ollama
            instance.
          </p>

          {error ? <p className="text-error mt-4 p-3 rounded bg-error-light">{error}</p> : null}

          <div className="grid gap-4 mt-6">
            <button 
              type="button" 
              onClick={() => setMode('local')} 
              className="block w-full p-5 rounded-2xl border-2 border-slate-600 bg-slate-700 hover:bg-slate-600 hover:border-slate-500 cursor-pointer text-left transition-colors"
            >
              <strong className="block text-lg font-semibold text-slate-50">Local AI</strong>
              <span className="block text-sm text-slate-400 mt-1">
                Install Ollama and download models to run entirely on your machine
              </span>
            </button>
            <button 
              type="button" 
              onClick={() => setMode('cloud')} 
              className="block w-full p-5 rounded-2xl border-2 border-slate-600 bg-slate-700 hover:bg-slate-600 hover:border-slate-500 cursor-pointer text-left transition-colors"
            >
              <strong className="block text-lg font-semibold text-slate-50">Connect existing provider</strong>
              <span className="block text-sm text-slate-400 mt-1">
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
      <main className="min-h-screen grid place-items-center bg-slate-900 text-slate-50">
        <section className="w-full max-w-[560px] mx-4 p-8 rounded-3xl bg-slate-800">
          <p className="m-0 text-sky-400 uppercase tracking-widest text-xs font-semibold">Connect provider</p>
          <h1 className="mt-2 mb-0 text-[28px] font-semibold">OpenAI-compatible endpoint</h1>
          <p className="text-slate-300 leading-relaxed mt-3">
            Enter your provider details. Works with{' '}
            <strong>LM Studio, Ollama (remote), vLLM, OpenAI,</strong> or any API
            that speaks the OpenAI chat completions format.
          </p>

          {error ? <p className="text-error mt-4 p-3 rounded bg-error-light">{error}</p> : null}

          <div className="grid gap-4 mt-6">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Provider type
              <select
                value={cloudForm.provider}
                onChange={(e) => setCloudForm({ ...cloudForm, provider: e.target.value })}
                className="input"
              >
                <option value="openai_compatible">OpenAI-compatible</option>
                <option value="vllm">vLLM</option>
              </select>
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Base URL
              <input
                type="text"
                value={cloudForm.base_url}
                onChange={(e) => setCloudForm({ ...cloudForm, base_url: e.target.value })}
                placeholder="http://localhost:1234/v1"
                className="input"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              API Key (optional)
              <input
                type="password"
                value={cloudForm.api_key}
                onChange={(e) => setCloudForm({ ...cloudForm, api_key: e.target.value })}
                placeholder="sk-..."
                className="input"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Chat model
              <input
                type="text"
                value={cloudForm.chat_model}
                onChange={(e) => setCloudForm({ ...cloudForm, chat_model: e.target.value })}
                placeholder="gpt-4o"
                className="input"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Embedding model
              <input
                type="text"
                value={cloudForm.embedding_model}
                onChange={(e) => setCloudForm({ ...cloudForm, embedding_model: e.target.value })}
                placeholder="text-embedding-3-small"
                className="input"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={saveCloudProvider}
            disabled={isSavingCloud || !cloudForm.base_url || !cloudForm.chat_model || !cloudForm.embedding_model}
            className="btn btn-primary w-full mt-6 py-3.5 text-base"
          >
            {isSavingCloud ? 'Saving…' : 'Connect & continue'}
          </button>

          <button
            type="button"
            onClick={() => { setMode('local'); setError(null); setIsSavingCloud(false) }}
            className="block w-full mt-3 p-2.5 rounded-xl border-0 bg-transparent text-slate-400 cursor-pointer text-sm underline hover:text-slate-300"
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
    <main className="min-h-screen grid place-items-center bg-slate-900 text-slate-50">
      <section className="w-full max-w-[560px] mx-4 p-8 rounded-3xl bg-slate-800">
        <p className="m-0 text-sky-400 uppercase tracking-widest text-xs font-semibold">Local AI setup</p>
        <h1 className="mt-2 mb-0 text-3xl font-semibold">Prepare local models</h1>
        <p className="text-slate-300 leading-relaxed mt-3">
          GroundTruth Local needs Ollama plus <strong>llama3.2</strong> and{' '}
          <strong>nomic-embed-text</strong> before AI features run.
        </p>

        {error ? <p className="text-error mt-4 p-3 rounded bg-error-light">{error}</p> : null}
        {status && !status.ollama.running ? (
          <p className="text-error mt-4 p-3 rounded bg-error-light">Ollama is not reachable. Install Ollama, then setup continues.</p>
        ) : null}

        {status && !status.ollama.running ? (
          <button 
            type="button" 
            onClick={startOllamaInstall} 
            disabled={isInstallingOllama} 
            className="btn btn-primary w-full mt-6 py-3.5 text-base"
          >
            {isInstallingOllama ? 'Installing Ollama…' : 'Install Ollama'}
          </button>
        ) : null}

        <div className="grid gap-4 my-6">
          {models.map(([model, info]) => {
            const progress = info?.progress
            const percent = getModelPercent(info)
            const displayStatus = getModelStatus(info)
            return (
              <div key={model} className="grid gap-2">
                <div className="flex justify-between items-center text-slate-200">
                  <strong>{model}</strong>
                  <span className={displayStatus === 'failed' ? 'text-error' : ''}>
                    {displayStatus}
                  </span>
                </div>
                {progress && !info?.installed ? (
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-600">
                    <div
                      className="h-full bg-sky-400 transition-all duration-300"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>

        {status?.ollama.running && !setupReady ? (
          <button
            type="button"
            onClick={startPull}
            disabled={isPulling}
            className="btn btn-primary w-full py-3.5 text-base"
          >
            {isPulling ? 'Downloading models…' : 'Download models'}
          </button>
        ) : null}

        {setupReady ? (
          <button
            type="button"
            onClick={onReady}
            className="btn btn-primary w-full py-3.5 text-base"
          >
            Continue to app
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => { setMode('cloud'); setError(null); setIsPulling(false) }}
          className="block w-full mt-3 p-2.5 rounded-xl border-0 bg-transparent text-slate-400 cursor-pointer text-sm underline hover:text-slate-300"
        >
          Use cloud provider instead →
        </button>
      </section>
    </main>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function waitForOllama(sidecarPort = 8765, timeoutMs = 60000): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const status: SetupStatus = await fetchSetupStatus(sidecarPort)
    if (status.ollama.running) return
    await new Promise((resolve) => window.setTimeout(resolve, 1000))
  }
  throw new Error('Ollama installed, but service did not respond before timeout')
}

async function fetchSetupStatus(sidecarPort: number): Promise<SetupStatus> {
  const response = await fetch(`http://127.0.0.1:${sidecarPort}/setup/status`)
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
