import { useState } from 'react'
import type { SheetSummary } from '../Library/types'
import { SheetViewer } from './SheetViewer'

interface CompareViewProps {
  sheets: SheetSummary[]
  projectId: string
  projectPath: string
  sidecarPort: number
  onExit: () => void
}

interface CompareItem {
  id: string
  type: string
  classification_id: string | null
  classification_name: string | null
  quantity: number | null
  unit: string | null
}

interface CompareResult {
  sheet_a: { id: string; sheet_number: string; item_count: number }
  sheet_b: { id: string; sheet_number: string; item_count: number }
  only_in_a: CompareItem[]
  only_in_b: CompareItem[]
  in_both: CompareItem[]
}

export function CompareView({
  sheets,
  projectId,
  projectPath,
  sidecarPort,
  onExit,
}: CompareViewProps) {
  const [sheetIdA, setSheetIdA] = useState<string>(sheets[0]?.id || '')
  const [sheetIdB, setSheetIdB] = useState<string>(sheets[1]?.id || sheets[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CompareResult | null>(null)

  const handleCompare = async () => {
    if (!sheetIdA || !sheetIdB) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const params = new URLSearchParams({ project_path: projectPath })
      const res = await fetch(
        `http://127.0.0.1:${sidecarPort}/projects/${projectId}/sheets/compare?${params}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sheet_id_a: sheetIdA,
            sheet_id_b: sheetIdB,
          }),
        }
      )

      if (!res.ok) {
        throw new Error(`Comparison failed: ${res.statusText}`)
      }

      const data = await res.json()
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed')
    } finally {
      setLoading(false)
    }
  }

  const sheetA = sheets.find((s) => s.id === sheetIdA) || null
  const sheetB = sheets.find((s) => s.id === sheetIdB) || null

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header Controls */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white shadow-sm">
        <div className="flex gap-4 items-center">
          <h2 className="text-lg font-semibold text-slate-800">Compare Sheets</h2>
          <button
            type="button"
            onClick={handleCompare}
            disabled={loading || !sheetIdA || !sheetIdB}
            className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Comparing...' : 'Run Comparison'}
          </button>
          {error && <span className="text-red-600 text-sm">{error}</span>}
        </div>
        <button
          type="button"
          onClick={onExit}
          className="px-4 py-2 text-slate-600 border border-slate-300 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          Exit Compare
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Split View */}
        <div className="flex-1 flex min-h-0 border-b border-slate-200">
          {/* Left Side - Sheet A */}
          <div className="flex-1 flex flex-col border-r border-slate-200">
            <div className="p-2 bg-slate-100 border-b border-slate-200">
              <select
                value={sheetIdA}
                onChange={(e) => setSheetIdA(e.target.value)}
                className="w-full p-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sheet_number} {s.sheet_title ? `- ${s.sheet_title}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 relative bg-slate-200 overflow-hidden">
              <SheetViewer
                projectId={projectId}
                sheet={sheetA}
                loading={false}
                error={null}
                sidecarPort={sidecarPort}
                projectPath={projectPath}
                activeTool="select"
                onDrawingComplete={() => {}}
                onCandidatesChange={() => {}}
              />
            </div>
          </div>

          {/* Right Side - Sheet B */}
          <div className="flex-1 flex flex-col">
            <div className="p-2 bg-slate-100 border-b border-slate-200">
              <select
                value={sheetIdB}
                onChange={(e) => setSheetIdB(e.target.value)}
                className="w-full p-2 rounded-md border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sheets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sheet_number} {s.sheet_title ? `- ${s.sheet_title}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 relative bg-slate-200 overflow-hidden">
              <SheetViewer
                projectId={projectId}
                sheet={sheetB}
                loading={false}
                error={null}
                sidecarPort={sidecarPort}
                projectPath={projectPath}
                activeTool="select"
                onDrawingComplete={() => {}}
                onCandidatesChange={() => {}}
              />
            </div>
          </div>
        </div>

        {/* Results Panel */}
        <div className="h-48 bg-white p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Comparison Results</h3>
          {result ? (
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-orange-800 font-medium text-sm">Only in {result.sheet_a.sheet_number}</h4>
                  <span className="bg-orange-200 text-orange-800 py-0.5 px-2 rounded-full text-xs font-bold">
                    {result.only_in_a.length}
                  </span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {result.only_in_a.map((item) => (
                    <div key={item.id} className="text-xs text-orange-700 truncate">
                      {item.classification_name || 'Unclassified'} ({item.type})
                    </div>
                  ))}
                  {result.only_in_a.length === 0 && <div className="text-xs text-orange-400 italic">No unique items</div>}
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-blue-800 font-medium text-sm">Only in {result.sheet_b.sheet_number}</h4>
                  <span className="bg-blue-200 text-blue-800 py-0.5 px-2 rounded-full text-xs font-bold">
                    {result.only_in_b.length}
                  </span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {result.only_in_b.map((item) => (
                    <div key={item.id} className="text-xs text-blue-700 truncate">
                      {item.classification_name || 'Unclassified'} ({item.type})
                    </div>
                  ))}
                  {result.only_in_b.length === 0 && <div className="text-xs text-blue-400 italic">No unique items</div>}
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-green-800 font-medium text-sm">In Both Sheets</h4>
                  <span className="bg-green-200 text-green-800 py-0.5 px-2 rounded-full text-xs font-bold">
                    {result.in_both.length}
                  </span>
                </div>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {result.in_both.map((item) => (
                    <div key={item.id} className="text-xs text-green-700 truncate">
                      {item.classification_name || 'Unclassified'} ({item.type})
                    </div>
                  ))}
                  {result.in_both.length === 0 && <div className="text-xs text-green-400 italic">No shared items</div>}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-500 text-sm text-center py-8 border-2 border-dashed border-slate-200 rounded-lg">
              Click "Run Comparison" to see quantity differences between the selected sheets.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
