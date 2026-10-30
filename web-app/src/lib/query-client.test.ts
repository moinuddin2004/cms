import { describe, expect, it, vi } from 'vitest'
import { MutationObserver } from '@tanstack/react-query'
import { queryClient } from './query-client'

describe('queryClient mutation defaults', () => {
  it('sends a failed write only once', async () => {
    const mutationFn = vi.fn().mockRejectedValue(new Error('400 Bad Request'))
    const observer = new MutationObserver(queryClient, { mutationFn })

    await expect(observer.mutate(undefined)).rejects.toThrow('400 Bad Request')
    expect(mutationFn).toHaveBeenCalledTimes(1)
  })
})
