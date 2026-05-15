import type { FormEvent } from 'react'
import { useState } from 'react'

interface Citation {
  index: number
  document_id: string
  sheet_id: string
  sheet_number: string
  page: number
  text: string
  score: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  citations?: Citation[]
}

interface ChatPanelProps {
  projectId: string
  projectPath: string
  sidecarPort: number
  onSelectSheet?: (sheetId: string) => void
}

const baseUrl = (port: number) => `http://127.0.0.1:${port}`

export function ChatPanel({ projectId, projectPath, sidecarPort, onSelectSheet }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const cleanQuestion = question.trim()
    if (!cleanQuestion || thinking) return

    const userMessageId = `user-${Date.now()}`
    setMessages((current) => [...current, { id: userMessageId, role: 'user', text: cleanQuestion }])
    setQuestion('')
    setThinking(true)
    setError(null)

    try {
      const params = new URLSearchParams({ project_path: projectPath })
      const response = await fetch(
        `${baseUrl(sidecarPort)}/projects/${projectId}/copilot/chat?${params}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: cleanQuestion }),
        },
      )
      if (!response.ok) throw new Error(`Copilot failed: ${response.statusText}`)
      const payload = (await response.json()) as { answer: string; citations: Citation[] }
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${userMessageId}`,
          role: 'assistant',
          text: payload.answer,
          citations: payload.citations,
        },
      ])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copilot failed')
    } finally {
      setThinking(false)
    }
  }

  return (
    <section className="flex h-full flex-col border-b border-slate-200 bg-white" data-testid="copilot-chat">
      <div className="border-b border-slate-200 p-3">
        <h2 className="text-sm font-semibold text-slate-800">Copilot</h2>
        <p className="text-xs text-slate-500">Answers only from indexed PDFs.</p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="rounded bg-slate-50 p-3 text-xs text-slate-500">
            Ask about plan notes, schedules, details, or sheet references.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === 'user' ? 'text-right' : 'text-left'}
          >
            <div
              className={`inline-block max-w-full rounded-lg px-3 py-2 text-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-800'
              }`}
            >
              {message.text}
            </div>
            {message.citations && message.citations.length > 0 && (
              <div className="mt-2 space-y-1 text-left">
                {message.citations.map((citation) => (
                  <button
                    key={citation.index}
                    type="button"
                    onClick={() => onSelectSheet?.(citation.sheet_id)}
                    className="block w-full rounded border border-slate-200 bg-white p-2 text-left text-xs hover:border-blue-300 hover:bg-blue-50"
                  >
                    <span className="font-semibold text-blue-700">[{citation.index}] Sheet {citation.sheet_number}</span>
                    <span className="ml-2 text-slate-500">Page {citation.page}</span>
                    <span className="mt-1 line-clamp-2 block text-slate-600">{citation.text}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {thinking && <p className="text-xs text-slate-500">Thinking...</p>}
        {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">{error}</p>}
      </div>

      <form onSubmit={submit} className="border-t border-slate-200 p-3">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask from indexed sheets..."
          className="h-20 w-full resize-none rounded border border-slate-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={thinking || !question.trim()}
          className="mt-2 w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {thinking ? 'Thinking...' : 'Ask Copilot'}
        </button>
      </form>
    </section>
  )
}
