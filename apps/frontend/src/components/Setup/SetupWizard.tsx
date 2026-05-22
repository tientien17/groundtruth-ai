import { useCallback, useEffect, useState } from 'react'

const baseUrl = (port: number) => `http://127.0.0.1:${port}`

// ── Types ──────────────────────────────────────────────────────────────

type ErrorCategory =
  | 'ollama_not_running'
  | 'ollama_install_failed'
  | 'model_download_failed'
  | 'provider_connection_failed'
  | 'provider_validation_failed'
  | 'provider_url_invalid'
  | 'provider_not_reachable'
  | 'sidecar_config_error'
  | 'network_error'
  | 'unknown'

type SetupError = {
  message: string
  category: ErrorCategory
}

type ModelProgress = {
  status: string
  completed?: number
  total?: number | null
  percent?: number
  error?: string
  error_category?: ErrorCategory
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
    error_category?: ErrorCategory | null
  }
  models: Record<string, { installed: boolean; progress?: ModelProgress | null }>
}

type SetupMode = 'offline' | 'cloud'

type OfflineProvider = 
  | 'ollama'
  | 'lmstudio'
  | 'vllm'
  | 'jan'
  | 'gpt4all'
  | 'localai'
  | 'kobold'
  | 'textgen-webui'
  | 'oobabooga'
  | 'llamacpp'

type CloudProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | '9router'
  | 'azure'

type ProviderConfig = {
  id: string
  name: string
  description: string
  defaultBaseUrl: string
  defaultChatModel: string
  defaultEmbeddingModel: string
  requiresApiKey: boolean
}

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

const OFFLINE_PROVIDERS: Record<OfflineProvider, ProviderConfig> = {
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    description: 'Run models locally with Ollama',
    defaultBaseUrl: 'http://localhost:11434/v1',
    defaultChatModel: 'llama3.2',
    defaultEmbeddingModel: 'nomic-embed-text',
    requiresApiKey: false,
  },
  lmstudio: {
    id: 'lmstudio',
    name: 'LM Studio',
    description: 'Local inference with LM Studio',
    defaultBaseUrl: 'http://localhost:1234/v1',
    defaultChatModel: 'local-model',
    defaultEmbeddingModel: 'nomic-embed-text',
    requiresApiKey: false,
  },
  vllm: {
    id: 'vllm',
    name: 'vLLM',
    description: 'High-performance local inference',
    defaultBaseUrl: 'http://localhost:8000/v1',
    defaultChatModel: 'meta-llama/Llama-3.2-3B-Instruct',
    defaultEmbeddingModel: 'BAAI/bge-small-en-v1.5',
    requiresApiKey: false,
  },
  jan: {
    id: 'jan',
    name: 'Jan',
    description: 'Open-source ChatGPT alternative',
    defaultBaseUrl: 'http://localhost:1337/v1',
    defaultChatModel: 'llama3.2',
    defaultEmbeddingModel: 'nomic-embed-text',
    requiresApiKey: false,
  },
  gpt4all: {
    id: 'gpt4all',
    name: 'GPT4All',
    description: 'Privacy-focused local AI',
    defaultBaseUrl: 'http://localhost:4891/v1',
    defaultChatModel: 'mistral-7b-instruct',
    defaultEmbeddingModel: 'all-MiniLM-L6-v2',
    requiresApiKey: false,
  },
  localai: {
    id: 'localai',
    name: 'LocalAI',
    description: 'OpenAI-compatible local server',
    defaultBaseUrl: 'http://localhost:8080/v1',
    defaultChatModel: 'gpt-3.5-turbo',
    defaultEmbeddingModel: 'text-embedding-ada-002',
    requiresApiKey: false,
  },
  kobold: {
    id: 'kobold',
    name: 'KoboldAI',
    description: 'Browser-based AI for writing',
    defaultBaseUrl: 'http://localhost:5001/v1',
    defaultChatModel: 'koboldcpp',
    defaultEmbeddingModel: 'all-MiniLM-L6-v2',
    requiresApiKey: false,
  },
  'textgen-webui': {
    id: 'textgen-webui',
    name: 'Text Generation WebUI',
    description: 'Gradio web UI for LLMs',
    defaultBaseUrl: 'http://localhost:5000/v1',
    defaultChatModel: 'text-generation-webui',
    defaultEmbeddingModel: 'sentence-transformers',
    requiresApiKey: false,
  },
  oobabooga: {
    id: 'oobabooga',
    name: 'Oobabooga',
    description: 'Text generation web UI',
    defaultBaseUrl: 'http://localhost:5000/v1',
    defaultChatModel: 'oobabooga',
    defaultEmbeddingModel: 'all-MiniLM-L6-v2',
    requiresApiKey: false,
  },
  llamacpp: {
    id: 'llamacpp',
    name: 'llama.cpp Server',
    description: 'Efficient C++ inference server',
    defaultBaseUrl: 'http://localhost:8080/v1',
    defaultChatModel: 'llama-model',
    defaultEmbeddingModel: 'embedding-model',
    requiresApiKey: false,
  },
}

