import { createClient } from "@/lib/supabase/server"

export const ADMIN_EMAIL = "marusou20@gmail.com"

export type AuthUser = {
  id: string
  email: string | null
  isAdmin: boolean
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return email.trim().toLowerCase() === ADMIN_EMAIL
}

export async function requireUser(): Promise<AuthUser> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) {
    throw new Error("UNAUTHENTICATED")
  }
  return { id: user.id, email: user.email ?? null, isAdmin: isAdminEmail(user.email) }
}

export async function requireUserId() {
  const user = await requireUser()
  return user.id
}
