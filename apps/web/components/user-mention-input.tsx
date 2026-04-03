'use client'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from './auth-provider'

interface User {
  id: string
  username: string
  avatarKey: string | null
}

interface UserMentionInputProps {
  value: string
  onChange: (value: string, mentionedUserIds: string[]) => void
  placeholder?: string
  className?: string
  maxLength?: number
}

export function UserMentionInput({
  value,
  onChange,
  placeholder,
  className,
  maxLength = 1000,
}: UserMentionInputProps) {
  const { accessToken } = useAuth()
  const [suggestions, setSuggestions] = useState<User[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([])
  const [mentionedUsers, setMentionedUsers] = useState<Array<{ id: string; username: string }>>([])

  useEffect(() => {
    if (!searchQuery || !accessToken) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    const fetchUsers = async () => {
      try {
        const res = await fetch(
          `/api/v1/users/search?q=${encodeURIComponent(searchQuery)}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        )
        const json = await res.json()
        if (res.ok && json.data) {
          const parsedSuggestions = Array.isArray(json.data)
            ? json.data
            : Array.isArray(json.data?.data)
              ? json.data.data
              : []

          setSuggestions(parsedSuggestions)
          setShowSuggestions(parsedSuggestions.length > 0)
          setSelectedIndex(0)
        } else {
          setSuggestions([])
          setShowSuggestions(false)
        }
      } catch {
        setSuggestions([])
        setShowSuggestions(false)
      }
    }

    const debounce = setTimeout(fetchUsers, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery, accessToken])

  const handleChange = (newValue: string) => {
    // Check if user is typing @ to start a mention
    const cursorPos = textareaRef.current?.selectionStart ?? 0
    const textBeforeCursor = newValue.slice(0, cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1)
      // Only search if there's no space after @
      if (!textAfterAt.includes(' ')) {
        setSearchQuery(textAfterAt)
      } else {
        setSearchQuery('')
        setShowSuggestions(false)
      }
    } else {
      setSearchQuery('')
      setShowSuggestions(false)
    }

    const mentions = newValue.match(/@(\w+)/g) || []
    const usernames = new Set(mentions.map((m) => m.slice(1).toLowerCase()))
    const activeMentionedIds = mentionedUsers
      .filter((u) => usernames.has(u.username.toLowerCase()))
      .map((u) => u.id)

    setMentionedUserIds(activeMentionedIds)
    onChange(newValue, activeMentionedIds)
  }

  const insertMention = (user: User) => {
    if (!textareaRef.current) return

    const cursorPos = textareaRef.current.selectionStart
    const textBeforeCursor = value.slice(0, cursorPos)
    const textAfterCursor = value.slice(cursorPos)
    const lastAtIndex = textBeforeCursor.lastIndexOf('@')

    if (lastAtIndex !== -1) {
      const newText =
        value.slice(0, lastAtIndex) + `@${user.username} ` + textAfterCursor
      
      // Add user ID to mentioned users
      if (!mentionedUserIds.includes(user.id)) {
        const newMentionedIds = [...mentionedUserIds, user.id]
        setMentionedUserIds(newMentionedIds)
        setMentionedUsers((prev) => {
          if (prev.some((u) => u.id === user.id)) return prev
          return [...prev, { id: user.id, username: user.username }]
        })
        onChange(newText, newMentionedIds)
      } else {
        onChange(newText, mentionedUserIds)
      }

      setShowSuggestions(false)
      setSuggestions([])
      setSearchQuery('')

      // Set cursor position after mention
      setTimeout(() => {
        if (textareaRef.current) {
          const newCursorPos = lastAtIndex + user.username.length + 2
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
          textareaRef.current.focus()
        }
      }, 0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (showSuggestions) {
        e.preventDefault()
        insertMention(suggestions[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setSuggestions([])
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        maxLength={maxLength}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showSuggestions}
        aria-controls="mention-suggestions"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          id="mention-suggestions"
          role="listbox"
          className="absolute z-50 w-full mt-1 bg-snack-background border border-snack-border rounded-xl shadow-lg max-h-48 overflow-y-auto"
        >
          {suggestions.map((user, index) => (
            <button
              key={user.id}
              type="button"
              onClick={() => insertMention(user)}
              role="option"
              aria-selected={index === selectedIndex}
              className={`w-full text-left px-4 py-2 hover:bg-snack-surface transition flex items-center gap-2 ${
                index === selectedIndex ? 'bg-snack-surface' : ''
              }`}
            >
              <div className="h-8 w-8 rounded-full bg-snack-surface flex items-center justify-center text-snack-primary font-semibold text-xs uppercase">
                {user.avatarKey ? (
                  <img
                    src={`${process.env.NEXT_PUBLIC_MINIO_URL}/${user.avatarKey}`}
                    alt=""
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  user.username[0]
                )}
              </div>
              <span className="text-sm text-snack-text">@{user.username}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
