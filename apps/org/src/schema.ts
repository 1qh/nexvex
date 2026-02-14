import { org } from '@a/be/t'
import { boolean, email, object, string } from 'zod/v4'

const orgTeam = org.team.omit({ avatarId: true }),
  invite = object({ email: email(), isAdmin: boolean() }),
  joinRequest = object({ message: string().optional() })

export { invite, joinRequest, orgTeam }
