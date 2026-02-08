/* oxlint-disable promise/prefer-await-to-then */
'use client'

import type { Id, TableNames } from '@a/cv/model'

import { useState } from 'react'
import { toast } from 'sonner'

import { fail } from '~/utils'

interface UseBulkSelectionOpts<T extends TableNames> {
  bulkRm: (args: { ids: Id<T>[]; orgId: Id<'org'> }) => Promise<unknown>
  items: { _id: Id<T> }[]
  label: string
  orgId: Id<'org'>
}

const useBulkSelection = <T extends TableNames>({ bulkRm, items, label, orgId }: UseBulkSelectionOpts<T>) => {
  const [selected, setSelected] = useState<Set<Id<T>>>(new Set()),
    clear = () => {
      setSelected(new Set<Id<T>>())
    },
    toggleSelect = (id: Id<T>) => {
      setSelected(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    },
    toggleSelectAll = () => {
      if (selected.size === items.length) setSelected(new Set<Id<T>>())
      else setSelected(new Set(items.map(i => i._id)))
    },
    handleBulkDelete = () => {
      if (selected.size === 0) return
      bulkRm({ ids: [...selected], orgId })
        .then(() => {
          toast.success(`${selected.size} ${label} deleted`)
          setSelected(new Set<Id<T>>())
          return null
        })
        .catch(fail)
    }

  return { clear, handleBulkDelete, selected, toggleSelect, toggleSelectAll }
}

export { useBulkSelection }
