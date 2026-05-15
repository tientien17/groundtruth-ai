import type React from 'react'
import { useMemo, useState } from 'react'

export interface TextSearchCandidate {
  document_id: string
  sheet_id: string
  page_index: number
  text: string
  bbox: [number, number, number, number]
}

interface TextSearchToolProps {
  projectId: string
  projectPath: string
  sidecarPort: number
  currentSheetId: string | null
  onCandidatesChange: (candidates: TextSearchCandidate[]) => void
}

export function TextSearchTool({
  projectId,
  projectPath,
  sidecarPort,
  currentSheetId,
  onCandidatesChange,
}: TextSearchToolProps) {
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<TextSearchCandidate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const visibleCount = useMemo(
    () => candidates.filter((candidate) => candidate.sheet_id === currentSheetId).length,
    [candidates, currentSheetId]
  )

  async function runSearch(event: React.FormEvent) {
    event.preventDefault()
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        project_path: projectPath,
        q: trimmedQuery,
        limit: '500',
      })
      const response = await fetch(`http://127.0.0.1:${sidecarPort}/projects/${projectId}/text-search?${params}`)
      if (!response.ok) {
        throw new Error(`Search failed (${response.status})`)
      }
      const payload = (await response.json()) as { results: TextSearchCandidate[] }
      setCandidates(payload.results)
      onCandidatesChange(payload.results)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed'
      setError(message)
      setCandidates([])
      onCandidatesChange([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <form
      onSubmit={runSearch}
      className="absolute bottom-4 left-4 z-10 flex max-w-sm flex-col gap-2 rounded bg-white/95 p-3 text-sm shadow"
      data-testid="text-search-tool"
    >
      <label className="font-medium text-slate-700" htmlFor="text-search-input">
        Text search candidates
      </label>
      <div className="flex gap-2">
        <input
          id="text-search-input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="SD-1"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="rounded bg-amber-400 px-3 py-1 font-medium text-slate-900 disabled:opacity-50"
        >
          {loading ? 'Searching' : 'Search'}
        </button>
      </div>
      <div className="text-xs text-slate-600" data-testid="text-search-count">
        {candidates.length} candidates, {visibleCount} on current sheet
      </div>
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
    </form>
  )
}
