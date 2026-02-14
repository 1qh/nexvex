import { crud } from '../lazy'
import { owned } from '../t'

export const {
  auth: { list, read },
  create,
  pub: { read: pubRead },
  rm,
  update
} = crud('chat', owned.chat, {
  pub: { where: { isPublic: true } }
})
