/* oxlint-disable promise/prefer-await-to-then, promise/always-return */
/* eslint-disable no-alert */
'use client'

import type { Id } from '@a/cv/model'

import { api } from '@a/cv'
import { Button } from '@a/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@a/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@a/ui/select'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { useOrg, useOrgMutation, useOrgQuery } from '~/hook/use-org'
import { fail } from '~/utils'

import OrgSettingsForm from './org-settings-form'

const OrgSettingsPage = () => {
  const router = useRouter(),
    { canDeleteOrg, isAdmin, isOwner, org } = useOrg(),
    removeOrg = useOrgMutation(api.org.remove),
    leaveOrg = useOrgMutation(api.org.leave),
    transferOwnership = useOrgMutation(api.org.transferOwnership),
    members = useOrgQuery(api.org.members),
    [transferTarget, setTransferTarget] = useState<string>('')

  if (!isAdmin)
    return <div className='text-center text-muted-foreground'>You do not have permission to access settings.</div>

  const adminMembers = members?.filter(m => m.role === 'admin') ?? [],
    handleLeave = () => {
      /** biome-ignore lint/suspicious/noAlert: demo page uses native confirm */
      if (!confirm('Are you sure you want to leave this organization?')) return
      leaveOrg()
        .then(() => {
          toast.success('You have left the organization')
          router.push('/org')
        })
        .catch(fail)
    },
    handleTransfer = () => {
      if (!transferTarget) return
      /** biome-ignore lint/suspicious/noAlert: demo page uses native confirm */
      if (!confirm('Are you sure? You will become an admin and lose owner privileges.')) return
      transferOwnership({ newOwnerId: transferTarget as Id<'users'> })
        .then(() => {
          toast.success('Ownership transferred')
          router.refresh()
        })
        .catch(fail)
    },
    handleDelete = () => {
      /** biome-ignore lint/suspicious/noAlert: demo page uses native confirm */
      if (!confirm('Are you sure? This will delete all data.')) return
      removeOrg()
        .then(() => {
          toast.success('Organization deleted')
          router.push('/org')
        })
        .catch(fail)
    }

  return (
    <div className='space-y-6'>
      <h1 className='text-2xl font-bold'>Settings</h1>

      <OrgSettingsForm org={org} />

      {isOwner && adminMembers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Transfer Ownership</CardTitle>
            <CardDescription>Transfer ownership to an admin. You will become an admin.</CardDescription>
          </CardHeader>
          <CardContent className='flex gap-2'>
            <Select onValueChange={setTransferTarget} value={transferTarget}>
              <SelectTrigger className='w-64'>
                <SelectValue placeholder='Select an admin' />
              </SelectTrigger>
              <SelectContent>
                {adminMembers.map(m => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.user?.name ?? m.user?.email ?? 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!transferTarget} onClick={handleTransfer} variant='outline'>
              Transfer
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isOwner ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Leave Organization</CardTitle>
            <CardDescription>Remove yourself from this organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleLeave} variant='outline'>
              Leave organization
            </Button>
          </CardContent>
        </Card>
      )}

      {canDeleteOrg ? (
        <Card className='border-destructive'>
          <CardHeader>
            <CardTitle className='text-destructive'>Danger zone</CardTitle>
            <CardDescription>Permanently delete this organization and all its data.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDelete} variant='destructive'>
              Delete organization
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

export default OrgSettingsPage
