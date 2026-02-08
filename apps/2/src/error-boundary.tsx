/* eslint-disable @typescript-eslint/explicit-member-accessibility */
'use client'

import type { ReactNode } from 'react'

import { posthog } from 'posthog-js'
import { Component } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}
interface ErrorBoundaryState {
  error?: Error
  hasError: boolean
}
// eslint-disable-next-line react/require-optimization
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // eslint-disable-next-line react/sort-comp
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, hasError: true }
  }
  // eslint-disable-next-line @typescript-eslint/class-methods-use-this
  componentDidCatch(error: Error, errorInfo: { componentStack: string }) {
    if (typeof window !== 'undefined')
      posthog.capture('error', {
        componentStack: errorInfo.componentStack,
        error: error.message,
        stack: error.stack
      })
  }
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  render() {
    const { hasError } = this.state,
      { children, fallback } = this.props
    if (hasError)
      return (
        fallback ?? (
          <div className='flex min-h-screen items-center justify-center'>
            <div className='text-center'>
              <h1 className='mb-2 text-2xl font-bold'>Something went wrong</h1>
              <p className='text-muted-foreground'>Please refresh the page</p>
            </div>
          </div>
        )
      )
    return children
  }
}

export default ErrorBoundary
