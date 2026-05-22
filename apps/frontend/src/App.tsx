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
  const handleSetupReady = useCallback(() => setSetupReady(true), [])

  useEffect(() => {
    let cancelled = false
    async function discoverPort() {
      try {
        // Try Tauri IPC first — works when running inside the desktop app
        const { invoke } = await import('@tauri-apps/api/core')
        const port = await invoke<number>('sidecar_port')
        if (!cancelled) setSidecarPort(port)
      } catch {
        // Fallback for Vite dev server (not running in Tauri WebView)
        if (!cancelled) setSidecarPort(FALLBACK_PORT)
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
          <button
            type="button"
            onClick={() => {
              const projectId = crypto.randomUUID()
              const projectName = `Project ${new Date().toLocaleDateString()}`
              const projectPath = `./projects/${projectId}`
              setCurrentProject({ id: projectId, path: projectPath, name: projectName })
            }}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Create New Project
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
