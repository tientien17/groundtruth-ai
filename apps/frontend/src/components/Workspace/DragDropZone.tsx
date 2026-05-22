import { useRef, useState } from 'react'

interface DragDropZoneProps {
  onUploadPdf: (file: File) => void
  isUploading: boolean
}

export function DragDropZone({ onUploadPdf, isUploading }: DragDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    if (isUploading) return

    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') {
      onUploadPdf(file)
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onUploadPdf(file)
    }
    // Reset input so the same file can be selected again if needed
    if (e.target) {
      e.target.value = ''
    }
  }

  return (
    <div className="flex-1 min-w-0 relative flex items-center justify-center bg-slate-50 p-8">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (!isUploading && (e.key === 'Enter' || e.key === ' ')) {
            fileInputRef.current?.click()
          }
        }}
        tabIndex={0}
        // biome-ignore lint/a11y/useSemanticElements: Intended as a drag target with fallback click
        role="button"
        className={`w-full max-w-2xl aspect-video rounded-xl border-2 border-dashed flex flex-col items-center justify-center transition-all cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
          isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-slate-300 hover:border-slate-400 hover:bg-slate-100'
        } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          type="file"
          accept=".pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileInput}
          disabled={isUploading}
          data-testid="file-upload-input"
        />
        
        {isUploading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-slate-600 font-medium">Uploading PDF...</p>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="text-4xl">📄</div>
            <div className="space-y-1">
              <p className="text-lg font-medium text-slate-700">
                Drag PDF here to upload
              </p>
              <p className="text-sm text-slate-500">
                or click to browse
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
