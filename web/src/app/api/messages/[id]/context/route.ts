import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { requireUserId } from "@/lib/auth"

async function getAncestorChain(messageId: string) {
  const chain: Array<{
    id: string
    role: string
    content: string
    createdAt: Date
    parentMessageId: string | null
    depth: number
  }> = []

  let cur = await prisma.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
      parentMessageId: true,
      depth: true,
    },
  })

  while (cur) {
    chain.push(cur)
    if (!cur.parentMessageId) break
    cur = await prisma.message.findUnique({
      where: { id: cur.parentMessageId },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
        parentMessageId: true,
        depth: true,
      },
    })
  }

  return chain.reverse()
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await requireUserId()
    const { id: messageId } = await params

    const target = await prisma.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true, threadRootId: true },
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

    const root = await prisma.message.findUnique({
      where: { id: target.threadRootId },
      select: { id: true, createdAt: true },
    })
    if (!root) {
      return NextResponse.json(
        { error: "THREAD_ROOT_NOT_FOUND" },
        { status: 500 }
      )
    }

    // R1..Rk（0階層目で、Rkの作成日時以前）
    const rootsUpToK = await prisma.message.findMany({
      where: {
        conversationId: target.conversationId,
        parentMessageId: null,
        createdAt: { lte: root.createdAt },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        content: true,
        createdAt: true,
      },
    })

    // [Rk..m] の祖先チェーン
    const chain = await getAncestorChain(target.id)

    // [R1..Rk] + [a1..m]（Rk重複なし）
    const rKId = target.threadRootId
    const a1ToM = chain
      .filter((m) => m.id !== rKId)
      .map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      }))

    const messages = [...rootsUpToK, ...a1ToM]

    return NextResponse.json({ messages })
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
