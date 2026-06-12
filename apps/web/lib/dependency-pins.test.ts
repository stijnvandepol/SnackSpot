import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Guards intentional dependency pins so a future `pnpm update` can't silently
// undo a fix. fast-xml-parser < 5.8.0 (as minio resolves it) over-counts XML
// entities and breaks listObjectsV2 on buckets past ~1000 objects, which
// silently disabled the worker's orphan-image cleanup at scale. Keep it pinned.
describe('dependency pins', () => {
  const root = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
  )
  const overrides: Record<string, string> = root.pnpm?.overrides ?? {}

  it('pins fast-xml-parser to >= 5.8.0 (minio listObjectsV2 entity-limit fix)', () => {
    const pin = overrides['fast-xml-parser']
    expect(pin, 'fast-xml-parser override missing').toBeTruthy()
    const [major, minor] = pin.replace(/^[^\d]*/, '').split('.').map(Number)
    expect(major).toBeGreaterThanOrEqual(5)
    if (major === 5) expect(minor).toBeGreaterThanOrEqual(8)
  })
})
