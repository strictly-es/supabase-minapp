'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabaseClient'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

type Props = { children: React.ReactNode }

export default function RequireAuth({ children }: Props) {
  const supabase = getSupabase()
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    let mounted = true
    async function run() {
      try {
        const { data } = await supabase.auth.getSession()
        const ok = !!data.session?.user
        if (!mounted) return
        if (!ok) {
          router.replace('/')
        } else {
          setAuthed(true)
        }
      } finally {
        if (mounted) setReady(true)
      }
    }
    run()
    const onChange = (_event: AuthChangeEvent, session: Session | null) => {
      if (!session?.user) router.replace('/')
      else setAuthed(true)
    }
    const { data: listener } = supabase.auth.onAuthStateChange(onChange)
    return () => { mounted = false; listener?.subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready || !authed) return null
  return <>{children}</>
}

