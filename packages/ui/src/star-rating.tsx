'use client'
import React from 'react'

interface Props {
  value: number
  max?: number
  onChange?: (v: number) => void
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'text-lg', md: 'text-2xl', lg: 'text-3xl' }

export default function StarRating({ value, max = 5, onChange, size = 'md' }: Props) {
  return (
    <span className={`inline-flex gap-0.5 ${sizes[size]}`} aria-label={`${value} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => i + 1).map((star) => (
        <button
          key={star}
          type="button"
          className={`leading-none transition-transform hover:scale-110 ${
            star <= value ? 'text-amber-400' : 'text-gray-300'
          } ${onChange ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={() => onChange?.(star)}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          tabIndex={onChange ? 0 : -1}
        >
          ★
        </button>
      ))}
    </span>
  )
}
