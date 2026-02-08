import type { ReactNode } from 'react'

const Layout = ({ children }: { children: ReactNode }) => (
  <div className='flex h-screen w-screen items-center justify-center'>{children}</div>
)

export default Layout
