import { useCallback, useMemo, useState } from 'react'
import { useDropzone } from 'react-dropzone'

type FileDropzoneProps = {
  projectId: string
  projectPath: string
  sidecarPort: number
  onIngested?: (result: unknown) => void
}

export function FileDropzone({ projectId, projectPath, sidecarPort, onIngested }: FileDropzoneProps) {
  const [status, setStatus] = useState<string>('Drop PDF here or click to choose')

  const endpoint = useMemo(
    () => `http://127.0.0.1:${sidecarPort}/projects/${projectId}/ingest`,
    [projectId, sidecarPort],
  )

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      const formData = new FormData()
      formData.append('project_path', projectPath)
      formData.append('file', file)

      setStatus(`Uploading ${file.name}...`)
      const response = await fetch(endpoint, { method: 'POST', body: formData })
      if (!response.ok) {
        setStatus(`Upload failed: ${await response.text()}`)
        return
      }

      const result = await response.json()
      setStatus(`Uploaded ${file.name}: ${result.page_count} pages`)
      onIngested?.(result)
    },
    [endpoint, onIngested, projectPath],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop,
  })

  return (
    <div
      {...getRootProps()}
      style={{
        border: '2px dashed #64748b',
        borderRadius: 12,
        padding: 24,
        cursor: 'pointer',
        background: isDragActive ? '#e0f2fe' : '#f8fafc',
      }}
    >
      <input {...getInputProps()} />
      <strong>PDF ingestion</strong>
      <p>{isDragActive ? 'Drop PDF to ingest' : status}</p>
    </div>
  )
}

export default FileDropzone
