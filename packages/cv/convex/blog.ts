import { crud } from '../f'
import { owned } from '../t'

const {
  bulkRm,
  bulkUpdate,
  create,
  pub: { all, count, list, read, search },
  rm,
  update
} = crud('blog', owned.blog)

export { all, bulkRm, bulkUpdate, count, create, list, read, rm, search, update }
