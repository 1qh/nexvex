// oxlint-disable unicorn/no-anonymous-default-export

import type { ReactNode } from 'react'

import { Suspense } from 'react'

// eslint-disable-next-line react/display-name
export default (f: (...args: unknown[]) => ReactNode) => () => <Suspense fallback=''>{f()}</Suspense>
