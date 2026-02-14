import type { ReactNode } from 'react'

import AuthLayout from '@a/fe/auth-layout'
import ConvexProvider from '@a/fe/convex-provider'
import { SidebarInset, SidebarProvider } from '@a/ui/sidebar'
import { isAuthenticated } from 'lazyconvex/next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

import Sidebar from './sidebar'

const PUBLIC_PATHS = ['/login', '/public']

const isPublicPath = (pathname: string) => {
  for (const p of PUBLIC_PATHS) if (pathname === p || pathname.startsWith(`${p}/`)) return true
  return false
}

const Layout = async ({ children }: { children: ReactNode }) => {
  const pathname = (await headers()).get('x-pathname') ?? '/'

  if (!(isPublicPath(pathname) || (await isAuthenticated()))) redirect('/login')

  const showSidebar = !isPublicPath(pathname)

  return (
    <AuthLayout convexProvider={inner => <ConvexProvider>{inner}</ConvexProvider>}>
      {showSidebar ? (
        <SidebarProvider>
          <Sidebar />
          <SidebarInset className='flex h-screen flex-col'>{children}</SidebarInset>
        </SidebarProvider>
      ) : (
        children
      )}
    </AuthLayout>
  )
}

export default Layout
