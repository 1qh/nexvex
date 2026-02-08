import { childCrud } from '../f'
import { children } from '../t'

const { create, list, update } = childCrud('message', children.message)

export { create, list, update }
