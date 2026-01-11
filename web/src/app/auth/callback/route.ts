import { createServerClient } from "@supabase/ssr"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

import { prisma } from "@/lib/db"

function safeNextPath(raw: string | null) {
  if (!raw) return "/"
  if (!raw.startsWith("/")) return "/"
  return raw
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const origin = url.origin
  const next = safeNextPath(url.searchParams.get("next"))

  if (!code) {
    return NextResponse.redirect(
      `${origin}/login?error=missing_code&next=${encodeURIComponent(next)}`
    )
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(
      `${origin}/login?error=missing_env&next=${encodeURIComponent(next)}`
    )
  }

  const response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name) {
        return request.cookies.get(name)?.value
      },
      set(name, value, options) {
        response.cookies.set({ name, value, ...options })
      },
      remove(name, options) {
        response.cookies.set({ name, value: "", ...options })
      },
    },
  })

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=oauth_exchange_failed&next=${encodeURIComponent(next)}`
    )
  }

  // セッション確立後にユーザー情報を取得し、アプリ側DBへ同期（idは auth.users.id と同一）
  const { data: userData } = await supabase.auth.getUser()
  const user = userData.user
  if (user) {
    const md = (user.user_metadata ?? {}) as Record<string, unknown>
    const displayName =
      (md["name"] as string | undefined) ??
      (md["full_name"] as string | undefined) ??
      null
    const githubUsername =
      (md["user_name"] as string | undefined) ??
      (md["preferred_username"] as string | undefined) ??
      (md["username"] as string | undefined) ??
      null

    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        displayName,
        email: user.email ?? null,
        githubUsername,
      },
      update: {
        displayName,
        email: user.email ?? null,
        githubUsername,
      },
    })
  }

  return response
}
