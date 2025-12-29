import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { requireUserId } from "@/lib/auth"

function buildChildrenIndex<
  T extends { id: string; parentMessageId: string | null },
>(items: T[]) {
  const byParent = new Map<string | null, T[]>()
  for (const item of items) {
    const key = item.parentMessageId
    const arr = byParent.get(key) ?? []
    arr.push(item)
    byParent.set(key, arr)
  }
  return byParent
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

    // 所有者チェック（会話が本人のものか）
    const conv = await prisma.conversation.findFirst({
      where: { id: target.conversationId, userId },
      select: { id: true },
    })
    if (!conv) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 })
    }

    // 同一会話・同一threadRoot内のメッセージだけ取得して、サーバ側でサブツリー抽出
    const all = await prisma.message.findMany({
      where: {
        conversationId: target.conversationId,
        threadRootId: target.threadRootId,
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        conversationId: true,
        parentMessageId: true,
        threadRootId: true,
        depth: true,
        role: true,
        content: true,
        createdAt: true,
      },
    })

    const byParent = buildChildrenIndex(all)
    const descendants: typeof all = []
    const stack = [...(byParent.get(target.id) ?? [])]
    while (stack.length) {
      const cur = stack.shift()!
      descendants.push(cur)
      const children = byParent.get(cur.id) ?? []
      stack.push(...children)
    }

    const root = all.find((m) => m.id === target.id)
    return NextResponse.json({ root, descendants })
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
