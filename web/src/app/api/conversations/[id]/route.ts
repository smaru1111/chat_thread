import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"
import { requireUser } from "@/lib/auth"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params

    const conversation = await prisma.conversation.findFirst({
      where: user.isAdmin ? { id } : { id, userId: user.id },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    return NextResponse.json(conversation)
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params

    const conversation = await prisma.conversation.findFirst({
      // 削除は従来通り「所有者のみ」（管理者でも他人の会話は削除させない）
      where: { id, userId: user.id },
      select: { id: true },
    })
    if (!conversation) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }

    await prisma.conversation.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof Error && e.message === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 })
    }
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 })
  }
}
