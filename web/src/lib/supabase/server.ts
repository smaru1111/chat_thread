import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
  }

  // Next.js（現行）では cookies() が Promise を返す
  const cookieStore = await cookies()

  return createServerClient(url, anonKey, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value
      },
      set(name, value, options) {
        // Server Components から呼ばれた場合、cookies の書き込みが禁止されているため例外になることがある
        // Route Handlers / Server Actions では書き込み可能
        try {
          cookieStore.set({ name, value, ...options })
        } catch {}
      },
      remove(name, options) {
        try {
          cookieStore.set({ name, value: "", ...options })
        } catch {}
      },
    },
  })
}
