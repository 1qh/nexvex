/* oxlint-disable promise/prefer-await-to-then */
'use client'

import type { Id } from '@a/cv/model'

import { api } from '@a/cv'
import { Avatar, AvatarFallback, AvatarImage } from '@a/ui/avatar'
import { Button } from '@a/ui/button'
import { Skeleton } from '@a/ui/skeleton'
import { Switch } from '@a/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@a/ui/table'
import { useMutation } from 'convex/react'
import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { useOrgQuery } from '~/hook/use-org'
import { fail } from '~/utils'

const formatDate = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleDateString()
  },
  JoinRequests = () => {
    const requests = useOrgQuery(api.org.pendingJoinRequests),
      approveRequest = useMutation(api.org.approveJoinRequest),
      rejectRequest = useMutation(api.org.rejectJoinRequest),
      [asAdmin, setAsAdmin] = useState<Record<string, boolean>>({})

    if (requests === undefined) return <Skeleton className='h-20 w-full' />
    if (requests.length === 0) return null

    const handleApprove = (requestId: Id<'orgJoinRequest'>, isAdmin: boolean) => {
        approveRequest({ isAdmin, requestId })
          .then(() => toast.success('Request approved'))
          .catch(fail)
      },
      handleReject = (requestId: Id<'orgJoinRequest'>) => {
        rejectRequest({ requestId })
          .then(() => toast.success('Request rejected'))
          .catch(fail)
      }

    return (
      <div className='space-y-2'>
        <h3 className='font-medium'>Join Requests</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead>As Admin</TableHead>
              <TableHead className='w-20' />
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map(({ request: r, user: u }) => (
              <TableRow key={r._id}>
                <TableCell className='flex items-center gap-2'>
                  <Avatar className='size-6'>
                    {u?.image ? <AvatarImage src={u.image} /> : null}
                    <AvatarFallback className='text-xs'>{u?.name?.[0] ?? '?'}</AvatarFallback>
                  </Avatar>
                  <span>{u?.name ?? 'Unknown'}</span>
                </TableCell>
                <TableCell className='max-w-48 truncate text-sm text-muted-foreground'>{r.message ?? '-'}</TableCell>
                <TableCell className='text-sm text-muted-foreground'>{formatDate(r._creationTime)}</TableCell>
                <TableCell>
                  <Switch
                    checked={asAdmin[r._id] ?? false}
                    onCheckedChange={v => setAsAdmin(prev => ({ ...prev, [r._id]: v }))}
                  />
                </TableCell>
                <TableCell className='flex gap-1'>
                  <Button onClick={() => handleApprove(r._id, asAdmin[r._id] ?? false)} size='icon' variant='ghost'>
                    <Check className='size-4 text-green-600' />
                  </Button>
                  <Button onClick={() => handleReject(r._id)} size='icon' variant='ghost'>
                    <X className='size-4 text-red-600' />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

export default JoinRequests
