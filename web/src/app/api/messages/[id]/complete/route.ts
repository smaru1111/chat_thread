import { NextResponse } from "next/server";

import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

type ChatMode = "thread" | "linear"

function parseChatModeFromRequest(request: Request): ChatMode {
  const url = new URL(request.url)
  const mode = url.searchParams.get("mode")
  if (mode === "linear") return "linear"
  return "thread"
}

async function buildThreadContextForOpenAI(
  messageId: string
): Promise<ChatMessage[]> {
  // /context の仕様を簡易的に再実装（必要なら後で共通化）
  const target = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, threadRootId: true },
  })
  if (!target) return []

  const root = await prisma.message.findUnique({
    where: { id: target.threadRootId },
    select: { id: true, createdAt: true },
  })
  if (!root) return []

  const rootsUpToK = await prisma.message.findMany({
    where: {
      conversationId: target.conversationId,
      parentMessageId: null,
      createdAt: { lte: root.createdAt },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, parentMessageId: true },
  })

  // 祖先チェーン（DBを辿る）
  const chain: Array<{
    id: string
    role: string
    content: string
    parentMessageId: string | null
  }> = []
  let cur = await prisma.message.findUnique({
    where: { id: target.id },
    select: { id: true, role: true, content: true, parentMessageId: true },
  })
  while (cur) {
    chain.push(cur)
    if (!cur.parentMessageId) break
    cur = await prisma.message.findUnique({
      where: { id: cur.parentMessageId },
      select: { id: true, role: true, content: true, parentMessageId: true },
    })
  }
  chain.reverse()

  const messages: ChatMessage[] = []
  for (const r of rootsUpToK) {
    messages.push({ role: r.role as ChatMessage["role"], content: r.content })
  }
  for (const m of chain) {
    if (m.id === target.threadRootId) continue
    messages.push({ role: m.role as ChatMessage["role"], content: m.content })
  }
  return messages
}

async function buildLinearContextForOpenAI(
  messageId: string
): Promise<ChatMessage[]> {
  const target = await prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true, createdAt: true },
  })
  if (!target) return []

  const items = await prisma.message.findMany({
    where: {
      conversationId: target.conversationId,
      createdAt: { lte: target.createdAt },
    },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  })

  return items.map((m) => ({
    role: m.role as ChatMessage["role"],
    content: m.content,
  }))
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId()
    const { id: messageId } = await params
    const mode = parseChatModeFromRequest(request)

    const target = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true },
    })
    if (!target) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    const conv = await prisma.conversation.findFirst({
      where: { id: target.conversationId, userId },
      select: { id: true },
    })
    if (!conv) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    const openaiKey = process.env.OPENAI_API_KEY?.trim()
    let assistantText = "（ダミー返信）"
    let openaiWarning: { status?: number; details?: string } | null = null

    if (openaiKey) {
      try {
        const context =
          mode === "linear"
            ? await buildLinearContextForOpenAI(messageId)
            : await buildThreadContextForOpenAI(messageId)
        // system は後で docs に合わせて調整
        const payload = {
          model: "gpt-4o-mini",
          messages: context,
        }

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const t = await res.text().catch(() => "")
          const requestId = res.headers.get("x-request-id") ?? undefined
          openaiWarning = {
            status: res.status,
            details: `request_id=${requestId ?? "n/a"} body=${t.slice(0, 500)}`,
          }
          console.error("[openai] non-2xx", {
            status: res.status,
            requestId,
            body: t.slice(0, 2000),
          })
          assistantText = "（OpenAIエラーのためダミー返信）"
        } else {
          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>
          }
          assistantText = json.choices?.[0]?.message?.content?.trim() || ""
          if (!assistantText) assistantText = "（空の返信）"
        }
      } catch (err) {
        openaiWarning = {
          details:
            err instanceof Error ? (err.stack ?? err.message) : String(err),
        }
        console.error("[openai] exception", err)
        assistantText = "（OpenAI呼び出し失敗のためダミー返信）"
      }
    }

    // assistant メッセージを「対象メッセージ」の子として保存
    const parent = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        conversationId: true,
        threadRootId: true,
        depth: true,
      },
    })
    if (!parent) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    const created = await prisma.message.create({
      data: {
        conversationId: parent.conversationId,
        userId: null,
        parentMessageId: parent.id,
        threadRootId: parent.threadRootId,
        depth: parent.depth + 1,
        role: "assistant",
        content: assistantText,
        metadata: openaiWarning ? { openaiWarning } : undefined,
      },
      select: {
        id: true,
        conversationId: true,
        parentMessageId: true,
        threadRootId: true,
        depth: true,
        role: true,
        content: true,
        createdAt: true,
        metadata: true,
      },
    })

    // 会話一覧のupdatedAtを更新したいが、Message作成で自動更新されないため手動更新
    await prisma.conversation.update({
      where: { id: parent.conversationId },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
