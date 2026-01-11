import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/app/app-shell"

function pickFirst(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}

function buildQueryString(
  searchParams: Record<string, string | string[] | undefined> | undefined
) {
  if (!searchParams) return ""
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    const first = pickFirst(v)
    if (first === undefined) continue
    sp.set(k, first)
  }
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = searchParams ? await searchParams : undefined
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    const next = `/${buildQueryString(sp)}`
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  return <AppShell />
}
