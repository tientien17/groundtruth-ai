import type { TextSearchCandidate } from './TextSearchTool'

interface CandidateReviewProps {
  candidates: TextSearchCandidate[]
  onAccept: (candidate: TextSearchCandidate) => Promise<void>
  onReject: (candidate: TextSearchCandidate) => void
  onAcceptAll: () => Promise<void>
  disabled?: boolean
}

export function CandidateReview({
  candidates,
  onAccept,
  onReject,
  onAcceptAll,
  disabled,
}: CandidateReviewProps) {
  if (candidates.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm z-10">
        <h3 className="font-semibold text-slate-800">Review Candidates ({candidates.length})</h3>
        <button
          onClick={onAcceptAll}
          disabled={disabled || candidates.length === 0}
          className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Accept All
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {candidates.map((c, i) => (
          <div key={`${c.document_id}-${c.page_index}-${i}`} className="bg-white p-3 rounded border border-slate-200 shadow-sm flex flex-col gap-2">
            <div className="text-sm font-medium text-slate-700">"{c.text}"</div>
            <div className="flex justify-end gap-2 mt-2">
              <button
                onClick={() => onReject(c)}
                disabled={disabled}
                className="px-2 py-1 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => onAccept(c)}
                disabled={disabled}
                className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors disabled:opacity-50"
              >
                Accept
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
