import type { ReactNode } from 'react'

import { api } from '@a/cv'
import { fetchQuery } from 'convex/nextjs'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'

import { getToken, isAuthenticated } from '~/auth'
import { setActiveOrgCookie } from '~/lib/active-org'

import OrgLayoutClient from './layout-client'

interface Props {
  children: ReactNode
  params: Promise<{ slug: string }>
}

const OrgLayout = async ({ children, params }: Props) => {
  await connection()
  const { slug } = await params
  if (!(await isAuthenticated())) redirect('/login')

  const token = await getToken(),
    opts = token ? { token } : {},
    org = await fetchQuery(api.org.getBySlug, { slug }, opts)
  if (!org) notFound()

  const membership = await fetchQuery(api.org.membership, { orgId: org._id }, opts)
  if (!membership) notFound()

  await setActiveOrgCookie(org._id, org.slug).catch(Boolean)

  return (
    <OrgLayoutClient membership={null} org={org} role={membership.role}>
      {children}
    </OrgLayoutClient>
  )
}

export default OrgLayout
