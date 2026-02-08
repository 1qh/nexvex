/* eslint-disable @typescript-eslint/no-unsafe-return */
'use client'

import type { OrgRole } from '@a/cv/f'
import type { Doc, Id } from '@a/cv/model'
import type { FunctionReference } from 'convex/server'
import type { ReactNode } from 'react'

import { api } from '@a/cv'
import { useMutation, useQuery } from 'convex/react'
import { createContext, use, useCallback, useMemo } from 'react'

interface OrgContextValue {
  canDeleteOrg: boolean
  canManageAdmins: boolean
  canManageMembers: boolean
  isAdmin: boolean
  isMember: boolean
  isOwner: boolean
  membership: Doc<'orgMember'> | null
  org: Doc<'org'>
  orgId: Id<'org'>
  role: OrgRole
}

interface OrgWithRole {
  org: Doc<'org'>
  role: OrgRole
}

const OrgContext = createContext<null | OrgContextValue>(null)

interface OrgProviderProps {
  children: ReactNode
  membership: Doc<'orgMember'> | null
  org: Doc<'org'>
  role: OrgRole
}

const OrgProvider = ({ children, membership, org, role }: OrgProviderProps) => {
    const value = useMemo<OrgContextValue>(() => {
      const isOwner = role === 'owner',
        isAdmin = role === 'owner' || role === 'admin'
      return {
        canDeleteOrg: isOwner,
        canManageAdmins: isOwner,
        canManageMembers: isAdmin,
        isAdmin,
        isMember: true,
        isOwner,
        membership,
        org,
        orgId: org._id,
        role
      }
    }, [membership, org, role])

    return <OrgContext value={value}>{children}</OrgContext>
  },
  useOrg = () => {
    const ctx = use(OrgContext)
    if (!ctx) throw new Error('useOrg must be used inside OrgProvider')
    return ctx
  },
  useMyOrgs = () => {
    const data = useQuery(api.org.myOrgs)
    return {
      isLoading: data === undefined,
      orgs: (data ?? []) as OrgWithRole[]
    }
  }

const useOrgQuery = <F extends FunctionReference<'query'>>(
    query: F,
    args?: 'skip' | Omit<F['_args'], 'orgId'>
  ): F['_returnType'] | undefined => {
    const { orgId } = useOrg()
    return useQuery(query as FunctionReference<'query'>, args === 'skip' ? 'skip' : { ...args, orgId })
  },
  useOrgMutation = <F extends FunctionReference<'mutation'>>(mutation: F) => {
    const { orgId } = useOrg(),
      mutate = useMutation(mutation as FunctionReference<'mutation'>)
    return useCallback(
      async (args?: Omit<F['_args'], 'orgId'>): Promise<F['_returnType']> => mutate({ ...args, orgId }),
      [mutate, orgId]
    )
  }

export { OrgProvider, useMyOrgs, useOrg, useOrgMutation, useOrgQuery }
