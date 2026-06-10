import { describe, it, expect } from 'vitest'
import { xpForLevel, levelForXp, levelTitle, xpProgress, XP_AMOUNTS } from './xp-service'

describe('xp level curve', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(levelForXp(0)).toBe(1)
    expect(xpForLevel(1)).toBe(0)
  })

  it('reaches level 2 at exactly 100 XP', () => {
    expect(xpForLevel(2)).toBe(100)
    expect(levelForXp(99)).toBe(1)
    expect(levelForXp(100)).toBe(2)
  })

  it('is monotonically increasing and inverse-consistent for levels 1-40', () => {
    let prev = -1
    for (let level = 1; level <= 40; level++) {
      const xp = xpForLevel(level)
      expect(xp).toBeGreaterThan(prev)
      prev = xp
      // The threshold XP of a level must map back to that level.
      expect(levelForXp(xp)).toBe(level)
      // One XP below the threshold is still the previous level.
      if (level > 1) expect(levelForXp(xp - 1)).toBe(level - 1)
    }
  })

  it('never returns a level below 1', () => {
    expect(levelForXp(-50)).toBe(1)
  })
})

describe('level titles', () => {
  it('maps levels to the highest earned title', () => {
    expect(levelTitle(1)).toBe('Snacker')
    expect(levelTitle(2)).toBe('Snacker')
    expect(levelTitle(3)).toBe('Taster')
    expect(levelTitle(5)).toBe('Foodie')
    expect(levelTitle(11)).toBe('Local Explorer')
    expect(levelTitle(99)).toBe('Food Legend')
  })
})

describe('xpProgress', () => {
  it('reports 0% at the start of a level and bounded progress within it', () => {
    const atThreshold = xpProgress(xpForLevel(3))
    expect(atThreshold.level).toBe(3)
    expect(atThreshold.progressPct).toBe(0)

    const midway = xpProgress(xpForLevel(3) + Math.floor((xpForLevel(4) - xpForLevel(3)) / 2))
    expect(midway.level).toBe(3)
    expect(midway.progressPct).toBeGreaterThan(0)
    expect(midway.progressPct).toBeLessThan(100)
  })

  it('exposes the next level threshold', () => {
    const p = xpProgress(0)
    expect(p.nextLevelXp).toBe(100)
    expect(p.title).toBe('Snacker')
  })
})

describe('xp amounts', () => {
  it('weights first-review discovery above plain volume', () => {
    expect(XP_AMOUNTS.FIRST_REVIEW_OF_PLACE).toBeGreaterThan(XP_AMOUNTS.REVIEW_CREATED)
    expect(XP_AMOUNTS.REVIEW_CREATED).toBeGreaterThan(XP_AMOUNTS.BITE_LOGGED)
  })
})