const CLOUD_PROVIDERS: Record<CloudProvider, ProviderConfig> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    description: 'GPT-4, GPT-4o, and more',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultChatModel: 'gpt-4o',
    defaultEmbeddingModel: 'text-embedding-3-small',
    requiresApiKey: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    description: 'Claude 3.5 Sonnet and more',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultChatModel: 'claude-3-5-sonnet-20241022',
    defaultEmbeddingModel: 'voyage-3',
    requiresApiKey: true,
  },
  google: {
    id: 'google',
    name: 'Google AI',
    description: 'Gemini 2.0 and more',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1',
    defaultChatModel: 'gemini-2.0-flash-exp',
    defaultEmbeddingModel: 'text-embedding-004',
    requiresApiKey: true,
  },
  '9router': {
    id: '9router',
    name: '9router',
    description: 'Multi-provider AI routing',
    defaultBaseUrl: 'https://api.9router.com/v1',
    defaultChatModel: 'gpt-4o',
    defaultEmbeddingModel: 'text-embedding-3-small',
    requiresApiKey: false,
  },
  azure: {
    id: 'azure',
    name: 'Azure OpenAI',
    description: 'Enterprise OpenAI via Azure',
    defaultBaseUrl: 'https://YOUR-RESOURCE.openai.azure.com',
    defaultChatModel: 'gpt-4o',
    defaultEmbeddingModel: 'text-embedding-3-small',
    requiresApiKey: true,
  },
}

const REQUIRED_MODELS = ['llama3.2', 'nomic-embed-text'] as const

const INITIAL_CLOUD_FORM: CloudProviderForm = {
  provider: 'openai_compatible',
  base_url: '',
  api_key: '',
  chat_model: 'gpt-4o',
  embedding_model: 'text-embedding-3-small',
}

// ── Error display config ──────────────────────────────────────────────

type ErrorDisplayConfig = {
  icon: string
  label: string
  suggestion: string
}

const ERROR_DISPLAY: Record<ErrorCategory, ErrorDisplayConfig> = {
  ollama_not_running: {
    icon: '⚡',
    label: 'Ollama unreachable',
    suggestion: 'Make sure Ollama is installed and running on your machine.',
  },
  ollama_install_failed: {
    icon: '⚡',
    label: 'Ollama install failed',
    suggestion: 'Try installing Ollama manually from ollama.com, then restart.',
  },
  model_download_failed: {
    icon: '⬇',
    label: 'Model download failed',
    suggestion: 'Check your internet connection and try again.',
  },
  provider_connection_failed: {
    icon: '🔗',
    label: 'Provider unreachable',
    suggestion: 'Verify the Base URL is correct and the provider is running.',
  },
  provider_validation_failed: {
    icon: '⚠',
    label: 'Invalid provider config',
    suggestion: 'Check the provider fields and try again.',
  },
  provider_url_invalid: {
    icon: '⚠',
    label: 'Invalid URL',
    suggestion: 'Base URL must start with http:// or https://.',
  },
  provider_not_reachable: {
    icon: '🔗',
    label: 'Provider not reachable',
    suggestion: 'Verify the endpoint is accepting connections.',
  },
  sidecar_config_error: {
    icon: '⚙',
    label: 'Configuration error',
    suggestion: 'A required environment variable is missing.',
  },
  network_error: {
    icon: '🌐',
    label: 'Network error',
    suggestion: 'Check your internet connection and try again.',
  },
  unknown: {
    icon: '✕',
    label: 'Setup error',
    suggestion: 'An unexpected error occurred. Try restarting the application.',
  },
}

function ErrorBanner({ error: err }: { error: SetupError }) {
  const cfg = ERROR_DISPLAY[err.category] ?? ERROR_DISPLAY.unknown
  return (
    <div className="mt-4 p-3 rounded bg-error-light text-error" role="alert">
      <strong className="text-xs uppercase tracking-wider">{cfg.label}</strong>
      <p className="mt-1 text-sm">{err.message}</p>
      <p className="mt-1 text-xs opacity-70">{cfg.suggestion}</p>
    </div>
  )
}

