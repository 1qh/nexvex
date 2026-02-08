import type { ReactNode } from 'react'

import { SidebarInset, SidebarProvider } from '@a/ui/sidebar'
import { redirect } from 'next/navigation'

import { isAuthenticated } from '~/auth'

import Sidebar from './sidebar'

interface LayoutProps {
  children: ReactNode
}

const Layout = async ({ children }: LayoutProps) => {
  if (!(await isAuthenticated())) redirect('/login')
  return (
    <SidebarProvider>
      <Sidebar />
      <SidebarInset className='flex h-screen flex-col'>{children}</SidebarInset>
    </SidebarProvider>
  )
}

export default Layout
