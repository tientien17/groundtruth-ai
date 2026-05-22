import type { FormEvent } from 'react'
import { useState, useRef, useEffect } from 'react'

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

  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, thinking])

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
      <div className="flex items-center justify-between border-b border-slate-200 p-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">💬 Plan Copilot</h2>
          <p className="text-xs text-slate-500">Answers only from indexed PDFs.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages([])
            setError(null)
          }}
          className="text-xs font-medium text-slate-500 hover:text-slate-800"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 flex flex-col" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-slate-500">💬 Ask a question about your plans...</p>
          </div>
        )}
        {[...messages].reverse().map((message) => (
          <div
            key={message.id}
            className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`inline-block max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                message.role === 'user'
                  ? 'bg-blue-100 text-blue-900 rounded-br-sm'
                  : 'bg-slate-100 text-slate-800 rounded-bl-sm'
              }`}
            >
              {message.text}
            </div>
            {message.citations && message.citations.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {message.citations.map((citation) => (
                  <button
                    key={citation.index}
                    type="button"
                    onClick={() => onSelectSheet?.(citation.sheet_id)}
                    className="text-[11px] text-slate-500 hover:text-blue-600 hover:underline"
                    title={citation.text}
                  >
                    📄 Sheet {citation.sheet_number}, Page {citation.page}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {thinking && (
          <div className="flex items-start">
            <div className="inline-block max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2.5 text-sm text-slate-800 flex items-center space-x-1">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700 self-center w-full">{error}</p>}
      </div>

      <form onSubmit={submit} className="border-t border-slate-200 bg-white p-3">
        <div className="relative flex items-center">
          <input
            type="text"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about your plans..."
            disabled={thinking}
            className="w-full rounded-full border border-slate-300 bg-slate-50 py-2.5 pl-4 pr-12 text-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={thinking || !question.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center justify-center rounded-full bg-blue-600 px-3 text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
      </form>
    </section>
  )
}
