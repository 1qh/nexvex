import type { Id, TableNames } from '@a/cv/model'

const sleep = async (ms: number) =>
    // oxlint-disable-next-line promise/avoid-new, no-promise-executor-return
    new Promise(r => {
      setTimeout(r, ms)
    }),
  isId = <T extends TableNames>(val: unknown): val is Id<T> => typeof val === 'string' && val.length > 0

export { isId, sleep }
