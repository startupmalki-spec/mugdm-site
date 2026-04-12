'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import {
  Send,
  Paperclip,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Loader2,
  X,
  FileText,
} from 'lucide-react'

import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// --- Types ---

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface Conversation {
  id: string
  title: string
  created_at: string
}

// --- Markdown-lite renderer (bold, code, lists) ---

function renderMarkdown(text: string) {
  // Split into lines for block-level processing
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' | null = null

  function flushList() {
    if (listItems.length > 0 && listType) {
      const Tag = listType
      elements.push(
        <Tag key={`list-${elements.length}`} className={cn('my-2', listType === 'ul' ? 'list-disc' : 'list-decimal', 'ltr:pl-5 rtl:pr-5')}>
          {listItems.map((item, i) => (
            <li key={i}>{renderInline(item)}</li>
          ))}
        </Tag>
      )
      listItems = []
      listType = null
    }
  }

  function renderInline(line: string): React.ReactNode {
    // Handle inline code, bold, italic
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

  // Helper: detect and collect a markdown table (pipe-delimited lines)
  function tryParseTable(startIdx: number): { element: React.ReactNode; consumed: number } | null {
    // A table needs at least a header row and a separator row
    if (startIdx + 1 >= lines.length) return null

    const headerLine = lines[startIdx].trim()
    const separatorLine = lines[startIdx + 1]?.trim() ?? ''

    // Check header is pipe-delimited
    if (!headerLine.startsWith('|') || !headerLine.endsWith('|')) return null
    // Check separator looks like |---|---|
    if (!/^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/.test(separatorLine)) return null

    const parseRow = (line: string) =>
      line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())

    const headers = parseRow(headerLine)

    // Collect body rows
    const bodyRows: string[][] = []
    let idx = startIdx + 2
    while (idx < lines.length) {
      const row = lines[idx].trim()
      if (!row.startsWith('|') || !row.endsWith('|')) break
      bodyRows.push(parseRow(row))
      idx++
    }

    const element = (
      <div key={`table-${startIdx}`} className="my-2 overflow-x-auto rounded border border-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-surface-2">
              {headers.map((h, ci) => (
                <th
                  key={ci}
                  className="whitespace-nowrap border-b border-border px-3 py-1.5 text-start font-semibold"
                >
                  {renderInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-b-0">
                {row.map((cell, ci) => (
                  <td key={ci} className="whitespace-nowrap px-3 py-1.5">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )

    return { element, consumed: idx - startIdx }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Markdown table
    const table = tryParseTable(i)
    if (table) {
      flushList()
      elements.push(table.element)
      i += table.consumed - 1 // -1 because the for loop increments
      continue
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      if (listType !== 'ul') flushList()
      listType = 'ul'
      listItems.push(line.replace(/^[-*]\s+/, ''))
      continue
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      if (listType !== 'ol') flushList()
      listType = 'ol'
      listItems.push(line.replace(/^\d+\.\s+/, ''))
      continue
    }

    flushList()

    // Heading
    if (line.startsWith('### ')) {
      elements.push(<h4 key={i} className="mt-3 mb-1 text-sm font-semibold">{renderInline(line.slice(4))}</h4>)
    } else if (line.startsWith('## ')) {
      elements.push(<h3 key={i} className="mt-3 mb-1 font-semibold">{renderInline(line.slice(3))}</h3>)
    } else if (line.startsWith('# ')) {
      elements.push(<h2 key={i} className="mt-3 mb-1 text-lg font-bold">{renderInline(line.slice(2))}</h2>)
    } else if (line.trim() === '') {
      elements.push(<br key={i} />)
    } else {
      elements.push(<p key={i} className="my-1">{renderInline(line)}</p>)
    }
  }

  flushList()
  return <>{elements}</>
}

// --- Typing indicator ---

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" style={{ animationDelay: '0ms' }} />
      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" style={{ animationDelay: '150ms' }} />
      <span className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-pulse" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

// --- Chat Bubble ---

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-card border border-border text-foreground'
        )}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose-sm">{renderMarkdown(message.content)}</div>
        )}
      </div>
    </div>
  )
}

// --- Suggested Prompts ---

function SuggestedPrompts({
  onSelect,
  onFileUpload,
}: {
  onSelect: (prompt: string) => void
  onFileUpload?: () => void
}) {
  const t = useTranslations('chat')

  const prompts = [
    t('suggestedCompliance'),
    t('suggestedExpenses'),
    t('suggestedUpload'),
  ]

  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="w-full max-w-md space-y-4 text-center">
        <MessageSquare className="mx-auto h-16 w-16 text-muted-foreground/50" />
        <h2 className="text-lg font-semibold text-foreground">{t('startConversation')}</h2>
        <p className="text-sm text-muted-foreground">{t('startDescription')}</p>
        <div className="space-y-2 pt-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => onSelect(prompt)}
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-start text-sm text-foreground transition-colors hover:border-primary/30 hover:bg-surface-2"
            >
              {prompt}
            </button>
          ))}
          {onFileUpload && (
            <button
              type="button"
              onClick={onFileUpload}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-start text-sm text-foreground transition-colors hover:border-primary/30 hover:bg-surface-2"
            >
              <FileText className="h-4 w-4 text-primary shrink-0" />
              {t('uploadExcelPrompt')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Conversation Sidebar ---

function ConversationSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  isOpen,
  onToggle,
}: {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  isOpen: boolean
  onToggle: () => void
}) {
  const t = useTranslations('chat')

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 z-50 flex w-64 flex-col border-border bg-surface-1 transition-transform duration-300 lg:relative lg:z-0 lg:translate-x-0',
          'ltr:left-0 ltr:border-r rtl:right-0 rtl:border-l',
          isOpen
            ? 'translate-x-0'
            : 'ltr:-translate-x-full rtl:translate-x-full lg:hidden'
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          <h2 className="text-sm font-semibold text-foreground">{t('conversations')}</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onNew}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              title={t('newConversation')}
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              {t('noConversations')}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conv.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors',
                      activeId === conv.id
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                    )}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate">{conv.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>
      </aside>
    </>
  )
}

