import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAutosave } from './hooks/useAutosave'
import { appendPhrase } from './constants/quickPicks'

describe('appendPhrase', () => {
  it('starts a field with the phrase', () => {
    expect(appendPhrase('', 'Toothache')).toBe('Toothache')
    expect(appendPhrase('   ', 'Toothache')).toBe('Toothache')
  })

  it('adds to what the doctor already typed, comma separated', () => {
    expect(appendPhrase('Swelling', 'Toothache')).toBe('Swelling, Toothache')
    expect(appendPhrase('Swelling, ', 'Toothache')).toBe('Swelling, Toothache')
  })

  it('does not add the same phrase twice', () => {
    expect(appendPhrase('Swelling, Toothache', 'toothache')).toBe(
      'Swelling, Toothache',
    )
  })
})

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('does not save the value the screen loaded with', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    renderHook(() => useAutosave({ text: 'loaded' }, save))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(save).not.toHaveBeenCalled()
  })

  it('saves once, after the doctor stops changing the value', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ v }) => useAutosave(v, save, { delay: 800 }),
      { initialProps: { v: 'a' } },
    )
    rerender({ v: 'ab' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    rerender({ v: 'abc' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500)
    })
    expect(save).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400)
    })
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith('abc')
    expect(result.current.state).toBe('saved')
  })

  it('reports a failed save and retries it on flush', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({ v }) => useAutosave(v, save, { delay: 100 }),
      { initialProps: { v: 'a' } },
    )
    rerender({ v: 'b' })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200)
    })
    expect(result.current.state).toBe('error')

    let ok = false
    await act(async () => {
      ok = await result.current.flush()
    })
    expect(ok).toBe(true)
    expect(save).toHaveBeenCalledTimes(2)
    expect(result.current.state).toBe('saved')
  })

  it('flush says false when the save still fails, so callers can stop', async () => {
    const save = vi.fn().mockRejectedValue(new Error('offline'))
    const { result, rerender } = renderHook(
      ({ v }) => useAutosave(v, save, { delay: 100 }),
      { initialProps: { v: 'a' } },
    )
    rerender({ v: 'b' })
    let ok = true
    await act(async () => {
      ok = await result.current.flush()
    })
    expect(ok).toBe(false)
  })
})
