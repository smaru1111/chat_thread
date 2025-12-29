import { redirect } from "next/navigation"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    redirect("/login")
  }

  return (
    <div className="h-screen">
      <div className="grid h-full grid-cols-[260px_1fr_420px]">
        <aside className="border-r p-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-medium">セッション</div>
            <Button size="sm" variant="secondary">
              新規
            </Button>
          </div>
          <div className="text-muted-foreground text-sm">
            （ここにセッション一覧が入ります）
          </div>
        </aside>

        <main className="p-4">
          <div className="text-muted-foreground mb-4 text-sm">
            メイン（0階層目）：ユーザー → AI の1ターンが縦に並びます
          </div>
          <div className="space-y-6">
            <div className="rounded-lg border p-3">
              <div className="text-muted-foreground text-xs">User</div>
              <div>質問テキスト（例）</div>
            </div>
            <div className="group rounded-lg border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-muted-foreground text-xs">Assistant</div>
                  <div className="break-words">AIの回答テキスト（例）</div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  スレッドで質問
                </Button>
              </div>
            </div>
          </div>
        </main>

        <aside className="border-l p-4">
          <div className="text-sm font-medium">スレッド</div>
          <div className="text-muted-foreground mt-2 text-sm">
            AIメッセージの「スレッドで質問」から開きます
          </div>
        </aside>
      </div>
    </div>
  )
}
