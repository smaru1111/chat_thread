import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    return NextResponse.json({ user: null }, { status: 401 })
  }

  return NextResponse.json({ user: { id: data.user.id } })
}
