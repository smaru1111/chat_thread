import { Suspense } from "react"

import { LoginClient } from "./login-client"

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-4">
            <div className="space-y-2 text-center">
              <div className="text-4xl sm:text-5xl font-bold tracking-wide">CHAT_THREAD</div>
              <p className="mt-4 text-muted-foreground text-sm">読み込み中…</p>
            </div>
          </div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  )
}
