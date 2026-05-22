import { useState } from 'react'

export interface WelcomeScreenProps {
  sidecarPort: number
  onProjectCreated: (project: { id: string; path: string; name: string }) => void
  onSkip: () => void
}

export function WelcomeScreen({ sidecarPort, onProjectCreated, onSkip }: WelcomeScreenProps) {
  const [creating, setCreating] = useState(false)
  const [loadingDemo, setLoadingDemo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreateProject = async () => {
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
      
      // Set the flag
      localStorage.setItem('groundtruth_onboarding_done', 'true')
      
      onProjectCreated({ id: data.id, path: data.path, name: data.name })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
      setCreating(false) // Only reset on failure to prevent flicker
    }
  }

  const handleSkip = () => {
    localStorage.setItem('groundtruth_onboarding_done', 'true')
    onSkip()
  }

  const handleDemo = async () => {
    setLoadingDemo(true)
    setError(null)
    try {
      const res = await fetch(`http://127.0.0.1:${sidecarPort}/demo/load`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(`Failed to load demo project (${res.status})`)
      const data = await res.json()
      
      // Set the flag
      localStorage.setItem('groundtruth_onboarding_done', 'true')
      
      onProjectCreated({ id: data.id, path: data.path, name: data.name })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load demo project')
      setLoadingDemo(false) // Only reset on failure to prevent flicker
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-text-primary p-8">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4 text-text-primary">GroundTruth Local</h1>
          <p className="text-xl text-text-secondary">Offline construction takeoff • Local AI • No cloud required</p>
        </div>

        {/* Workflow Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {/* Step 1 */}
          <div className="card flex flex-col items-center text-center p-8 bg-surface border-border">
            <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center text-2xl font-bold mb-6">
              1
            </div>
            <h3 className="text-lg font-semibold mb-3 text-text-primary">Upload PDFs</h3>
            <p className="text-text-secondary text-sm">
              Import local construction plans directly from your computer.
            </p>
          </div>

          {/* Step 2 */}
          <div className="card flex flex-col items-center text-center p-8 bg-surface border-border">
            <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center text-2xl font-bold mb-6">
              2
            </div>
            <h3 className="text-lg font-semibold mb-3 text-text-primary">Measure & Detect</h3>
            <p className="text-text-secondary text-sm">
              Perform manual takeoff or let local AI find symbols and text.
            </p>
          </div>

          {/* Step 3 */}
          <div className="card flex flex-col items-center text-center p-8 bg-surface border-border">
            <div className="w-16 h-16 rounded-full bg-primary-light text-primary flex items-center justify-center text-2xl font-bold mb-6">
              3
            </div>
            <h3 className="text-lg font-semibold mb-3 text-text-primary">Export Quantities</h3>
            <p className="text-text-secondary text-sm">
              Generate Excel reports and annotated PDFs instantly.
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-8 p-4 bg-error-light border border-error text-error-text rounded text-center">
            {error}
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleCreateProject}
            disabled={creating}
            className="btn btn-primary px-8 py-3 text-lg w-full max-w-sm"
          >
            {creating ? 'Creating...' : 'Create Project'}
          </button>
          
          <button
            type="button"
            onClick={handleDemo}
            disabled={creating || loadingDemo}
            className="btn btn-secondary px-8 py-3 text-lg w-full max-w-sm"
          >
            {loadingDemo ? 'Loading...' : 'Load Sample Demo'}
          </button>
          
          <button
            type="button"
            onClick={handleSkip}
            className="btn btn-ghost mt-4 text-sm"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  )
}
