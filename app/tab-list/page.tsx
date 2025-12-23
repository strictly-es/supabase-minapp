import { Suspense } from 'react'
import TabListClient from './TabListClient'

export default function TabListPage() {
  return (
    <Suspense fallback={null}>
      <TabListClient />
    </Suspense>
  )
}
