import { orgCascade, orgCrud } from '../f'
import { orgScoped } from '../t'

const { addEditor, bulkRm, create, editors, list, read, removeEditor, rm, setEditors, update } = orgCrud(
  'project',
  orgScoped.project,
  { acl: true, cascade: orgCascade({ foreignKey: 'projectId', table: 'task' }) }
)

export { addEditor, bulkRm, create, editors, list, read, removeEditor, rm, setEditors, update }
