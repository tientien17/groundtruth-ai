/**
 * Sidebar showing takeoff items for the project.
 */

import type { TakeoffItemsSidebarProps } from './types'

const TYPE_ICONS: Record<string, string> = {
  linear: '📏',
  area: '⬛',
  count: '#',
}

export function TakeoffItemsSidebar({ items, onSelectItem, selectedItemId }: TakeoffItemsSidebarProps) {
  return (
    <div
      className="flex flex-col h-full bg-slate-50 border-l border-slate-200"
      data-testid="takeoff-sidebar"
    >
      <div className="p-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700">Takeoff Items</h2>
        <span className="text-xs text-slate-400 ml-2">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm">
            No takeoff items yet.
            <br />
            <span className="text-xs">Use the tools to measure lengths, areas, or count items.</span>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onSelectItem?.(item.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-100 transition-colors ${
                    selectedItemId === item.id
                      ? 'bg-blue-50 border-l-2 border-blue-500'
                      : ''
                  }`}
                  data-testid={`takeoff-item-${item.id}`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: '#3b82f6' }}
                    />
                    <span className="text-lg">{TYPE_ICONS[item.type] || '?'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {item.classification_id ?? item.id}
                      </p>
                      <p className="text-xs text-slate-500">
                        {(item.quantity_raw ?? 0).toLocaleString()} {item.quantity_unit ?? ''}
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
