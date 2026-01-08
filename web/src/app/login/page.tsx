"use client"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { Chrome, Github } from "lucide-react"

export default function LoginPage() {
  async function onLoginWithGithub() {
    const supabase = createClient()

    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  async function onLoginWithGoogle() {
    const supabase = createClient()

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
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
