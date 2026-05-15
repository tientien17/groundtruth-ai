import { useCallback, useState } from 'react'

import { SetupWizard } from './components/Setup/SetupWizard'

const SIDECAR_PORT = 8765

function App() {
  const [status] = useState('Loading...')
  const [setupReady, setSetupReady] = useState(false)
  const handleSetupReady = useCallback(() => setSetupReady(true), [])

  if (!setupReady) {
    return <SetupWizard onReady={handleSetupReady} sidecarPort={SIDECAR_PORT} />
  }

  return (
    <div>
      <h1>GroundTruth Local</h1>
      <p>Status: {status}</p>
    </div>
  )
}

export default App
