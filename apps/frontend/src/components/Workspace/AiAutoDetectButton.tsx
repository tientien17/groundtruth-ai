export interface AiAutoDetectButtonProps {
  onDetect: () => void
  isDetecting: boolean
  disabled?: boolean
}

export function AiAutoDetectButton({ onDetect, isDetecting, disabled }: AiAutoDetectButtonProps) {
  return (
    <div className="p-2 border-b border-slate-200">
      <button
        onClick={onDetect}
        disabled={disabled || isDetecting}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-md shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isDetecting ? (
          <>
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Detecting...</span>
          </>
        ) : (
          <>
            <span className="text-lg">🤖</span>
            <span>AI Auto-Detect</span>
          </>
        )}
      </button>
    </div>
  )
}
