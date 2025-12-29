"use client"

import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"

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

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`${res.status}`)
  return (await res.json()) as T
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

export function AppShell() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null)
  const [messages, setMessages] = useState<Message[]>([])

  const [newTitle, setNewTitle] = useState("")
  const [mainInput, setMainInput] = useState("")

  const [threadRootMessageId, setThreadRootMessageId] = useState<string | null>(
    null
  )
  const [threadInput, setThreadInput] = useState("")

  useEffect(() => {
    api<{ items: Conversation[] }>("/api/conversations")
      .then((d) => {
        setConversations(d.items)
        if (!selectedConversationId && d.items[0]) {
          setSelectedConversationId(d.items[0].id)
        }
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedConversationId) return
    api<{ items: Message[] }>(
      `/api/conversations/${selectedConversationId}/messages`
    )
      .then((d) => setMessages(d.items))
      .catch(() => setMessages([]))
  }, [selectedConversationId])

  const byId = useMemo(() => buildById(messages), [messages])
  const children = useMemo(() => buildChildren(messages), [messages])

  const mainRoots = useMemo(() => {
    // UIの「メイン」は root(user) + その直下のassistant を並べる
    const roots = (children.get(null) ?? []).filter((m) => m.role === "user")
    return roots
  }, [children])

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
    const d = await api<{ items: Conversation[] }>("/api/conversations")
    setConversations(d.items)
  }

  async function refreshMessages() {
    if (!selectedConversationId) return
    const d = await api<{ items: Message[] }>(
      `/api/conversations/${selectedConversationId}/messages`
    )
    setMessages(d.items)
  }

  async function createConversation() {
    const title = newTitle.trim() || null
    const created = await api<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ title }),
    })
    setNewTitle("")
    await refreshConversations()
    setSelectedConversationId(created.id)
  }

  async function sendMain() {
    if (!selectedConversationId) return
    const content = mainInput.trim()
    if (!content) return

    setMainInput("")
    const userMsg = await api<Message>("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        conversationId: selectedConversationId,
        parentMessageId: null,
        role: "user",
        content,
      }),
    })

    await api<Message>(`/api/messages/${userMsg.id}/complete`, {
      method: "POST",
    })
    await refreshConversations()
    await refreshMessages()
  }

  async function sendThread() {
    if (!selectedConversationId || !selectedThreadRoot) return
    const content = threadInput.trim()
    if (!content) return
    setThreadInput("")

    // スレッドは「最後のメッセージ」にぶら下げる（Slack風の線形）
    const last =
      threadMessages.length > 0
        ? threadMessages[threadMessages.length - 1]
        : null
    const parentMessageId = last?.id ?? selectedThreadRoot.id

    const userMsg = await api<Message>("/api/messages", {
      method: "POST",
      body: JSON.stringify({
        conversationId: selectedConversationId,
        parentMessageId,
        role: "user",
        content,
      }),
    })

    await api<Message>(`/api/messages/${userMsg.id}/complete`, {
      method: "POST",
    })
    await refreshConversations()
    await refreshMessages()
  }

  return (
    <div className="h-screen">
      <div className="grid h-full grid-cols-[260px_1fr_420px]">
        <aside className="border-r p-3">
          <div className="mb-3 flex items-center gap-2">
            <Input
              placeholder="新規セッション（任意）"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <Button size="sm" variant="secondary" onClick={createConversation}>
              作成
            </Button>
          </div>
          <ScrollArea className="h-[calc(100vh-88px)]">
            <div className="space-y-1">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  className={[
                    "w-full rounded-md px-2 py-2 text-left text-sm",
                    selectedConversationId === c.id
                      ? "bg-muted"
                      : "hover:bg-muted/50",
                  ].join(" ")}
                  onClick={() => {
                    setSelectedConversationId(c.id)
                    setThreadRootMessageId(null)
                  }}
                >
                  <div className="truncate font-medium">
                    {c.title || "Untitled"}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {new Date(c.updatedAt).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </aside>

        <main className="flex min-w-0 flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-6 p-4">
              {mainRoots.map((root) => {
                const ai =
                  (children.get(root.id) ?? []).find(
                    (m) => m.role === "assistant"
                  ) ?? null
                return (
                  <div key={root.id} className="space-y-2">
                    <div className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs">User</div>
                      <div className="whitespace-pre-wrap">{root.content}</div>
                    </div>

                    {ai && (
                      <div className="group rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-muted-foreground text-xs">
                              Assistant
                            </div>
                            <div className="break-words whitespace-pre-wrap">
                              {ai.content}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="opacity-0 transition-opacity group-hover:opacity-100"
                            onClick={() => setThreadRootMessageId(ai.id)}
                          >
                            スレッドで質問
                          </Button>
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
            </div>
          </ScrollArea>

          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={mainInput}
                onChange={(e) => setMainInput(e.target.value)}
                placeholder="メインで質問する"
                className="min-h-[44px]"
              />
              <Button onClick={sendMain}>送信</Button>
            </div>
          </div>
        </main>

        <aside className="flex min-w-0 flex-col border-l">
          <div className="border-b p-4">
            <div className="text-sm font-medium">スレッド</div>
            <div className="text-muted-foreground mt-1 text-xs">
              AIメッセージの「スレッドで質問」から開きます
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="space-y-3 p-4">
              {!selectedThreadRoot && (
                <div className="text-muted-foreground text-sm">
                  右ペインに表示するスレッドを選んでください。
                </div>
              )}

              {selectedThreadRoot && (
                <>
                  <div className="rounded-lg border p-3">
                    <div className="text-muted-foreground text-xs">
                      起点（Assistant）
                    </div>
                    <div className="break-words whitespace-pre-wrap">
                      {selectedThreadRoot.content}
                    </div>
                  </div>

                  {threadMessages.map((m) => (
                    <div key={m.id} className="rounded-lg border p-3">
                      <div className="text-muted-foreground text-xs">
                        {m.role === "user" ? "User" : "Assistant"}
                      </div>
                      <div className="break-words whitespace-pre-wrap">
                        {m.content}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </ScrollArea>

          <div className="border-t p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={threadInput}
                onChange={(e) => setThreadInput(e.target.value)}
                placeholder="スレッドで質問する"
                className="min-h-[44px]"
                disabled={!selectedThreadRoot}
              />
              <Button onClick={sendThread} disabled={!selectedThreadRoot}>
                送信
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
