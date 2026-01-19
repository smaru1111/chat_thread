"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import {
  CheckIcon,
  CopyIcon,
  Loader2Icon,
  LogOutIcon,
  MenuIcon,
  Trash2Icon,
  UserRoundIcon,
} from "lucide-react"

type Conversation = {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
}

type Message = {
  id: string
  conversationId: string
  parentMessageId: string | null
  threadRootId: string
  depth: number
  role: "user" | "assistant" | string
  content: string
  createdAt: string
}

type Me = { id: string; email: string | null; name: string | null; isAdmin: boolean } | null
type ChatMode = "thread" | "linear"

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return (await res.json()) as T
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through
  }

  try {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.setAttribute("readonly", "")
    ta.style.position = "fixed"
    ta.style.top = "0"
    ta.style.left = "-9999px"
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, ta.value.length)
    const ok = document.execCommand("copy")
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

function buildById(items: Message[]) {
  const map = new Map<string, Message>()
  for (const m of items) map.set(m.id, m)
  return map
}

function buildChildren(items: Message[]) {
  const map = new Map<string | null, Message[]>()
  for (const m of items) {
    const key = m.parentMessageId
    const arr = map.get(key) ?? []
    arr.push(m)
    map.set(key, arr)
  }
  return map
}

function RoleAvatar({ role }: { role: "user" | "assistant" | string }) {
  const isUser = role === "user"
  const label = isUser ? "User" : "Assistant"
  return (
    <div
      className={[
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        isUser ? "bg-muted text-foreground" : "bg-primary text-primary-foreground",
      ].join(" ")}
      aria-label={label}
      title={label}
    >
      {isUser ? "U" : "A"}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const MARKDOWN_TEST_PREFIX = `
# Markdown表示テスト
# H1
## H2
### H3

- **太字**
- *斜体*
- \`inline code\`
- [リンク](https://example.com)

> 引用（blockquote）

\`\`\`ts
const x: number = 1
console.log(x)
\`\`\`

- [x] タスク（完了）
- [ ] タスク（未完了）

| col1 | col2 |
| --- | --- |
| a | b |
`

function MarkdownMessage({
  content,
  isPending,
}: {
  content: string
  isPending?: boolean
}) {
  // eslint-disable-next-line prefer-const
  let md = content
  // Markdown表示のテスト用（不要になったら次の1行をコメントアウトしてください）
  // md = `${MARKDOWN_TEST_PREFIX}\n\n${md}`

  return (
    <div
      className={[
        "min-w-0 wrap-break-word",
        isPending ? "text-muted-foreground animate-pulse" : "",
      ].join(" ")}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children }) => (
            <h1 className="mt-2 text-lg font-semibold">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mt-2 text-base font-semibold">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-2 text-sm font-semibold">{children}</h3>
          ),
          p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="text-blue-400 underline hover:text-blue-600"
            >
              {children}
            </a>
          ),
          ul: ({ children }) => (
            <ul className="ml-5 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="ml-5 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="whitespace-pre-wrap">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-muted-foreground/40 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className)
            if (!isBlock) {
              return (
                <code
                  className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
                  {...props}
                >
                  {children}
                </code>
              )
            }
            return (
              <code className={["font-mono text-xs", className ?? ""].join(" ")} {...props}>
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md bg-muted p-3">{children}</pre>
          ),
          hr: () => <hr className="my-2 border-border" />,
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted px-2 py-1 text-left font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1 align-top">{children}</td>
          ),
        }}
      >
        {md}
      </ReactMarkdown>
    </div>
  )
}

function countDescendants(
  children: Map<string | null, Message[]>,
  rootId: string
) {
  let count = 0
  const queue = [...(children.get(rootId) ?? [])]
  while (queue.length) {
    const cur = queue.shift()!
    count += 1
    queue.push(...(children.get(cur.id) ?? []))
  }
  return count
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()

    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    }

    // Safari fallback
    mql.addListener(onChange)
    return () => mql.removeListener(onChange)
  }, [query])

  return matches
}

