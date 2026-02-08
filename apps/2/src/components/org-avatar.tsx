'use client'

import type { Doc } from '@a/cv/model'

import { Avatar, AvatarFallback, AvatarImage } from '@a/ui/avatar'

interface OrgAvatarProps {
  org: Pick<Doc<'org'>, 'avatarId' | 'name'>
  size?: 'lg' | 'md' | 'sm'
}

const OrgAvatar = ({ org, size = 'md' }: OrgAvatarProps) => {
  const sizes = { lg: 'size-12', md: 'size-8', sm: 'size-6' },
    initials = org.name.slice(0, 2).toUpperCase()

  return (
    <Avatar className={sizes[size]}>
      {org.avatarId ? <AvatarImage src={`/api/image?id=${org.avatarId}`} /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  )
}

export default OrgAvatar
