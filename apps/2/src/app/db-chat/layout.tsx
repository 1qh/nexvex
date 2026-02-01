import type { ReactNode } from 'react'

import { SidebarInset, SidebarProvider } from '@a/ui/sidebar'
import { convexAuthNextjsToken as tok } from '@convex-dev/auth/nextjs/server'
import { redirect } from 'next/navigation'

import Sidebar from './sidebar'

interface LayoutProps {
  children: ReactNode
}

const Layout = async ({ children }: LayoutProps) => {
  const token = await tok()
  if (!token) redirect('/login')
  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset className='flex h-screen flex-col'>{children}</SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
