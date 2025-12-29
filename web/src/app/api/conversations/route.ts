import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { requireUserId } from "@/lib/auth"

export async function GET() {
  try {
    const userId = await requireUserId()
    const items = await prisma.conversation.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json({ items })
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireUserId()
    const body = (await request.json().catch(() => ({}))) as { title?: string }

    const conversation = await prisma.conversation.create({
      data: { userId, title: body.title ?? null },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    })
    return NextResponse.json(conversation, { status: 201 })
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
