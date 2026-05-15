import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useHistory } from './useHistory'

describe('useHistory', () => {
  it('tracks set, undo, and redo states', () => {
    const { result } = renderHook(() => useHistory<string[]>([]))

    act(() => result.current.set(['a']))
    act(() => result.current.set((current) => [...current, 'b']))

    expect(result.current.value).toEqual(['a', 'b'])
    expect(result.current.canUndo).toBe(true)
    expect(result.current.canRedo).toBe(false)

    act(() => result.current.undo())
    expect(result.current.value).toEqual(['a'])
    expect(result.current.canRedo).toBe(true)

    act(() => result.current.redo())
    expect(result.current.value).toEqual(['a', 'b'])
  })

  it('clears redo history after a new change', () => {
    const { result } = renderHook(() => useHistory(0))

    act(() => result.current.set(1))
    act(() => result.current.set(2))
    act(() => result.current.undo())
    act(() => result.current.set(3))

    expect(result.current.value).toBe(3)
    expect(result.current.canRedo).toBe(false)
  })

  it('keeps at least twenty undo steps by default', () => {
    const { result } = renderHook(() => useHistory(0))

    for (let index = 1; index <= 20; index += 1) {
      act(() => result.current.set(index))
    }

    for (let index = 0; index < 20; index += 1) {
      act(() => result.current.undo())
    }

    expect(result.current.value).toBe(0)
    expect(result.current.canUndo).toBe(false)
  })

  it('resets history to a new value', () => {
    const { result } = renderHook(() => useHistory('draft'))

    act(() => result.current.set('changed'))
    act(() => result.current.reset('saved'))

    expect(result.current.value).toBe('saved')
    expect(result.current.canUndo).toBe(false)
    expect(result.current.canRedo).toBe(false)
  })
})