function setupErrorFromResponse(
  body: Record<string, unknown> | null,
  fallback: string,
  fallbackCategory: ErrorCategory = 'unknown',
): SetupError {
  const category = (body?.error_category as ErrorCategory) ?? fallbackCategory
  return {
    message: (body?.error as string) ?? fallback,
    category,
  }
}

// ── Component ──────────────────────────────────────────────────────────

export function SetupWizard({ onReady, sidecarPort = 8765 }: SetupWizardProps) {
  const SIDECAR_URL = baseUrl(sidecarPort)
  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [mode, setMode] = useState<SetupMode | null>(null)
  const [selectedOfflineProvider, setSelectedOfflineProvider] = useState<OfflineProvider | null>(null)
  const [selectedCloudProvider, setSelectedCloudProvider] = useState<CloudProvider | null>(null)
  const [isPulling, setIsPulling] = useState(false)
  const [isInstallingOllama, setIsInstallingOllama] = useState(false)
  const [isSavingCloud, setIsSavingCloud] = useState(false)
  const [error, setError] = useState<SetupError | null>(null)
  const [cloudForm, setCloudForm] = useState<CloudProviderForm>(INITIAL_CLOUD_FORM)

  // Poll setup status when in offline mode
  useEffect(() => {
    if (mode !== 'offline') return
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
          const cat = info?.progress?.error_category ?? 'model_download_failed'
          setError({ message: info.progress?.error ?? `${model} download failed`, category: cat })
        } else {
          setError(null)
        }

        if (allModelsReady) {
          onReady()
        }
      } catch (err) {
        if (!cancelled) {
          setError({
            message: err instanceof Error ? err.message : 'Setup check failed',
            category: 'network_error',
          })
        }
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
      const body: Record<string, unknown> | null = await response.json().catch(() => null)
      if (!response.ok || (body && body.error)) {
        if (body) {
          setError(setupErrorFromResponse(body, body.error as string ?? `Ollama install failed: ${response.status}`, 'ollama_install_failed'))
        } else {
          setError({ message: `Ollama install failed: ${response.status}`, category: 'ollama_install_failed' })
        }
        return
      }
      await waitForOllama(sidecarPort)
      setStatus(await fetchSetupStatus(sidecarPort))
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Ollama install failed',
        category: 'ollama_install_failed',
      })
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
      const body: Record<string, unknown> | null = await response.json().catch(() => null)
      if (!response.ok || (body && body.error)) {
        if (body) {
          setError(setupErrorFromResponse(body, body.error as string ?? `Model download failed: ${response.status}`, 'model_download_failed'))
        } else {
          setError({ message: `Model download failed: ${response.status}`, category: 'model_download_failed' })
        }
        return
      }
      setStatus(await fetchSetupStatus(sidecarPort))
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Model download failed',
        category: 'model_download_failed',
      })
      setIsPulling(false)
    }
  }, [status, sidecarPort])

  const saveCloudProvider = useCallback(async () => {
    if (!cloudForm.base_url.trim()) {
      setError({ message: 'Base URL is required', category: 'provider_validation_failed' })
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
      const body: Record<string, unknown> | null = await response.json().catch(() => null)
      if (!response.ok || (body && body.error)) {
        if (body) {
          setError(setupErrorFromResponse(body, body.error as string ?? `Cloud provider setup failed: ${response.status}`, 'provider_validation_failed'))
        } else {
          setError({ message: `Cloud provider setup failed: ${response.status}`, category: 'provider_connection_failed' })
        }
        return
      }
      onReady()
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : 'Cloud provider setup failed',
        category: 'provider_connection_failed',
      })
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
            GroundTruth Local works with offline endpoints (Ollama, LM Studio, vLLM, etc.) 
            or cloud providers (OpenAI, Anthropic, 9router, etc.).
          </p>

          {error ? <ErrorBanner error={error} /> : null}

          <div className="grid gap-4 mt-6">
            <button 
              type="button" 
              onClick={() => setMode('offline')} 
              className="block w-full p-5 rounded-2xl border-2 border-slate-600 bg-slate-700 hover:bg-slate-600 hover:border-slate-500 cursor-pointer text-left transition-colors"
            >
              <strong className="block text-lg font-semibold text-slate-50">Offline</strong>
              <span className="block text-sm text-slate-400 mt-1">
                Run models locally with Ollama, LM Studio, vLLM, or other local servers
              </span>
            </button>
            <button 
              type="button" 
              onClick={() => setMode('cloud')} 
              className="block w-full p-5 rounded-2xl border-2 border-slate-600 bg-slate-700 hover:bg-slate-600 hover:border-slate-500 cursor-pointer text-left transition-colors"
            >
              <strong className="block text-lg font-semibold text-slate-50">Cloud</strong>
              <span className="block text-sm text-slate-400 mt-1">
                Connect to OpenAI, Anthropic, Google AI, 9router, or Azure OpenAI
              </span>
            </button>
          </div>
        </section>
      </main>
    )
  }

  // ── Offline provider selection ───────────────────────────────────────

  if (mode === 'offline' && selectedOfflineProvider === null) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-900 text-slate-50">
        <section className="w-full max-w-[720px] mx-4 p-8 rounded-3xl bg-slate-800">
          <p className="m-0 text-sky-400 uppercase tracking-widest text-xs font-semibold">Offline setup</p>
          <h1 className="mt-2 mb-0 text-3xl font-semibold">Choose your offline provider</h1>
          <p className="text-slate-300 leading-relaxed mt-3">
            Select the local AI server you want to use. All options run entirely on your machine.
          </p>

          {error ? <ErrorBanner error={error} /> : null}

          <div className="grid grid-cols-2 gap-3 mt-6">
            {(Object.entries(OFFLINE_PROVIDERS) as [OfflineProvider, ProviderConfig][]).map(([id, config]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSelectedOfflineProvider(id)
                  setCloudForm({
                    provider: config.id,
                    base_url: config.defaultBaseUrl,
                    api_key: '',
                    chat_model: config.defaultChatModel,
                    embedding_model: config.defaultEmbeddingModel,
                  })
                }}
                className="p-4 rounded-xl border-2 border-slate-600 bg-slate-700 hover:bg-slate-600 hover:border-slate-500 cursor-pointer text-left transition-colors"
              >
                <strong className="block text-base font-semibold text-slate-50">{config.name}</strong>
                <span className="block text-xs text-slate-400 mt-1">{config.description}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { setMode(null); setError(null) }}
            className="block w-full mt-6 p-2.5 rounded-xl border-0 bg-transparent text-slate-400 cursor-pointer text-sm underline hover:text-slate-300"
          >
            ← Back to mode selection
          </button>
        </section>
      </main>
    )
  }

  // ── Cloud provider selection ─────────────────────────────────────────

  if (mode === 'cloud' && selectedCloudProvider === null) {
    return (
      <main className="min-h-screen grid place-items-center bg-slate-900 text-slate-50">
        <section className="w-full max-w-[720px] mx-4 p-8 rounded-3xl bg-slate-800">
          <p className="m-0 text-sky-400 uppercase tracking-widest text-xs font-semibold">Cloud setup</p>
          <h1 className="mt-2 mb-0 text-3xl font-semibold">Choose your cloud provider</h1>
          <p className="text-slate-300 leading-relaxed mt-3">
            Select the cloud AI service you want to use. Requires an API key.
          </p>

          {error ? <ErrorBanner error={error} /> : null}

          <div className="grid grid-cols-2 gap-3 mt-6">
            {(Object.entries(CLOUD_PROVIDERS) as [CloudProvider, ProviderConfig][]).map(([id, config]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setSelectedCloudProvider(id)
                  setCloudForm({
                    provider: config.id,
                    base_url: config.defaultBaseUrl,
                    api_key: '',
                    chat_model: config.defaultChatModel,
                    embedding_model: config.defaultEmbeddingModel,
                  })
                }}
                className="p-4 rounded-xl border-2 border-slate-600 bg-slate-700 hover:bg-slate-600 hover:border-slate-500 cursor-pointer text-left transition-colors"
              >
                <strong className="block text-base font-semibold text-slate-50">{config.name}</strong>
                <span className="block text-xs text-slate-400 mt-1">{config.description}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => { setMode(null); setError(null) }}
            className="block w-full mt-6 p-2.5 rounded-xl border-0 bg-transparent text-slate-400 cursor-pointer text-sm underline hover:text-slate-300"
          >
            ← Back to mode selection
          </button>
        </section>
      </main>
    )
  }

  // ── Cloud provider form ──────────────────────────────────────────────

  if (mode === 'cloud') {
    const providerConfig = selectedCloudProvider ? CLOUD_PROVIDERS[selectedCloudProvider] : null
    return (
      <main className="min-h-screen grid place-items-center bg-slate-900 text-slate-50">
        <section className="w-full max-w-[560px] mx-4 p-8 rounded-3xl bg-slate-800">
          <p className="m-0 text-sky-400 uppercase tracking-widest text-xs font-semibold">Connect provider</p>
          <h1 className="mt-2 mb-0 text-[28px] font-semibold">
            {providerConfig ? `Configure ${providerConfig.name}` : 'OpenAI-compatible endpoint'}
          </h1>
          <p className="text-slate-300 leading-relaxed mt-3">
            {providerConfig 
              ? `Enter your ${providerConfig.name} API details to continue.`
              : 'Enter your provider details. Works with LM Studio, Ollama (remote), vLLM, OpenAI, or any API that speaks the OpenAI chat completions format.'
            }
          </p>

          {error ? <ErrorBanner error={error} /> : null}

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

            {(!providerConfig || providerConfig.requiresApiKey) ? (
              <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
                API Key
                <input
                  type="password"
                  value={cloudForm.api_key}
                  onChange={(e) => setCloudForm({ ...cloudForm, api_key: e.target.value })}
                  placeholder="sk-..."
                  className="input"
                />
              </label>
            ) : null}

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
            onClick={() => { setSelectedCloudProvider(null); setError(null); setIsSavingCloud(false) }}
            className="block w-full mt-3 p-2.5 rounded-xl border-0 bg-transparent text-slate-400 cursor-pointer text-sm underline hover:text-slate-300"
          >
            ← Back to provider selection
          </button>
        </section>
      </main>
    )
  }

  // ── Offline provider configuration ───────────────────────────────────

  // For non-Ollama offline providers, show generic configuration form
  if (mode === 'offline' && selectedOfflineProvider && selectedOfflineProvider !== 'ollama') {
    const providerConfig = OFFLINE_PROVIDERS[selectedOfflineProvider]
    return (
      <main className="min-h-screen grid place-items-center bg-slate-900 text-slate-50">
        <section className="w-full max-w-[560px] mx-4 p-8 rounded-3xl bg-slate-800">
          <p className="m-0 text-sky-400 uppercase tracking-widest text-xs font-semibold">Offline setup</p>
          <h1 className="mt-2 mb-0 text-[28px] font-semibold">Configure {providerConfig.name}</h1>
          <p className="text-slate-300 leading-relaxed mt-3">
            Enter your {providerConfig.name} endpoint details. Make sure {providerConfig.name} is running on your machine.
          </p>

          {error ? <ErrorBanner error={error} /> : null}

          <div className="grid gap-4 mt-6">
            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Base URL
              <input
                type="text"
                value={cloudForm.base_url}
                onChange={(e) => setCloudForm({ ...cloudForm, base_url: e.target.value })}
                placeholder={providerConfig.defaultBaseUrl}
                className="input"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Chat model
              <input
                type="text"
                value={cloudForm.chat_model}
                onChange={(e) => setCloudForm({ ...cloudForm, chat_model: e.target.value })}
                placeholder={providerConfig.defaultChatModel}
                className="input"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">
              Embedding model
              <input
                type="text"
                value={cloudForm.embedding_model}
                onChange={(e) => setCloudForm({ ...cloudForm, embedding_model: e.target.value })}
                placeholder={providerConfig.defaultEmbeddingModel}
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
            onClick={() => { setSelectedOfflineProvider(null); setError(null); setIsSavingCloud(false) }}
            className="block w-full mt-3 p-2.5 rounded-xl border-0 bg-transparent text-slate-400 cursor-pointer text-sm underline hover:text-slate-300"
          >
            ← Back to provider selection
          </button>
        </section>
      </main>
    )
  }

  // ── Ollama-specific flow ─────────────────────────────────────────────

  const models = status ? requiredModelEntries(status) : REQUIRED_MODELS.map((model) => [model, null] as const)
  const setupReady = requiredModelsReady(status)

  return (
    <main className="min-h-screen grid place-items-center bg-slate-900 text-slate-50">
      <section className="w-full max-w-[560px] mx-4 p-8 rounded-3xl bg-slate-800">
        <p className="m-0 text-sky-400 uppercase tracking-widest text-xs font-semibold">Ollama setup</p>
        <h1 className="mt-2 mb-0 text-3xl font-semibold">Prepare local models</h1>
        <p className="text-slate-300 leading-relaxed mt-3">
          GroundTruth Local needs Ollama plus <strong>llama3.2</strong> and{' '}
          <strong>nomic-embed-text</strong> before AI features run.
        </p>

        {error ? <ErrorBanner error={error} /> : null}
        {status && !status.ollama.running ? (
          <ErrorBanner error={{ message: 'Ollama is not reachable. Install Ollama, then setup continues.', category: 'ollama_not_running' }} />
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
          onClick={() => { setSelectedOfflineProvider(null); setError(null); setIsPulling(false) }}
          className="block w-full mt-3 p-2.5 rounded-xl border-0 bg-transparent text-slate-400 cursor-pointer text-sm underline hover:text-slate-300"
        >
          ← Back to provider selection
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
