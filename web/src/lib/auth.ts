import { createClient } from "@/lib/supabase/server"

export async function requireUserId() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) {
    throw new Error("UNAUTHENTICATED")
  }
  return user.id
}
