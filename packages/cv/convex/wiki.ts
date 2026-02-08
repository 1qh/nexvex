import { orgCrud } from '../f'
import { orgScoped } from '../t'

const { addEditor, all, bulkRm, bulkUpdate, create, editors, list, read, removeEditor, rm, setEditors, update } = orgCrud(
  'wiki',
  orgScoped.wiki,
  { acl: true }
)

export { addEditor, all, bulkRm, bulkUpdate, create, editors, list, read, removeEditor, rm, setEditors, update }
