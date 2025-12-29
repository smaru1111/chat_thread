import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { requireUserId } from "@/lib/auth"

type CreateMessageBody = {
  conversationId: string
  parentMessageId?: string | null
  role: "user" | "assistant"
  content: string
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = (await request.json()) as CreateMessageBody

    if (!body?.conversationId || !body.role || !body.content) {
      return NextResponse.json({ error: "VALIDATION_ERROR" }, { status: 400 })
    }

    const conv = await prisma.conversation.findFirst({
      where: { id: body.conversationId, userId },
      select: { id: true },
    })
    if (!conv) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    const parentMessageId =
      body.parentMessageId === undefined ? null : body.parentMessageId

    // 0階層目: parent=null → threadRootId は自分自身、depth=0
    if (!parentMessageId) {
      const id = crypto.randomUUID()
      const created = await prisma.message.create({
        data: {
          id,
          conversationId: body.conversationId,
          userId: body.role === "assistant" ? null : userId,
          parentMessageId: null,
          threadRootId: id,
          depth: 0,
          role: body.role,
          content: body.content,
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
        },
      })
      return NextResponse.json(created, { status: 201 })
    }

    // 子メッセージ: 親のthreadRootIdを継承、depthは親+1
    const parent = await prisma.message.findFirst({
      where: { id: parentMessageId, conversationId: body.conversationId },
      select: { id: true, threadRootId: true, depth: true },
    })
    if (!parent) {
      return NextResponse.json({ error: "PARENT_NOT_FOUND" }, { status: 404 })
    }

    const created = await prisma.message.create({
      data: {
        conversationId: body.conversationId,
        userId: body.role === "assistant" ? null : userId,
        parentMessageId: parent.id,
        threadRootId: parent.threadRootId,
        depth: parent.depth + 1,
        role: body.role,
        content: body.content,
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
      },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
