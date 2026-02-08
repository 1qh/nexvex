import { crud } from '../f'
import { owned } from '../t'

const {
  auth: { all, list, read },
  create,
  rm
} = crud('chat', owned.chat)

export { all, create, list, read, rm }
