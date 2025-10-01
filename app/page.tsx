// app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { Subscription } from '@supabase/gotrue-js/dist/module/lib/types'

type Post = {
  id: string
  user_id: string
  content: string
  file_path: string | null
  created_at: string
}

type PostWithSigned = Post & { signedUrl: string | null }

function toErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try { return JSON.stringify(e) } catch { return 'Unknown error' }
}

export default function Page() {
  const supabase = getSupabase()

  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [authMsg, setAuthMsg] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const [content, setContent] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [postMsg, setPostMsg] = useState<string>('')

  const [posts, setPosts] = useState<PostWithSigned[]>([])
  const [loadingList, setLoadingList] = useState<boolean>(false)

  // 認証状態監視
  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        const u = data.session?.user ?? null
        setUserEmail(u?.email ?? null)
        if (u) refreshList().catch((err: unknown) => console.error(err))
      })
      .catch((err: unknown) => console.error(err))

    const onChange = (_event: AuthChangeEvent, session: Session | null): void => {
      const u = session?.user ?? null
      setUserEmail(u?.email ?? null)
      if (u) {
        refreshList().catch((err: unknown) => console.error(err))
      } else {
        setPosts([])
      }
    }

    const subData = supabase.auth.onAuthStateChange(onChange).data
    const sub: Subscription | undefined = subData?.subscription

    return () => { if (sub) sub.unsubscribe() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ログイン
  const handleSignIn = async (): Promise<void> => {
    setAuthMsg('サインイン中...')
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      setAuthMsg(error ? 'エラー: ' + error.message : 'ログインしました')
    } catch (e: unknown) {
      console.error(e)
      setAuthMsg('通信エラー: ' + toErrorMessage(e))
    }
  }

  // ログアウト
  const handleSignOut = async (): Promise<void> => {
    await supabase.auth.signOut()
  }

  // 投稿：アップロード → posts 挿入
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    setPostMsg('保存中...')

    try {
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      if (userErr) throw new Error('認証状態取得に失敗: ' + userErr.message)
      if (!user) { setPostMsg('ログインが必要です'); return }

      const text = content.trim()
      if (!text) { setPostMsg('内容を入力してください'); return }

      let file_path: string | null = null
      if (file) {
        const path = `${user.id}/${Date.now()}-${file.name}`
        const { error: upErr } = await supabase.storage.from('uploads').upload(path, file, { upsert: false })
        if (upErr) { setPostMsg('アップロード失敗: ' + upErr.message); return }
        file_path = path
      }

      const { error: insErr } = await supabase
        .from('posts')
        .insert({ user_id: user.id, content: text, file_path })

      if (insErr) { setPostMsg('DB保存失敗: ' + insErr.message); return }

      // フォームのクリア
      setContent('')
      setFile(null)
      const f = document.getElementById('file') as HTMLInputElement | null
      if (f) f.value = ''

      setPostMsg('保存しました')
      await refreshList()
    } catch (e: unknown) {
      console.error('[submit:error]', e)
      setPostMsg('保存に失敗しました: ' + toErrorMessage(e))
    }
  }

  // 自分の投稿一覧＋署名付きURL展開
  async function refreshList(): Promise<void> {
    setLoadingList(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPosts([]); setLoadingList(false); return }

      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) throw error

      const rows: Post[] = (data ?? []) as Post[]

      const withSigned: PostWithSigned[] = await Promise.all(
        rows.map(async (row: Post): Promise<PostWithSigned> => {
          if (row.file_path) {
            const { data: signed, error: signErr } = await supabase
              .storage
              .from('uploads')
              .createSignedUrl(row.file_path, 60 * 10)
            return { ...row, signedUrl: signErr ? null : (signed?.signedUrl ?? null) }
          }
          return { ...row, signedUrl: null }
        })
      )

      setPosts(withSigned)
    } catch (e: unknown) {
      console.error('[list:error]', e)
    } finally {
      setLoadingList(false)
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: '24px auto', padding: '0 12px', fontFamily: `system-ui,-apple-system,"Segoe UI",Roboto,sans-serif` }}>
      <h1>社内ミニアプリ（Next.js + Supabase）</h1>

      {!userEmail && (
        <section style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16, margin: '12px 0' }}>
          <h2>ログイン</h2>
          <p style={{ color: '#666', fontSize: 12 }}>※サインアップ禁止。管理者招待ユーザーのみ。</p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="email" placeholder="you@company.co.jp" value={email} onChange={(e) => setEmail(e.target.value)} style={{ flex: 1, padding: 8 }} />
            <input type="password" placeholder="パスワード" value={password} onChange={(e) => setPassword(e.target.value)} style={{ flex: 1, padding: 8 }} />
            <button onClick={() => { handleSignIn().catch(console.error) }} style={{ padding: '8px 12px' }}>サインイン</button>
          </div>
          <p style={{ color: '#666', fontSize: 12 }}>{authMsg}</p>
        </section>
      )}

      {userEmail && (
        <>
          <section style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16, margin: '12px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#666', fontSize: 12 }}>ログイン中: {userEmail}</span>
              <button onClick={() => { handleSignOut().catch(console.error) }}>サインアウト</button>
            </div>

            <h2>新規投稿</h2>
            <form onSubmit={(e) => { handleSubmit(e).catch(console.error) }}>
              <div style={{ marginBottom: 8 }}>
                <input
                  type="text"
                  placeholder="メモや説明を入力"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  style={{ width: '100%', padding: 8 }}
                />
              </div>
              <div style={{ marginBottom: 8 }}>
                <input id="file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              <button type="submit">投稿する</button>
              <span style={{ marginLeft: 8, color: '#666', fontSize: 12 }}>{postMsg}</span>
            </form>
          </section>

          <section style={{ border: '1px solid #ddd', borderRadius: 10, padding: 16, margin: '12px 0' }}>
            <h2>あなたの投稿一覧</h2>
            {loadingList ? (
              <p style={{ color: '#666' }}>読み込み中...</p>
            ) : posts.length === 0 ? (
              <p>まだ投稿はありません</p>
            ) : (
              <ul style={{ paddingLeft: 18 }}>
                {posts.map((p) => (
                  <li key={p.id} style={{ marginBottom: 6 }}>
                    <strong>{p.content}</strong>{' '}
                    <span style={{ color: '#666', fontSize: 12 }}>
                      ({new Date(p.created_at).toLocaleString()})
                    </span>
                    {p.file_path && (
                      <>
                        {' '} - {p.signedUrl
                          ? <a href={p.signedUrl} target="_blank" rel="noopener noreferrer">添付を開く</a>
                          : <span>(ファイルURL取得失敗)</span>}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <button onClick={() => { refreshList().catch(console.error) }}>再読み込み</button>
          </section>
        </>
      )}
    </main>
  )
}