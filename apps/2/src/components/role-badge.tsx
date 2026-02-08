'use client'

import type { OrgRole } from '@a/cv/f'

import { Badge } from '@a/ui/badge'

interface RoleBadgeProps {
  role: OrgRole
}

const RoleBadge = ({ role }: RoleBadgeProps) => {
  const variants: Record<OrgRole, 'default' | 'outline' | 'secondary'> = {
    admin: 'secondary',
    member: 'outline',
    owner: 'default'
  }
  return <Badge variant={variants[role]}>{role}</Badge>
}

export default RoleBadge
