'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { Send, Minus, ExternalLink, Loader2, MessageSquare } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Link, usePathname } from '@/i18n/routing'
import { createClient } from '@/lib/supabase/client'

// --- Types ---

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

// --- Inline markdown renderer (lightweight, same style as full chat) ---

function renderInline(line: string): React.ReactNode {
  const parts: React.ReactNode[] = []
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('`')) {
      parts.push(
        <code key={match.index} className="rounded bg-surface-2 px-1 py-0.5 text-xs font-mono">
          {token.slice(1, -1)}
        </code>
      )
    } else if (token.startsWith('**')) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>)
    } else if (token.startsWith('*')) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>)
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex))
  }
  return parts.length === 1 ? parts[0] : <>{parts}</>
}

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null

  function flushList() {
    if (listItems.length > 0 && listType) {
      const Tag = listType
      elements.push(
        <Tag key={`list-${elements.length}`} className={cn('my-1', listType === 'ul' ? 'list-disc' : 'list-decimal', 'ltr:pl-4 rtl:pr-4')}>
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </Tag>
      )
      listItems = []
      listType = null
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^[-*]\s+/.test(line)) {
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(line.replace(/^[-*]\s+/, ''))
      continue
    }
    if (/^\d+\.\s+/.test(line)) {
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(line.replace(/^\d+\.\s+/, ''))
      continue
    }

    flushList()

    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="mt-2 mb-0.5 text-xs font-semibold">{renderInline(line.slice(4))}</h4>)
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="mt-2 mb-0.5 text-sm font-semibold">{renderInline(line.slice(3))}</h3>)
    } else if (line.trim() === '') {
      elements.push(<br key={i} />)
    } else {
      elements.push(<p key={i} className="my-0.5">{renderInline(line)}</p>)
    }
  }

  flushList()
  return <>{elements}</>
}

// --- Mini Chat Bubble ---

function MiniBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border text-foreground'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-xs">{renderMarkdown(message.content)}</div>
        )}
      </div>
    </div>
  )
}

// --- Typing Dots ---

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" style={{ animationDelay: '150ms' }} />
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-pulse" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

// --- Suggested prompt based on current path ---

function getSuggestedPromptKey(pathname: string): string {
  if (pathname.includes('/dashboard')) return 'suggestDashboard'
  if (pathname.includes('/vault')) return 'suggestVault'
  if (pathname.includes('/calendar')) return 'suggestCalendar'
  if (pathname.includes('/bookkeeper')) return 'suggestBookkeeper'
  if (pathname.includes('/team')) return 'suggestTeam'
  return 'suggestDefault'
}

// --- Constants ---
const STORAGE_KEY = 'mugdm-mini-chat-conversation'

// --- Component ---

export default function FloatingAssistant() {
  const t = useTranslations('chat')
  const pathname = usePathname()

  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [hasUnread, setHasUnread] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const suggestedPrompt = useMemo(() => {
    const key = getSuggestedPromptKey(pathname)
    return t(key)
  }, [pathname, t])

  // Load businessId on mount
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: business } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .single() as unknown as { data: { id: string } | null }

      if (business) setBusinessId(business.id)
    }

    init()
  }, [])

  // Restore conversationId from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setConversationId(stored)
    } catch {
      // localStorage may be unavailable
    }
  }, [])

  // Persist conversationId
  useEffect(() => {
    try {
      if (conversationId) {
        localStorage.setItem(STORAGE_KEY, conversationId)
      }
    } catch {
      // Ignore
    }
  }, [conversationId])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Clear unread when opening
  useEffect(() => {
    if (isOpen) setHasUnread(false)
  }, [isOpen])

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const handleSend = useCallback(
    async (text: string) => {
      if (!businessId || !text.trim()) return

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text.trim(),
      }
      setMessages((prev) => [...prev, userMsg])
      setInputValue('')
      setIsLoading(true)

      const assistantId = `assistant-${Date.now()}`
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
      }
      setMessages((prev) => [...prev, assistantMsg])

      try {
        abortControllerRef.current = new AbortController()

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim(),
            conversationId,
            businessId,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!res.ok) throw new Error('Chat request failed')

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const event = JSON.parse(line.slice(6))

              if (event.type === 'text') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.text }
                      : m
                  )
                )
              } else if (event.type === 'done') {
                if (event.conversationId && !conversationId) {
                  setConversationId(event.conversationId)
                }
                // Flag unread if panel is collapsed
                if (!isOpen) setHasUnread(true)
              } else if (event.type === 'error') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: t('errorOccurred') }
                      : m
                  )
                )
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: t('errorOccurred') }
                : m
            )
          )
        }
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [businessId, conversationId, isOpen, t]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend(inputValue)
      }
    },
    [handleSend, inputValue]
  )

  // Don't render on the full chat page
  if (pathname.includes('/chat')) return null

  return (
    <>
      {/* Expanded Panel */}
      <div
        className={cn(
          'fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl transition-all duration-200',
          'bottom-20 ltr:right-6 rtl:left-6',
          'w-[380px] max-w-[calc(100vw-3rem)]',
          isOpen
            ? 'h-[500px] max-h-[calc(100vh-8rem)] scale-100 opacity-100'
            : 'h-0 scale-95 opacity-0 pointer-events-none'
        )}
      >
        {/* Header */}
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface-1 px-4">
          <span className="text-sm font-semibold text-foreground">{t('miniTitle')}</span>
          <div className="flex items-center gap-1">
            <Link
              href="/chat"
              className="rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <span className="flex items-center gap-1">
                {t('openFull')}
                <ExternalLink className="h-3 w-3" />
              </span>
            </Link>
            <button
              type="button"
              onClick={handleToggle}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              aria-label="Minimize"
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {messages.length === 0 && !isLoading ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground">{t('startDescription')}</p>
              <button
                type="button"
                onClick={() => handleSend(suggestedPrompt)}
                className="rounded-xl border border-border bg-surface-1 px-3 py-2 text-xs text-foreground transition-colors hover:border-primary/30 hover:bg-surface-2"
              >
                {suggestedPrompt}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <MiniBubble key={msg.id} message={msg} />
              ))}
              {isLoading &&
                messages.length > 0 &&
                messages[messages.length - 1]?.role === 'assistant' &&
                messages[messages.length - 1]?.content === '' && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-border bg-card">
                      <TypingDots />
                    </div>
                  </div>
                )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border bg-surface-1 px-3 py-2">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('placeholder')}
              disabled={isLoading || !businessId}
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-0 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => handleSend(inputValue)}
              disabled={!inputValue.trim() || isLoading || !businessId}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Floating Button */}
      <button
        type="button"
        onClick={handleToggle}
        data-tour="chat"
        className={cn(
          'fixed z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-200 hover:bg-primary/90 hover:shadow-xl',
          'bottom-6 ltr:right-6 rtl:left-6 rtl:right-auto'
        )}
        aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
      >
        {hasUnread && !isOpen && (
          <span className="absolute -top-1 ltr:-right-1 rtl:-left-1 h-3 w-3 rounded-full bg-destructive animate-pulse" />
        )}
        <Image
          src="/brand/7-transparent.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 object-contain brightness-0 invert"
          aria-hidden="true"
        />
      </button>
    </>
  )
}
