import { useCallback, useState } from 'react'

export interface UseHistoryOptions {
  limit?: number
}

export interface UseHistoryReturn<T> {
  value: T
  set: (nextValue: T | ((current: T) => T)) => void
  reset: (nextValue: T) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

interface HistoryState<T> {
  past: T[]
  present: T
  future: T[]
}

const DEFAULT_HISTORY_LIMIT = 20

export function useHistory<T>(
  initialValue: T,
  { limit = DEFAULT_HISTORY_LIMIT }: UseHistoryOptions = {},
): UseHistoryReturn<T> {
  const maxPast = Math.max(1, limit)
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialValue,
    future: [],
  })

  const set = useCallback(
    (nextValue: T | ((current: T) => T)) => {
      setState((current) => {
        const resolved =
          typeof nextValue === 'function'
            ? (nextValue as (value: T) => T)(current.present)
            : nextValue

        if (Object.is(resolved, current.present)) {
          return current
        }

        return {
          past: [...current.past, current.present].slice(-maxPast),
          present: resolved,
          future: [],
        }
      })
    },
    [maxPast],
  )

  const reset = useCallback((nextValue: T) => {
    setState({ past: [], present: nextValue, future: [] })
  }, [])

  const undo = useCallback(() => {
    setState((current) => {
      if (current.past.length === 0) return current

      const previous = current.past[current.past.length - 1]
      return {
        past: current.past.slice(0, -1),
        present: previous,
        future: [current.present, ...current.future],
      }
    })
  }, [])

  const redo = useCallback(() => {
    setState((current) => {
      if (current.future.length === 0) return current

      const next = current.future[0]
      return {
        past: [...current.past, current.present].slice(-maxPast),
        present: next,
        future: current.future.slice(1),
      }
    })
  }, [maxPast])

  return {
    value: state.present,
    set,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}

export default useHistory
