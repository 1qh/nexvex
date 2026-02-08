import '@a/ui/globals.css'
import type { ReactNode } from 'react'

import { Toaster } from '@a/ui/sonner'
import { ConvexAuthNextjsServerProvider as AuthProvider } from '@convex-dev/auth/nextjs/server'
import { NavigationGuardProvider } from 'next-navigation-guard'
import { ThemeProvider } from 'next-themes'
import { Suspense } from 'react'

import OfflineIndicator from '../components/offline-indicator'
import ErrorBoundary from '../error-boundary'
import PostHogProvider from '../posthog'
import ConvexProvider from './convex-provider'

const Wrapper = ({ children }: LayoutProps) => (
  <html lang='en' suppressHydrationWarning>
    <body className='min-h-screen bg-background font-sans tracking-tight text-foreground antialiased'>
      <PostHogProvider>
        <ErrorBoundary>
          <AuthProvider>
            <ConvexProvider>
              <ThemeProvider attribute='class' defaultTheme='system' enableSystem>
                <NavigationGuardProvider>{children}</NavigationGuardProvider>
              </ThemeProvider>
              <Toaster duration={1000} />
              <OfflineIndicator />
            </ConvexProvider>
          </AuthProvider>
        </ErrorBoundary>
      </PostHogProvider>
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