// --- Chat Input ---

function ChatInput({
  onSend,
  onFileUpload,
  isLoading,
  inputValue,
  setInputValue,
}: {
  onSend: (text: string) => void
  onFileUpload: (file: File) => void
  isLoading: boolean
  inputValue: string
  setInputValue: (v: string) => void
}) {
  const t = useTranslations('chat')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setInputValue('')
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [inputValue, isLoading, onSend, setInputValue])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        onFileUpload(file)
        e.target.value = ''
      }
    },
    [onFileUpload]
  )

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [setInputValue])

  return (
    <div className="sticky bottom-0 border-t border-border bg-surface-1 px-4 py-3">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        {/* File upload */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
          title={t('uploadFile')}
        >
          <Paperclip className="h-5 w-5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Text input */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={t('inputPlaceholder')}
          disabled={isLoading}
          rows={1}
          className="max-h-40 min-h-[40px] flex-1 resize-none rounded-xl border border-border bg-surface-0 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
        />

        {/* Send */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!inputValue.trim() || isLoading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </button>
      </div>
    </div>
  )
}

// --- File attachment preview ---

function FilePreview({
  file,
  onRemove,
}: {
  file: { name: string; parsedData?: string }
  onRemove: () => void
}) {
  return (
    <div className="mx-auto flex max-w-3xl px-4 pb-2">
      <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground">
        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="truncate max-w-[200px]">{file.name}</span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </div>
  )
}

// --- Page ---

export default function ChatPage() {
  const t = useTranslations('chat')

  // State
  const [messages, setMessages] = useState<Message[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [attachedFile, setAttachedFile] = useState<{ name: string; parsedData?: string } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const suggestedFileRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading, scrollToBottom])

  // Load business ID and conversations on mount
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

      if (business) {
        setBusinessId(business.id)
      }

      // Load conversations
      const { data: convs } = await supabase
        .from('chat_conversations')
        .select('id, title, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (convs) {
        setConversations(convs as unknown as Conversation[])
      }
    }

    init()
  }, [])

  // Load messages for a conversation
  const loadConversation = useCallback(async (conversationId: string) => {
    const supabase = createClient()
    const { data: msgs } = await supabase
      .from('chat_messages')
      .select('id, role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (msgs) {
      setMessages(msgs as unknown as Message[])
    }
    setActiveConversationId(conversationId)
    setSidebarOpen(false)
  }, [])

  // Start new conversation
  const handleNewConversation = useCallback(() => {
    setMessages([])
    setActiveConversationId(null)
    setAttachedFile(null)
    setSidebarOpen(false)
  }, [])

  // File upload handler
  const handleFileUpload = useCallback(async (file: File) => {
    if (!businessId) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('businessId', businessId)

    try {
      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data = await res.json()
        setAttachedFile({ name: file.name, parsedData: data.parsedData ?? data.content ?? '' })
      } else {
        // If upload endpoint doesn't exist yet, just attach the file name
        setAttachedFile({ name: file.name })
      }
    } catch {
      setAttachedFile({ name: file.name })
    }
  }, [businessId])

  // Send message
  const handleSend = useCallback(
    async (text: string) => {
      if (!businessId) return

      // Build message content, including file context if present
      let messageContent = text
      if (attachedFile?.parsedData) {
        messageContent = `[Attached file: ${attachedFile.name}]\n\n${attachedFile.parsedData}\n\n${text}`
      } else if (attachedFile) {
        messageContent = `[Attached file: ${attachedFile.name}]\n\n${text}`
      }

      // Add user message to UI
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
      }
      setMessages((prev) => [...prev, userMsg])
      setAttachedFile(null)
      setIsLoading(true)

      // Create assistant placeholder
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
            message: messageContent,
            conversationId: activeConversationId,
            businessId,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!res.ok) {
          throw new Error('Chat request failed')
        }

        const reader = res.body?.getReader()
        if (!reader) throw new Error('No response body')

        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE lines
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const jsonStr = line.slice(6)

            try {
              const event = JSON.parse(jsonStr)

              if (event.type === 'text') {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + event.text }
                      : m
                  )
                )
              } else if (event.type === 'done') {
                const newConvId = event.conversationId

                if (!activeConversationId && newConvId) {
                  setActiveConversationId(newConvId)

                  // Add to conversations list
                  setConversations((prev) => {
                    if (prev.some((c) => c.id === newConvId)) return prev
                    return [
                      {
                        id: newConvId,
                        title: text.slice(0, 100) + (text.length > 100 ? '...' : ''),
                        created_at: new Date().toISOString(),
                      },
                      ...prev,
                    ]
                  })
                }
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
              // Skip malformed JSON lines
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
    [businessId, activeConversationId, attachedFile, t]
  )

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden -mx-4 -my-6 lg:-mx-8 lg:-my-8">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        activeId={activeConversationId}
        onSelect={loadConversation}
        onNew={handleNewConversation}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
      />

      {/* Main chat area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            title={t('toggleSidebar')}
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" />
            )}
          </button>
          <h1 className="text-sm font-semibold text-foreground">{t('title')}</h1>
          <button
            type="button"
            onClick={handleNewConversation}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground ltr:ml-auto rtl:mr-auto"
            title={t('newConversation')}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        {/* Messages area */}
        {messages.length === 0 && !isLoading ? (
          <>
            <SuggestedPrompts
              onSelect={(prompt) => handleSend(prompt)}
              onFileUpload={() => suggestedFileRef.current?.click()}
            />
            <input
              ref={suggestedFileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  handleFileUpload(file)
                  e.target.value = ''
                }
              }}
            />
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
              {isLoading && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === '' && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-card border border-border">
                    <TypingIndicator />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}

        {/* File preview */}
        {attachedFile && (
          <FilePreview file={attachedFile} onRemove={() => setAttachedFile(null)} />
        )}

        {/* Input */}
        <ChatInput
          onSend={handleSend}
          onFileUpload={handleFileUpload}
          isLoading={isLoading}
          inputValue={inputValue}
          setInputValue={setInputValue}
        />
      </div>
    </div>
  )
}
