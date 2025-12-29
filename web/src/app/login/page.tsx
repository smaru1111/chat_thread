"use client"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

export default function LoginPage() {
  async function onLogin() {
    const supabase = createClient()

    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">ログイン</h1>
          <p className="text-muted-foreground text-sm">
            GitHubでログインして会話を開始します。
          </p>
        </div>
        <Button className="w-full" onClick={onLogin}>
          GitHubでログイン
        </Button>
      </div>
    </div>
  )
}
