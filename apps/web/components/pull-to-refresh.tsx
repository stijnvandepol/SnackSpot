'use client'
import { useCallback, useRef, useState, type ReactNode } from 'react'

const THRESHOLD = 60
const MAX_PULL = 120

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  children: ReactNode
}

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const pullDistanceRef = useRef(0)
  const startY = useRef(0)
  const pulling = useRef(false)

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0 || refreshing) return
    startY.current = e.touches[0].clientY
    pulling.current = true
  }, [refreshing])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling.current) return
    const dy = e.touches[0].clientY - startY.current
    if (dy < 0) {
      pulling.current = false
      pullDistanceRef.current = 0
      setPullDistance(0)
      return
    }
    const dampened = Math.min(dy * 0.4, MAX_PULL)
    pullDistanceRef.current = dampened
    setPullDistance(dampened)
  }, [])

  const handleTouchEnd = useCallback(async () => {
    const distance = pullDistanceRef.current
    if (!pulling.current && distance === 0) return
    pulling.current = false

    if (distance >= THRESHOLD) {
      setRefreshing(true)
      setPullDistance(THRESHOLD)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        pullDistanceRef.current = 0
        setPullDistance(0)
      }
    } else {
      pullDistanceRef.current = 0
      setPullDistance(0)
    }
  }, [onRefresh])

  const rotation = refreshing ? undefined : pullDistance * 3

  return (
    <div style={{ overscrollBehaviorY: 'contain' }}>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull indicator */}
        <div
          className="flex justify-center overflow-hidden transition-[height] duration-200 ease-out"
          style={{ height: pullDistance > 0 ? pullDistance : 0 }}
        >
          <div
            className="flex items-center justify-center"
            style={{ transform: `translateY(${pullDistance > 0 ? pullDistance / 2 - 12 : 0}px)` }}
          >
            <svg
              className={`h-6 w-6 text-snack-muted ${refreshing ? 'animate-spin' : ''}`}
              style={rotation !== undefined ? { transform: `rotate(${rotation}deg)` } : undefined}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              role="status"
              aria-label={refreshing ? 'Refreshing' : 'Pull to refresh'}
            >
              <path d="M21 12a9 9 0 1 1-6.22-8.56" />
              <path d="M21 3v9h-9" />
            </svg>
          </div>
        </div>

        {children}
      </div>
    </div>
  )
}
