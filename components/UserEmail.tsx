'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export default function UserEmail() {
  const supabase = getSupabase()
  const [email, setEmail] = useState<string>('')

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (error) return
        const em = data.user?.email || ''
        if (mounted) setEmail(em)
      } catch {
        // ignore
      }
    }
    run()
    const onChange = (_event: AuthChangeEvent, session: Session | null) => {
      const em = session?.user?.email || ''
      if (mounted) setEmail(em)
    }
    const { data: listener } = supabase.auth.onAuthStateChange(onChange)
    return () => { mounted = false; listener?.subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!email) return null
  return <span className="text-gray-600">ログイン中: {email}</span>
}

