"use client"

import { useSearchParams } from "next/navigation"
import { useMemo } from "react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Chrome, Github } from "lucide-react"

export function LoginClient() {
  const searchParams = useSearchParams()
  const nextPath = useMemo(() => {
    const raw = searchParams.get("next")
    if (!raw) return "/"
    // open redirect対策：アプリ内パスのみ許可
    if (!raw.startsWith("/")) return "/"
    return raw
  }, [searchParams])

  function buildRedirectTo() {
    // Client Componentでも初回はSSRされ得るため、window参照はイベント内に閉じ込める
    const u = new URL(`/auth/callback`, window.location.origin)
    u.searchParams.set("next", nextPath)
    return u.toString()
  }

  async function onLoginWithGithub() {
    const supabase = createClient()

    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: buildRedirectTo(),
      },
    })
  }

  async function onLoginWithGoogle() {
    const supabase = createClient()

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildRedirectTo(),
      },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="space-y-2 text-center">
          <div className=" text-4xl sm:text-5xl font-bold tracking-wide">CHAT_THREAD</div>
          <p className=" mt-4 text-muted-foreground text-sm">
            アカウントでログインして会話を開始します。
          </p>
        </div>
        <Button className="w-full gap-2" variant="outline" onClick={onLoginWithGoogle}>
          <Chrome className="h-4 w-4" aria-hidden />
          Googleでログイン
        </Button>
        <Button className="w-full gap-2" onClick={onLoginWithGithub}>
          <Github className="h-4 w-4" aria-hidden />
          GitHubでログイン
        </Button>
      </div>
    </div>
  )
}

