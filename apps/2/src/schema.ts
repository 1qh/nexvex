import { org, owned } from '@a/cv/t'
import { boolean, email, object, string } from 'zod/v4'

const createBlog = owned.blog.omit({ published: true }),
  editBlog = owned.blog.partial(),
  orgTeam = org.team.omit({ avatarId: true }),
  invite = object({ email: email(), isAdmin: boolean() }),
  joinRequest = object({ message: string().optional() })

export { createBlog, editBlog, invite, joinRequest, orgTeam }
