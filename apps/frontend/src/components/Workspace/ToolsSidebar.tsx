/**
 * Sidebar showing available tools for the viewer.
 */

import type { ToolsSidebarProps, ToolType } from './types'

const TOOLS: { id: ToolType; label: string; icon: string }[] = [
  { id: 'select', label: 'Select', icon: '↖' },
  { id: 'pan', label: 'Pan', icon: '✋' },
  { id: 'measure-length', label: 'Length', icon: '📏' },
  { id: 'measure-area', label: 'Area', icon: '⬛' },
  { id: 'count', label: 'Count', icon: '#' },
]

export function ToolsSidebar({ activeTool, onSelectTool }: ToolsSidebarProps) {
  return (
    <div
      className="flex flex-col h-full bg-slate-50 border-r border-slate-200"
      data-testid="tools-sidebar"
    >
      <div className="p-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700">Tools</h2>
      </div>
      <div className="flex-1 p-2">
        <div className="grid gap-1">
          {TOOLS.map((tool) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded text-left transition-colors ${
                activeTool === tool.id
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-slate-100 text-slate-600'
              }`}
              title={tool.label}
              data-testid={`tool-${tool.id}`}
            >
              <span className="text-lg w-6 text-center">{tool.icon}</span>
              <span className="text-sm">{tool.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
