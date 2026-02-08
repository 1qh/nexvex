/* oxlint-disable promise/prefer-await-to-then */
'use client'

import type { Id } from '@a/cv/model'

import { api } from '@a/cv'
import { Button } from '@a/ui/button'
import { Skeleton } from '@a/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@a/ui/table'
import { useMutation } from 'convex/react'
import { Copy, Trash } from 'lucide-react'
import { toast } from 'sonner'

import RoleBadge from '~/components/role-badge'
import { useOrgQuery } from '~/hook/use-org'
import { fail } from '~/utils'

const formatExpiry = (expiresAt: number) => {
    const days = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
    if (days <= 0) return 'Expired'
    if (days === 1) return '1 day left'
    return `${days} days left`
  },
  PendingInvites = () => {
    const invites = useOrgQuery(api.org.pendingInvites),
      revokeInvite = useMutation(api.org.revokeInvite)

    if (invites === undefined) return <Skeleton className='h-20 w-full' />
    if (invites.length === 0) return null

    const handleCopy = (token: string) => {
        const url = `${window.location.origin}/org/invite/${token}`
        navigator.clipboard
          .writeText(url)
          .then(() => toast.success('Invite link copied'))
          .catch(() => toast.error('Failed to copy'))
      },
      handleRevoke = (inviteId: Id<'orgInvite'>) => {
        revokeInvite({ inviteId })
          .then(() => toast.success('Invite revoked'))
          .catch(fail)
      }

    return (
      <div className='space-y-2'>
        <h3 className='font-medium'>Pending Invites</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className='w-20' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invites.map(i => (
              <TableRow key={i._id}>
                <TableCell>{i.email}</TableCell>
                <TableCell>
                  <RoleBadge role={i.isAdmin ? 'admin' : 'member'} />
                </TableCell>
                <TableCell className='text-sm text-muted-foreground'>{formatExpiry(i.expiresAt)}</TableCell>
                <TableCell className='flex gap-1'>
                  <Button onClick={() => handleCopy(i.token)} size='icon' variant='ghost'>
                    <Copy className='size-4' />
                  </Button>
                  <Button onClick={() => handleRevoke(i._id)} size='icon' variant='ghost'>
                    <Trash className='size-4' />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

export default PendingInvites
