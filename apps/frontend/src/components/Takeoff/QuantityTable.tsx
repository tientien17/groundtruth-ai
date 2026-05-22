/**
 * Quantity table and Excel export controls for takeoff items.
 */

import type { TakeoffItem } from '../Workspace/types'

export interface QuantityTableProps {
  items: TakeoffItem[]
  projectId: string
  projectPath: string
  sidecarPort: number
  sheetId?: string | null
}

export function QuantityTable({
  items,
  projectId,
  projectPath,
  sidecarPort,
  sheetId,
}: QuantityTableProps) {
  const groupedItems = groupByClassification(items)
  const projectExportUrl = buildExportUrl({ projectId, projectPath, sidecarPort })
  const sheetExportUrl = sheetId
    ? buildExportUrl({ projectId, projectPath, sidecarPort, sheetId })
    : null

  return (
    <section className="flex flex-col h-full bg-white" data-testid="quantity-table">
      <div className="p-3 border-b border-slate-200 space-y-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Quantities</h2>
          <p className="text-xs text-slate-400">
            {items.length} item{items.length !== 1 ? 's' : ''} grouped by classification
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
            href={projectExportUrl}
            data-testid="export-project-link"
          >
            Export project
          </a>
          {sheetExportUrl ? (
            <a
              className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
              href={sheetExportUrl}
              data-testid="export-sheet-link"
            >
              Export sheet
            </a>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-400" data-testid="quantity-table-empty">
            No quantities to show yet.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-semibold">Classification</th>
                <th className="px-3 py-2 font-semibold">Quantity</th>
                <th className="px-3 py-2 font-semibold">Unit</th>
                <th className="px-3 py-2 font-semibold">Formula result</th>
              </tr>
            </thead>
            <tbody>
              {groupedItems.map(([classification, group]) => (
                group.map((item, index) => (
                  <tr key={item.id} className="border-t border-slate-100" data-testid={`quantity-row-${item.id}`}>
                    <td className="px-3 py-2 text-slate-700">
                      {index === 0 ? classification : ''}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{formatNumber(item.quantity_raw ?? 0)}</td>
                    <td className="px-3 py-2 text-slate-500">{item.quantity_unit ?? ''}</td>
                    <td className="px-3 py-2 text-slate-700">
                      {formatFormulaResult(item)}
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

function groupByClassification(items: TakeoffItem[]): Array<[string, TakeoffItem[]]> {
  const groups = new Map<string, TakeoffItem[]>()
  for (const item of items) {
    const classification = item.classification_id ?? 'Unclassified'
    groups.set(classification, [...(groups.get(classification) ?? []), item])
  }
  return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right))
}

function buildExportUrl({
  projectId,
  projectPath,
  sidecarPort,
  sheetId,
}: {
  projectId: string
  projectPath: string
  sidecarPort: number
  sheetId?: string
}) {
  const params = new URLSearchParams({ project_path: projectPath })
  if (sheetId) {
    params.set('sheet_id', sheetId)
  }
  return `http://127.0.0.1:${sidecarPort}/projects/${projectId}/export.xlsx?${params.toString()}`
}

function formatFormulaResult(item: TakeoffItem): string {
  return `${formatNumber(item.quantity_raw ?? 0)} ${item.quantity_unit ?? ''}`
}

function formatNumber(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 })
}
