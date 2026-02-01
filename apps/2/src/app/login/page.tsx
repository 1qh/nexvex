'use client'

import { Button } from '@a/ui/button'
import { useAuthActions } from '@convex-dev/auth/react'
import Ic from '@svgr-iconkit/flat-color-icons'
import Link from 'next/link'

const Page = () => {
  const { signIn } = useAuthActions()
  return (
    <div className='m-auto space-y-2'>
      <Button
        className='group rounded-full pr-5! tracking-tight transition-all duration-300 hover:scale-105 hover:gap-1 hover:pl-2 active:scale-90'
        onClick={() => {
          signIn('google', { redirectTo: '/' })
        }}>
        <Ic className='size-5 transition-all duration-300 group-hover:size-6' name='google' />
        Continue with Google
      </Button>
      <Link
        className='block text-center text-sm font-light text-muted-foreground transition-all duration-300 hover:font-normal hover:text-foreground'
        href='/login/email'>
        Log in with password
      </Link>
    </div>
  )
}

export default Page
