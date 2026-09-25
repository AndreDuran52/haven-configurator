import { describe, expect, it } from 'vitest'
import { buildInfo } from '@/buildInfo'

describe('scaffold smoke test', () => {
  it('resolves the @ alias and exposes a commit label', () => {
    expect(typeof buildInfo.commit).toBe('string')
    expect(buildInfo.commit.length).toBeGreaterThan(0)
  })
})
