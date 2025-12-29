import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { AppShell } from "@/app/app-shell"

export default async function Home() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()

  if (!data.user) {
    redirect("/login")
  }

  return <AppShell />
}
