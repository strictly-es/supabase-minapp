'use client'

import { useEffect, useState } from 'react'

export function useClientSearchParams(): URLSearchParams | null {
  const [params, setParams] = useState<URLSearchParams | null>(null)

  useEffect(() => {
    function sync() {
      setParams(new URLSearchParams(window.location.search))
    }

    sync()
    window.addEventListener('popstate', sync)
    return () => { window.removeEventListener('popstate', sync) }
  }, [])

  return params
}
