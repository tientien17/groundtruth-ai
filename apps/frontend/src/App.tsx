import { useCallback, useEffect, useState } from 'react'

import { SetupWizard } from './components/Setup/SetupWizard'
import { Workspace } from './components/Workspace/Workspace'

const FALLBACK_PORT = 8765

type Project = {
  id: string
  path: string
  name: string
}

function App() {
  const [sidecarPort, setSidecarPort] = useState<number | null>(null)
  const [setupReady, setSetupReady] = useState(false)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handleSetupReady = useCallback(() => setSetupReady(true), [])

  useEffect(() => {
    let cancelled = false

    async function checkSetup(port: number) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/setup/status`)
        const data = await res.json()
        if (!cancelled && !data.required) {
          setSetupReady(true)
        }
      } catch {
        // Cannot check setup — show wizard
      }
    }

    async function discoverPort() {
      try {
        // Try Tauri IPC first — works when running inside the desktop app
        const { invoke } = await import('@tauri-apps/api/core')
        const port = await invoke<number>('sidecar_port')
        if (!cancelled) {
          setSidecarPort(port)
          checkSetup(port)
        }
      } catch {
        // Fallback for Vite dev server (not running in Tauri WebView)
        if (!cancelled) {
          setSidecarPort(FALLBACK_PORT)
          checkSetup(FALLBACK_PORT)
        }
      }
    }

    discoverPort()
    return () => { cancelled = true }
  }, [])

  if (sidecarPort === null) {
    return <div className="flex items-center justify-center h-screen">Detecting sidecar…</div>
  }

  if (!setupReady) {
    return <SetupWizard onReady={handleSetupReady} sidecarPort={sidecarPort} />
  }

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-8">
        <h1 className="text-2xl font-bold">GroundTruth Local</h1>
        <p className="text-gray-600">Status: Connected to sidecar on port {sidecarPort}</p>
        <div className="mt-8 p-6 border rounded-lg max-w-md">
          <h2 className="text-xl font-semibold mb-4">Create a Project</h2>
          <p className="text-gray-600 mb-4">
            Create a new project to start importing PDFs and performing takeoff.
          </p>
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded text-sm">
              {error}
            </div>
          )}
          <button
            type="button"
            onClick={async () => {
              setCreating(true)
              setError(null)
              try {
                const projectName = `Project ${new Date().toLocaleDateString()}`
                const res = await fetch(`http://127.0.0.1:${sidecarPort}/projects`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: projectName }),
                })
                if (!res.ok) throw new Error(`Failed to create project (${res.status})`)
                const data = await res.json()
                setCurrentProject({ id: data.id, path: data.path, name: data.name })
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to create project')
              } finally {
                setCreating(false)
              }
            }}
            disabled={creating}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating…' : 'Create New Project'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <Workspace
      projectId={currentProject.id}
      projectPath={currentProject.path}
      sidecarPort={sidecarPort}
    />
  )
}

export default App
