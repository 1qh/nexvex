import { api } from '@a/cv'
import { fetchQuery } from 'convex/nextjs'
import Link from 'next/link'
import { connection } from 'next/server'

import { getToken, isAuthenticated } from '~/auth'
import OrgAvatar from '~/components/org-avatar'
import RoleBadge from '~/components/role-badge'

import NoOrgPrompt from './no-org-prompt'

const OrgListPage = async () => {
  await connection()
  const authed = await isAuthenticated()
  if (!authed) return <NoOrgPrompt />

  const token = await getToken(),
    opts = token ? { token } : {},
    orgs = await fetchQuery(api.org.myOrgs, {}, opts)

  if (orgs.length === 0) return <NoOrgPrompt />

  return (
    <div className='container py-8'>
      <h1 className='mb-6 text-2xl font-bold'>Your Organizations</h1>
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {orgs.map(item => (
          <Link
            className='flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-muted'
            href={`/org/${item.org.slug}`}
            key={item.org._id}>
            <OrgAvatar org={item.org} size='lg' />
            <div className='flex-1'>
              <div className='font-medium'>{item.org.name}</div>
              <div className='text-sm text-muted-foreground'>/{item.org.slug}</div>
            </div>
            <RoleBadge role={item.role} />
          </Link>
        ))}
      </div>
    </div>
  )
}

export default OrgListPage
