import type { ReactNode } from 'react'

import Logout from '~/components/auth-pop'

const Layout = ({ children }: { children: ReactNode }) => (
  <div className='mx-auto max-w-3xl py-2.5'>
    <Logout className='fixed bottom-2 left-2' />
    {children}
  </div>
)

export default Layout
