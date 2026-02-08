'use client'

import { Badge } from '@a/ui/badge'
import { Button } from '@a/ui/button'
import Link from 'next/link'

interface Props {
  backHref: string
  backLabel: string
  canAccess: boolean
  children: React.ReactNode
  resource: string
}

// eslint-disable-next-line @typescript-eslint/promise-function-async
const PermissionGuard = ({ backHref, backLabel, canAccess, children, resource }: Props) => {
  if (!canAccess)
    return (
      <div className='flex flex-col items-center gap-4 py-12'>
        <Badge variant='secondary'>View only</Badge>
        <p className='text-muted-foreground'>You don&apos;t have edit permission for this {resource}.</p>
        <Button asChild variant='outline'>
          <Link href={backHref}>Back to {backLabel}</Link>
        </Button>
      </div>
    )
  return children
}

export default PermissionGuard
