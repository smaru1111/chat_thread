import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { requireUser } from "@/lib/auth"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id: conversationId } = await params

    const conv = await prisma.conversation.findFirst({
      where: user.isAdmin ? { id: conversationId } : { id: conversationId, userId: user.id },
      select: { id: true },
    })
    if (!conv) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    const items = await prisma.message.findMany({
      where: { conversationId },
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

    return NextResponse.json({ items })
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
