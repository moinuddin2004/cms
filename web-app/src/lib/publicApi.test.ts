import { describe, expect, it } from 'vitest'
import type { InternalAxiosRequestConfig } from 'axios'
import { publicApi } from './publicApi'

describe('publicApi', () => {
  it('sends no Authorization or tenant headers and no credentials', async () => {
    let seen: InternalAxiosRequestConfig | undefined
    await publicApi.get('/visit/abc/state', {
      adapter: async (config) => {
        seen = config
        return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
      },
    })
    const headers = seen!.headers.toJSON() as Record<string, unknown>
    const names = Object.keys(headers).map((h) => h.toLowerCase())
    expect(names).not.toContain('authorization')
    expect(names).not.toContain('x-organization-id')
    expect(names).not.toContain('x-location-id')
    expect(seen!.withCredentials).toBe(false)
  })
})