export function AppShell() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [chatMode, setChatMode] = useState<ChatMode>("thread")

  const [mainInput, setMainInput] = useState("")

  const [threadRootMessageId, setThreadRootMessageId] = useState<string | null>(
    null
  )
  const [threadInput, setThreadInput] = useState("")

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const [isLoadingConversations, setIsLoadingConversations] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [isSendingMain, setIsSendingMain] = useState(false)
  const [isSendingThread, setIsSendingThread] = useState(false)
  const [uiError, setUiError] = useState<string | null>(null)

  const [deletingConversationIds, setDeletingConversationIds] = useState<Set<string>>(
    () => new Set()
  )

  const [copiedConversationId, setCopiedConversationId] = useState<string | null>(
    null
  )
  const copiedTimerRef = useRef<number | null>(null)

  const [me, setMe] = useState<Me>(null)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [adminConversationId, setAdminConversationId] = useState("")
  const [isAdminOpening, setIsAdminOpening] = useState(false)

  function markCopied(conversationId: string) {
    setCopiedConversationId(conversationId)
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = window.setTimeout(() => {
      setCopiedConversationId(null)
      copiedTimerRef.current = null
    }, 1500)
  }

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current !== null) {
        window.clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    // URLパラメータ（?mode=linear|thread）があれば優先。なければlocalStorageを参照。
    const url = new URL(window.location.href)
    const q = url.searchParams.get("mode")
    const stored = window.localStorage.getItem("chat_mode")
    const initial: ChatMode =
      q === "linear" || q === "thread"
        ? q
        : stored === "linear" || stored === "thread"
          ? (stored as ChatMode)
          : "thread"
    setChatMode(initial)
  }, [])

  useEffect(() => {
    window.localStorage.setItem("chat_mode", chatMode)
    if (chatMode === "linear") {
      // 線形モードではスレッドを閉じる（操作の混在を防ぐ）
      setThreadRootMessageId(null)
      setThreadInput("")
    }
  }, [chatMode])

  const mainEndRef = useRef<HTMLDivElement | null>(null)
  const threadEndRef = useRef<HTMLDivElement | null>(null)

  async function handleCopyConversationId(conversationId: string) {
    setUiError(null)
    const ok = await copyTextToClipboard(conversationId)
    if (ok) {
      markCopied(conversationId)
      return
    }
    setUiError(
      "会話IDのコピーに失敗しました。会話一覧のコピーアイコンをもう一度試すか、環境により手動でコピーしてください。"
    )
    // 最後の手段（ユーザーが手でコピーできるようにする）
    try {
      window.prompt(
        "会話ID（これをコピーしてアンケートに貼り付けてください）",
        conversationId
      )
    } catch {
      // ignore
    }
  }

  async function openConversationByIdAsAdmin() {
    setUiError(null)
    const id = adminConversationId.trim()
    if (!id) {
      setUiError("会話IDを入力してください。")
      return
    }

    setIsAdminOpening(true)
    try {
      const conv = await api<Conversation>(
        `/api/conversations/${encodeURIComponent(id)}`
      )
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id)
        const merged = exists
          ? prev.map((c) => (c.id === conv.id ? conv : c))
          : [conv, ...prev]
        merged.sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        return merged
      })
      setSelectedConversationId(conv.id)
      setThreadRootMessageId(null)
      setAdminConversationId("")
      setIsUserMenuOpen(false)
      setIsSidebarOpen(false)
    } catch {
      setUiError("会話が見つかりませんでした。会話IDを確認してください。")
    } finally {
      setIsAdminOpening(false)
    }
  }

  function scrollToMainEnd(behavior: ScrollBehavior = "smooth") {
    // ScrollArea内に効かせるため、要素へscrollIntoViewする
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        mainEndRef.current?.scrollIntoView({ behavior, block: "end" })
      })
    })
  }

  function scrollToThreadEnd(behavior: ScrollBehavior = "smooth") {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        threadEndRef.current?.scrollIntoView({ behavior, block: "end" })
      })
    })
  }

  useEffect(() => {
    setIsLoadingConversations(true)
    api<{ items: Conversation[] }>("/api/conversations")
      .then((d) => {
        setConversations(d.items)
        if (!selectedConversationId && d.items[0]) {
          setSelectedConversationId(d.items[0].id)
        }
      })
      .catch(() => setUiError("会話一覧の読み込みに失敗しました。"))
      .finally(() => setIsLoadingConversations(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    api<{ user: Me }>("/api/auth/me")
      .then((d) => setMe(d.user))
      .catch(() => setMe(null))
  }, [])

  useEffect(() => {
    if (!selectedConversationId) return
    // 会話を切り替えたらスレッドは閉じる（別会話のメッセージIDを参照しない）
    setThreadRootMessageId(null)
    setThreadInput("")
    setIsLoadingMessages(true)
    api<{ items: Message[] }>(
      `/api/conversations/${selectedConversationId}/messages`
    )
      .then((d) => setMessages(d.items))
      .catch(() => {
        setMessages([])
        setUiError("メッセージの読み込みに失敗しました。")
      })
      .finally(() => setIsLoadingMessages(false))
  }, [selectedConversationId])

  const byId = useMemo(() => buildById(messages), [messages])
  const children = useMemo(() => buildChildren(messages), [messages])

  useEffect(() => {
    // スレッド起点が現在のメッセージ集合に存在しない場合は閉じる（表示崩れ防止）
    if (threadRootMessageId && !byId.get(threadRootMessageId)) {
      setThreadRootMessageId(null)
      setThreadInput("")
    }
  }, [byId, threadRootMessageId])

  const mainRoots = useMemo(() => {
    // UIの「メイン」は root(user) + その直下のassistant を並べる
    const roots = (children.get(null) ?? []).filter((m) => m.role === "user")
    return roots
  }, [children])

  const linearTimeline = useMemo(() => {
    // 線形モードでは親子関係を無視し、createdAt順の全メッセージを時系列表示する
    return messages
  }, [messages])

  const threadReplyCountById = useMemo(() => {
    const map = new Map<string, number>()
    for (const m of messages) {
      map.set(m.id, countDescendants(children, m.id))
    }
    return map
  }, [children, messages])

  const selectedThreadRoot = threadRootMessageId
    ? (byId.get(threadRootMessageId) ?? null)
    : null

  const threadMessages = useMemo(() => {
    if (!selectedThreadRoot) return []
    // /tree を使っても良いが、まずはローカルのツリーからサブツリーを抽出
    const out: Message[] = []
    const stack = [...(children.get(selectedThreadRoot.id) ?? [])]
    while (stack.length) {
      const cur = stack.shift()!
      out.push(cur)
      stack.push(...(children.get(cur.id) ?? []))
    }
    return out
  }, [children, selectedThreadRoot])

  async function refreshConversations() {
    try {
      const d = await api<{ items: Conversation[] }>("/api/conversations")
      setConversations(d.items)
    } catch {
      // UI上は致命ではないので黙殺
    }
  }

  async function refreshMessages(conversationId?: string) {
    const id = conversationId ?? selectedConversationId
    if (!id) return
    try {
      const d = await api<{ items: Message[] }>(
        `/api/conversations/${id}/messages`
      )
      setMessages(d.items)
    } catch {
      // UI上は致命ではないので黙殺
    }
  }

  async function createConversation() {
    if (isCreatingConversation) return
    setUiError(null)
    setIsCreatingConversation(true)
    try {
      // タイトル入力UIは省略しているため、現状は常に null（自動タイトル付けを前提）
      const title = null
      const created = await api<Conversation>("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ title }),
      })
      setConversations((prev) => [
        created,
        ...prev.filter((c) => c.id !== created.id),
      ])
      setSelectedConversationId(created.id)
      void refreshConversations()
      return created
    } catch {
      setUiError("会話の作成に失敗しました。")
      return null
    } finally {
      setIsCreatingConversation(false)
    }
  }

  async function maybeAutoTitle(conversationId: string) {
    const conv = conversations.find((c) => c.id === conversationId) ?? null
    if (!conv || (conv.title && conv.title.trim())) return
    try {
      const d = await api<{ title: string }>(
        `/api/conversations/${conversationId}/auto-title`,
        { method: "POST" }
      )
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, title: d.title } : c))
      )
    } catch {
      // タイトルは任意なので黙殺
    }
  }

  async function deleteConversation(conversationId: string) {
    if (deletingConversationIds.has(conversationId)) return
    if (!confirm("このセッションを削除しますか？")) return
    setUiError(null)
    try {
      setDeletingConversationIds((prev) => new Set(prev).add(conversationId))
      await api<{ ok: true }>(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      })
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== conversationId)
        if (selectedConversationId === conversationId) {
          const nextSelected = next[0]?.id ?? null
          setSelectedConversationId(nextSelected)
          setMessages([])
          setThreadRootMessageId(null)
          setThreadInput("")
        }
        return next
      })
    } catch {
      setUiError("セッションの削除に失敗しました。")
    } finally {
      setDeletingConversationIds((prev) => {
        const next = new Set(prev)
        next.delete(conversationId)
        return next
      })
    }
  }

  function makePendingAssistant(parent: Message): Message {
    return {
      id: `pending-assistant-${parent.id}`,
      conversationId: parent.conversationId,
      parentMessageId: parent.id,
      threadRootId: parent.threadRootId ?? parent.id,
      depth: parent.depth + 1,
      role: "assistant",
      content: "回答を生成中…",
      createdAt: new Date().toISOString(),
    }
  }

  async function sendMain() {
    if (isSendingMain) return
    const content = mainInput.trim()
    if (!content) return

    setUiError(null)
    setIsSendingMain(true)
    setMainInput("")

    let conversationId: string | null = selectedConversationId
    try {
      if (!conversationId) {
        const created = await createConversation()
        if (!created) return
        conversationId = created.id
      }

      const userMsg = await api<Message>("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          parentMessageId: null,
          role: "user",
          content,
        }),
      })

      const pending = makePendingAssistant(userMsg)
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== userMsg.id),
        userMsg,
        pending,
      ])
      scrollToMainEnd()

      const assistantMsg = await api<Message>(
        `/api/messages/${userMsg.id}/complete?mode=${chatMode}`,
        { method: "POST" }
      )

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== pending.id && m.id !== assistantMsg.id),
        assistantMsg,
      ])
      scrollToMainEnd()

      void refreshConversations()
      void maybeAutoTitle(conversationId)
    } catch {
      setUiError("送信または回答生成に失敗しました。")
      void refreshMessages(conversationId ?? undefined)
      void refreshConversations()
    } finally {
      setIsSendingMain(false)
    }
  }

  async function sendThread() {
    if (!selectedConversationId || !selectedThreadRoot || isSendingThread) return
    const content = threadInput.trim()
    if (!content) return
    setUiError(null)
    setIsSendingThread(true)
    setThreadInput("")

    // スレッドは「最後のメッセージ」にぶら下げる（Slack風の線形）
    const last =
      threadMessages.length > 0
        ? threadMessages[threadMessages.length - 1]
        : null
    const parentMessageId = last?.id ?? selectedThreadRoot.id

    try {
      const userMsg = await api<Message>("/api/messages", {
        method: "POST",
        body: JSON.stringify({
          conversationId: selectedConversationId,
          parentMessageId,
          role: "user",
          content,
        }),
      })

      const pending = makePendingAssistant(userMsg)
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== userMsg.id),
        userMsg,
        pending,
      ])
      scrollToThreadEnd()

      const assistantMsg = await api<Message>(
        `/api/messages/${userMsg.id}/complete?mode=${chatMode}`,
        { method: "POST" }
      )

      setMessages((prev) => [
        ...prev.filter((m) => m.id !== pending.id && m.id !== assistantMsg.id),
        assistantMsg,
      ])
      scrollToThreadEnd()

      void refreshConversations()
      void maybeAutoTitle(selectedConversationId)
    } catch {
      setUiError("送信または回答生成に失敗しました。")
      void refreshMessages()
      void refreshConversations()
    } finally {
      setIsSendingThread(false)
    }
  }

  const isThreadOpen = threadRootMessageId !== null

  const isMdUp = useMediaQuery("(min-width: 768px)")
  const isLgUp = useMediaQuery("(min-width: 1024px)")

  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) return null
    return conversations.find((c) => c.id === selectedConversationId) ?? null
  }, [conversations, selectedConversationId])

  useEffect(() => {
    if (isMdUp) setIsSidebarOpen(false)
  }, [isMdUp])

  return (
    <div className="h-screen overflow-hidden">
      {/* Mobile: left sidebar as sheet */}
      {!isMdUp && (
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetContent side="left" className="p-0">
            <SheetTitle className="sr-only">サイドバー</SheetTitle>
            <div className="flex min-h-0 h-full flex-col p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold tracking-wide">
                      CHAT_THREAD
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void createConversation()
                    setIsSidebarOpen(false)
                  }}
                  disabled={isCreatingConversation}
                  className="shrink-0"
                >
                  {isCreatingConversation ? "作成中…" : "新規"}
                </Button>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-1 pr-4">
                  {isLoadingConversations && (
                    <div className="text-muted-foreground px-2 py-2 text-xs">
                      読み込み中…
                    </div>
                  )}
                  {conversations.map((c) => (
                    <div
                      key={c.id}
                      className={[
                        "w-full rounded-md px-2 py-2 text-left text-sm cursor-pointer select-none",
                        selectedConversationId === c.id
                          ? "bg-muted"
                          : "hover:bg-muted/50",
                      ].join(" ")}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedConversationId(c.id)
                        setThreadRootMessageId(null)
                        setIsSidebarOpen(false)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          setSelectedConversationId(c.id)
                          setThreadRootMessageId(null)
                          setIsSidebarOpen(false)
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {c.title || "Untitled"}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {new Date(c.updatedAt).toLocaleString()}
                          </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-0.5 mr-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleCopyConversationId(c.id)
                            }}
                            aria-label="会話IDをコピー"
                            title="会話IDをコピー"
                          >
                            {copiedConversationId === c.id ? (
                              <CheckIcon className="h-4 w-4" />
                            ) : (
                              <CopyIcon className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation()
                              void deleteConversation(c.id)
                            }}
                            aria-label="セッションを削除"
                            disabled={deletingConversationIds.has(c.id)}
                          >
                            {deletingConversationIds.has(c.id) ? (
                              <Loader2Icon className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2Icon className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <div className="mt-3 border-t pt-3">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/50"
                  onClick={() => {
                    setIsSidebarOpen(false)
                    setIsUserMenuOpen(true)
                  }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                    <UserRoundIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {me
                        ? `ユーザー: ${
                            me.name?.trim() ||
                            me.email?.trim() ||
                            `${me.id.slice(0, 8)}…`
                          }${me.isAdmin ? " (admin)" : ""}`
                        : "未ログイン"}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      アカウント
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      )}

      <div className="flex h-full min-h-0 overflow-hidden">
        {/* Desktop/tablet: left sidebar (fixed) */}
        <aside className="hidden md:flex w-[260px] shrink-0 border-r p-3 min-h-0 flex-col">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-wide">
                  CHAT_THREAD
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={createConversation}
              disabled={isCreatingConversation}
              className="shrink-0"
            >
              {isCreatingConversation ? "作成中…" : "新規"}
            </Button>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="w-[250px] space-y-1 pr-4">
              {isLoadingConversations && (
                <div className="text-muted-foreground px-2 py-2 text-xs">
                  読み込み中…
                </div>
              )}
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={[
                    "rounded-md px-2 py-2 text-left text-sm cursor-pointer select-none",
                    selectedConversationId === c.id
                      ? "bg-muted"
                      : "hover:bg-muted/50",
                  ].join(" ")}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setSelectedConversationId(c.id)
                    setThreadRootMessageId(null)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setSelectedConversationId(c.id)
                      setThreadRootMessageId(null)
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">
                        {c.title || "Untitled"}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {new Date(c.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-0.5 mr-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleCopyConversationId(c.id)
                        }}
                        aria-label="会話IDをコピー"
                        title="会話IDをコピー"
                      >
                        {copiedConversationId === c.id ? (
                          <CheckIcon className="h-4 w-4" />
                        ) : (
                          <CopyIcon className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          void deleteConversation(c.id)
                        }}
                        aria-label="セッションを削除"
                        disabled={deletingConversationIds.has(c.id)}
                      >
                        {deletingConversationIds.has(c.id) ? (
                          <Loader2Icon className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2Icon className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <div className="mt-3 border-t pt-3">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-muted/50"
              onClick={() => setIsUserMenuOpen(true)}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                <UserRoundIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">
                  {me
                    ? `ユーザー: ${
                        me.name?.trim() || me.email?.trim() || `${me.id.slice(0, 8)}…`
                      }`
                    : "未ログイン"}
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  アカウント
                </div>
              </div>
            </button>
          </div>
        </aside>

        <main className="flex flex-1 min-w-0 min-h-0 flex-col">
          {/* Mobile header */}
          <div className="md:hidden shrink-0 border-b bg-background p-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="メニューを開く"
                className="shrink-0"
              >
                <MenuIcon className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold tracking-wide">
                  CHAT_THREAD
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  {selectedConversation?.title ||
                    (selectedConversation ? "Untitled" : "会話を選択してください")}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={chatMode === "linear" ? "default" : "secondary"}
                  onClick={() => setChatMode("linear")}
                >
                  線形
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={chatMode === "thread" ? "default" : "secondary"}
                  onClick={() => setChatMode("thread")}
                >
                  スレッド
                </Button>
              </div>
            </div>
          </div>

          {/* Desktop/tablet header */}
          <div className="hidden md:block shrink-0 border-b bg-background p-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-wide">
                  {selectedConversation?.title ||
                    (selectedConversation ? "Untitled" : "会話を選択してください")}
                </div>
                <div className="text-muted-foreground truncate text-xs">
                  モード: {chatMode === "linear" ? "線形" : "スレッド"}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={chatMode === "linear" ? "default" : "secondary"}
                  onClick={() => setChatMode("linear")}
                >
                  線形
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={chatMode === "thread" ? "default" : "secondary"}
                  onClick={() => setChatMode("thread")}
                >
                  スレッド
                </Button>
              </div>
            </div>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-6 p-4">
              {uiError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {uiError}
                </div>
              )}

              {isLoadingMessages ? (
                <div className="text-muted-foreground text-sm">
                  メッセージを読み込み中…
                </div>
              ) : (
                <>
                  {chatMode === "linear" ? (
                    <>
                      {linearTimeline.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-lg p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex gap-3">
                            <RoleAvatar role={m.role} />
                            <div className="min-w-0 flex-1">
                              <div className="text-muted-foreground text-xs">
                                {m.role === "user" ? "User" : "Assistant"}
                              </div>
                              <MarkdownMessage
                                content={m.content}
                                isPending={m.id.startsWith("pending-assistant-")}
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      {linearTimeline.length === 0 && (
                        <div className="text-muted-foreground text-sm">
                          まずは質問してみてください。
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {mainRoots.map((root) => {
                        const ai =
                          (children.get(root.id) ?? []).find(
                            (m) => m.role === "assistant"
                          ) ?? null
                        const replyCount = ai
                          ? (threadReplyCountById.get(ai.id) ?? 0)
                          : 0
                        const isPendingAi = ai
                          ? ai.id.startsWith("pending-assistant-")
                          : false
                        return (
                          <div key={root.id} className="space-y-2">
                            <div className="group rounded-lg p-3 transition-colors hover:bg-muted/50">
                              <div className="flex gap-3">
                                <RoleAvatar role="user" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-muted-foreground text-xs">
                                    User
                                  </div>
                                  <MarkdownMessage content={root.content} />
                                </div>
                              </div>
                            </div>

                            {ai && (
                              <div className="group rounded-lg p-3 transition-colors hover:bg-muted/50">
                                <div className="flex gap-3">
                                  <RoleAvatar role="assistant" />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-muted-foreground text-xs">
                                          Assistant
                                        </div>
                                        <MarkdownMessage
                                          content={ai.content}
                                          isPending={isPendingAi}
                                        />
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        className="opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100"
                                        onClick={() =>
                                          setThreadRootMessageId(ai.id)
                                        }
                                        disabled={isPendingAi}
                                      >
                                        スレッドで質問
                                      </Button>
                                    </div>

                                    {replyCount > 0 && (
                                      <button
                                        className="mt-2 text-left text-xs text-blue-400 underline hover:text-blue-600"
                                        onClick={() =>
                                          setThreadRootMessageId(ai.id)
                                        }
                                      >
                                        {replyCount}件の返信
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {mainRoots.length === 0 && (
                        <div className="text-muted-foreground text-sm">
                          まずはメインで質問してみてください。
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              <div ref={mainEndRef} />
            </div>
          </ScrollArea>

          <div className="sticky bottom-0 border-t bg-background p-2">
            <div className="flex flex-col gap-2 sm:flex-row ">
              <Textarea
                value={mainInput}
                onChange={(e) => setMainInput(e.target.value)}
                placeholder={chatMode === "linear" ? "質問する" : "メインで質問する"}
                className="min-h-[44px]"
                disabled={isSendingMain}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey && !e.shiftKey) {
                    e.preventDefault()
                    void sendMain()
                  }
                }}
              />
              <div className="flex flex-row items-center justify-end sm:flex-col sm:items-center">
                <Button
                  onClick={sendMain}
                  disabled={isSendingMain}
                  className="w-full sm:w-auto"
                >
                  {isSendingMain ? "送信中…" : "送信"}
                </Button>
                <div className="text-muted-foreground text-[10px] sm:mt-1 hidden sm:block">
                  ⌘ + Enter
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right thread pane (only mounted when open to avoid blank area) */}
        {chatMode === "thread" && isThreadOpen && (
          <>
            {/* Desktop (lg+): right pane */}
            <aside className="hidden lg:flex h-full w-[420px] min-w-0 min-h-0 shrink-0 flex-col border-l bg-background">
              <div className="border-b p-4">
                <div className="flex items-center justify-between gap-3 align-middle">
                  <div className="align-middle">
                    <div className="text-sm font-medium">スレッド</div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setThreadRootMessageId(null)}
                  >
                    閉じる
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-3 p-4">
                  {!selectedThreadRoot && (
                    <div className="text-muted-foreground text-sm">
                      右ペインに表示するスレッドを選んでください。
                    </div>
                  )}

                  {selectedThreadRoot && (
                    <>
                      <div className="rounded-lg p-3 transition-colors hover:bg-muted/50">
                        <div className="flex gap-3">
                          <RoleAvatar role="assistant" />
                          <div className="min-w-0 flex-1">
                            <div className="text-muted-foreground text-xs">
                              起点（Assistant）
                            </div>
                            <MarkdownMessage content={selectedThreadRoot.content} />
                          </div>
                        </div>
                      </div>

                      {threadMessages.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-lg p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="flex gap-3">
                            <RoleAvatar role={m.role} />
                            <div className="min-w-0 flex-1">
                              <div className="text-muted-foreground text-xs">
                                {m.role === "user" ? "User" : "Assistant"}
                              </div>
                              <MarkdownMessage
                                content={m.content}
                                isPending={m.id.startsWith("pending-assistant-")}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}

                  <div ref={threadEndRef} />
                </div>
              </ScrollArea>

              <div className="sticky bottom-0 border-t bg-background p-2">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Textarea
                    value={threadInput}
                    onChange={(e) => setThreadInput(e.target.value)}
                    placeholder="スレッドで質問する"
                    className="min-h-[44px]"
                    disabled={!selectedThreadRoot || isSendingThread}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.metaKey && !e.shiftKey) {
                        e.preventDefault()
                        void sendThread()
                      }
                    }}
                  />
                  <div className="flex flex-row items-center justify-end sm:flex-col sm:items-center">
                    <Button
                      onClick={sendThread}
                      disabled={!selectedThreadRoot || isSendingThread}
                      className="w-full sm:w-auto"
                    >
                      {isSendingThread ? "送信中…" : "送信"}
                    </Button>
                    <div className="text-muted-foreground text-[10px] sm:mt-1 hidden sm:block">
                      ⌘ + Enter
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Mobile/tablet (<lg): right pane as sheet */}
            {!isLgUp && (
              <Sheet
                open={isThreadOpen}
                onOpenChange={(open) => {
                  if (!open) setThreadRootMessageId(null)
                }}
              >
                <SheetContent side="right" className="p-0">
                  <SheetTitle className="sr-only">スレッド</SheetTitle>
                  <div className="flex min-h-0 h-full flex-col">
                    <div className="border-b p-4">
                      <div className="flex items-center justify-between gap-3 align-middle">
                        <div className="align-middle">
                          <div className="text-sm font-medium">スレッド</div>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setThreadRootMessageId(null)}
                        >
                          閉じる
                        </Button>
                      </div>
                    </div>

                    <ScrollArea className="flex-1 min-h-0">
                      <div className="space-y-3 p-4">
                        {!selectedThreadRoot && (
                          <div className="text-muted-foreground text-sm">
                            右ペインに表示するスレッドを選んでください。
                          </div>
                        )}

                        {selectedThreadRoot && (
                          <>
                            <div className="rounded-lg p-3 transition-colors hover:bg-muted/50">
                              <div className="flex gap-3">
                                <RoleAvatar role="assistant" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-muted-foreground text-xs">
                                    起点（Assistant）
                                  </div>
                                  <MarkdownMessage content={selectedThreadRoot.content} />
                                </div>
                              </div>
                            </div>

                            {threadMessages.map((m) => (
                              <div
                                key={m.id}
                                className="rounded-lg p-3 transition-colors hover:bg-muted/50"
                              >
                                <div className="flex gap-3">
                                  <RoleAvatar role={m.role} />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-muted-foreground text-xs">
                                      {m.role === "user" ? "User" : "Assistant"}
                                    </div>
                                    <MarkdownMessage
                                      content={m.content}
                                      isPending={m.id.startsWith("pending-assistant-")}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}

                        <div ref={threadEndRef} />
                      </div>
                    </ScrollArea>

                    <div className="sticky bottom-0 border-t bg-background p-2">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Textarea
                          value={threadInput}
                          onChange={(e) => setThreadInput(e.target.value)}
                          placeholder="スレッドで質問する"
                          className="min-h-[44px]"
                          disabled={!selectedThreadRoot || isSendingThread}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.metaKey && !e.shiftKey) {
                              e.preventDefault()
                              void sendThread()
                            }
                          }}
                        />
                        <div className="flex flex-row items-center justify-end sm:flex-col sm:items-center">
                          <Button
                            onClick={sendThread}
                            disabled={!selectedThreadRoot || isSendingThread}
                            className="w-full sm:w-auto"
                          >
                            {isSendingThread ? "送信中…" : "送信"}
                          </Button>
                          <div className="text-muted-foreground text-[10px] sm:mt-1 hidden sm:block">
                            ⌘ + Enter
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            )}
          </>
        )}
      </div>

      {isUserMenuOpen && (
        <div className="fixed inset-0 z-50">
          <button
            className="absolute inset-0 bg-black/30"
            aria-label="閉じる"
            onClick={() => setIsUserMenuOpen(false)}
          />
          <div className="absolute left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-4 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">アカウント</div>
                {me ? (
                  <div className="text-muted-foreground mt-1 text-xs space-y-0.5">
                    {me.name && <div>name: {me.name}</div>}
                    {me.email && <div>email: {me.email}</div>}
                    {me.isAdmin && <div>role: admin</div>}
                    {!me.name && !me.email && <div>ログイン済み</div>}
                  </div>
                ) : (
                  <div className="text-muted-foreground mt-1 text-xs">未ログイン</div>
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setIsUserMenuOpen(false)}
              >
                閉じる
              </Button>
            </div>

            {me?.isAdmin && (
              <div className="mt-4 rounded-lg border bg-muted/30 p-3">
                <div className="text-sm font-medium">管理者ツール</div>
                <div className="text-muted-foreground mt-1 text-xs">
                  会話IDを入力すると、その会話を閲覧できます。
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <Input
                    value={adminConversationId}
                    onChange={(e) => setAdminConversationId(e.target.value)}
                    placeholder="会話ID（UUID）"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        if (!isAdminOpening) void openConversationByIdAsAdmin()
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => void openConversationByIdAsAdmin()}
                    disabled={isAdminOpening}
                    className="shrink-0"
                  >
                    {isAdminOpening ? "開いています…" : "開く"}
                  </Button>
                </div>
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    await api<void>("/api/auth/logout", { method: "POST" })
                  } finally {
                    window.location.href = "/login"
                  }
                }}
              >
                <LogOutIcon className="h-4 w-4" />
                ログアウト
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
