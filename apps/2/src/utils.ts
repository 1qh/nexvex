import type { Id, TableNames } from '@a/cv/model'

import { getErrorMessage } from '@a/cv/f'
import { toast } from 'sonner'

const fail = (error: unknown) => toast.error(getErrorMessage(error)),
  sleep = async (ms: number) =>
    // oxlint-disable-next-line promise/avoid-new, no-promise-executor-return
    new Promise(r => {
      setTimeout(r, ms)
    }),
  isId = <T extends TableNames>(val: unknown): val is Id<T> => typeof val === 'string' && val.length > 0

export { fail, isId, sleep }
