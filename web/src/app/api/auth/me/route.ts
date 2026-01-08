import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>
  const name =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof meta.user_name === "string" && meta.user_name.trim()) ||
    (typeof meta.preferred_username === "string" && meta.preferred_username.trim()) ||
    null

  return NextResponse.json({
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      name,
    },
  })
}
