/**
 * Sidebar showing list of sheets in the project.
 */

import type { SheetsSidebarProps } from './types'

export function SheetsSidebar({ sheets, selectedSheetId, onSelectSheet, loading }: SheetsSidebarProps) {
  return (
    <div
      className="flex flex-col h-full bg-slate-50 border-r border-slate-200"
      data-testid="sheets-sidebar"
    >
      <div className="p-3 border-b border-slate-200">
        <h2 className="text-sm font-semibold text-slate-700">Sheets</h2>
        {loading && (
          <span className="text-xs text-slate-400 ml-2">Loading...</span>
        )}
        {!loading && (
          <span className="text-xs text-slate-400 ml-2">
            {sheets.length} sheet{sheets.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-slate-400 text-sm">
            Loading sheets...
          </div>
        ) : sheets.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm">
            No sheets found
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {sheets.map((sheet) => (
              <li key={sheet.id}>
                <button
                  type="button"
                  onClick={() => onSelectSheet(sheet.id)}
                  className={`w-full text-left px-3 py-2 hover:bg-slate-100 transition-colors ${
                    selectedSheetId === sheet.id
                      ? 'bg-blue-50 border-l-2 border-blue-500'
                      : ''
                  }`}
                  data-testid={`sheet-item-${sheet.id}`}
                >
                  <div className="flex items-center gap-2">
                    {sheet.thumbnail_url && (
                      <img
                        src={sheet.thumbnail_url}
                        alt=""
                        className="w-10 h-10 object-contain bg-white rounded"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {sheet.sheet_number}
                      </p>
                      {sheet.sheet_title && (
                        <p className="text-xs text-slate-500 truncate">
                          {sheet.sheet_title}
                        </p>
                      )}
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
