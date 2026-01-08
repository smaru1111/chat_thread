import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { requireUserId } from "@/lib/auth"

type ChatMessage = { role: "system" | "user" | "assistant"; content: string }

function fallbackTitleFromText(text: string) {
  const s = text.replace(/\s+/g, " ").trim()
  if (!s) return "Untitled"
  return s.length <= 30 ? s : `${s.slice(0, 30)}…`
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId()
    const { id: conversationId } = await params

    const conv = await prisma.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true, title: true },
    })
    if (!conv) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    // すでにタイトルがある場合はそのまま返す（上書きしない）
    if (conv.title && conv.title.trim()) {
      return NextResponse.json({ title: conv.title })
    }

    const msgs = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: { role: true, content: true, parentMessageId: true },
    })

    const firstUser = msgs.find((m) => m.role === "user" && m.parentMessageId === null)
    const fallback = fallbackTitleFromText(firstUser?.content ?? msgs[0]?.content ?? "")

    const openaiKey = process.env.OPENAI_API_KEY?.trim()
    let title = fallback

    if (openaiKey && msgs.length > 0) {
      const context: ChatMessage[] = [
        {
          role: "system",
          content:
            "あなたは会話のタイトルを作るアシスタントです。会話の内容から短い日本語タイトルを作ってください。出力はタイトル文字列のみ。20文字以内。句点や引用符は不要。",
        },
        ...msgs.map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as ChatMessage["role"],
          content: m.content,
        })),
      ]

      try {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: "gpt-4o-mini", messages: context }),
        })

        if (res.ok) {
          const json = (await res.json()) as {
            choices?: Array<{ message?: { content?: string } }>
          }
          const t = json.choices?.[0]?.message?.content?.trim() ?? ""
          if (t) title = t.replace(/^["「]|["」]$/g, "").trim().slice(0, 40)
        }
      } catch {
        // fallbackのまま
      }
    }

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title },
      select: { id: true },
    })

    return NextResponse.json({ title })
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

