import { crud } from '../f'
import t from '../t'

const {
  create,
  my,
  pub: { all, list, read },
  rm,
  update
} = crud('blog', t.blog)

export { all, create, list, my, read, rm, update }
