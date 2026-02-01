import '@a/ui/globals.css'
import type { ReactNode } from 'react'

import { Toaster } from '@a/ui/sonner'
import { ConvexAuthNextjsServerProvider as AuthProvider } from '@convex-dev/auth/nextjs/server'
import { NavigationGuardProvider } from 'next-navigation-guard'
import { ThemeProvider } from 'next-themes'
import { Suspense } from 'react'

import ConvexProvider from './convex-provider'

const Wrapper = ({ children }: LayoutProps) => (
  <html lang='en' suppressHydrationWarning>
    <body className='min-h-screen bg-background font-sans tracking-tight text-foreground antialiased'>
      <AuthProvider>
        <ConvexProvider>
          <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
            <NavigationGuardProvider>{children}</NavigationGuardProvider>
          </ThemeProvider>
          <Toaster />
        </ConvexProvider>
      </AuthProvider>
    </body>
  </html>
)

interface LayoutProps {
  children: ReactNode
}

const Layout = ({ children }: LayoutProps) => (
  <Suspense>
    <Wrapper>{children}</Wrapper>
  </Suspense>
)

export default Layout
