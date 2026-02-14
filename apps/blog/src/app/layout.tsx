import type { ReactNode } from 'react'

import AuthLayout from '@a/fe/auth-layout'
import ConvexProvider from '@a/fe/convex-provider'
import Logout from '@a/fe/user-menu'
import { headers } from 'next/headers'

const Layout = async ({ children }: { children: ReactNode }) => {
  const pathname = (await headers()).get('x-pathname') ?? '/',
    isLogin = pathname === '/login' || pathname.startsWith('/login/')

  return (
    <AuthLayout convexProvider={inner => <ConvexProvider fileApi>{inner}</ConvexProvider>}>
      {isLogin ? (
        children
      ) : (
        <div className='mx-auto max-w-3xl py-2.5'>
          <Logout className='fixed bottom-2 left-2' />
          {children}
        </div>
      )}
    </AuthLayout>
  )
}

export default Layout
