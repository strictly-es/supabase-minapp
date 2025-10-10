// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

export default function Page() {
  const supabase = getSupabase()
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [authMsg, setAuthMsg] = useState<string>('')

  function toErrorMessage(e: unknown): string {
    if (e instanceof Error) return e.message
    if (typeof e === 'string') return e
    try { return JSON.stringify(e) } catch { return 'Unknown error' }
  }

  // 認証済みなら一覧（カード）へリダイレクト
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        const u = data.session?.user ?? null
        if (u) window.location.href = '/sample/pattern_2_list/tab-list'
      })
      .catch(() => {})

    const onChange = (_event: AuthChangeEvent, session: Session | null): void => {
      if (session?.user) window.location.href = '/sample/pattern_2_list/tab-list'
    }
    const { data: listener } = supabase.auth.onAuthStateChange(onChange)
    return () => { listener?.subscription.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleSignIn() {
    setAuthMsg('サインイン中...')
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        setAuthMsg('エラー: ' + error.message)
      } else {
        setAuthMsg('ログインしました')
        window.location.href = '/sample/pattern_2_list/tab-list'
      }
    } catch (e: unknown) {
      setAuthMsg('通信エラー: ' + toErrorMessage(e))
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '24px auto', padding: '0 12px', fontFamily: `system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif` }}>
      <h1>社内ミニアプリ（Next.js + Supabase）</h1>
      <section style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16, margin: '12px 0' }}>
        <h2>ログイン</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="email"
            placeholder="you@company.co.jp"
            value={email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <input
            type="password"
            placeholder="パスワード"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={() => { handleSignIn().catch(console.error) }} style={{ padding: '8px 12px' }}>
            サインイン
          </button>
        </div>
        <p style={{ color: '#666', fontSize: 12 }}>{authMsg}</p>
      </section>
    </main>
  )
}
