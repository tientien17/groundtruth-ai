import { useCallback, useEffect, useState } from 'react'

import { SetupWizard } from './components/Setup/SetupWizard'

const FALLBACK_PORT = 8765

function App() {
  const [sidecarPort, setSidecarPort] = useState<number | null>(null)
  const [setupReady, setSetupReady] = useState(false)
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

  return (
    <div>
      <h1>GroundTruth Local</h1>
      <p>Status: Connected to sidecar on port {sidecarPort}</p>
    </div>
  )
}

export default App
