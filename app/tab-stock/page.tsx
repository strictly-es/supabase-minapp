import { Suspense } from 'react'
import TabStockClient from './TabStockClient'

export default function TabStockPage() {
  return (
    <Suspense fallback={null}>
      <TabStockClient />
    </Suspense>
  )
}
