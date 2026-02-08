// biome-ignore-all lint/performance/useTopLevelRegex: test helper
import type { FunctionReference } from 'convex/server'

import { ConvexHttpClient } from 'convex/browser'
import { anyApi } from 'convex/server'

interface OrgDoc {
  _creationTime: number
  _id: string
  name: string
  slug: string
  userId: string
}

interface MemberDoc {
  memberId?: string
  role: 'admin' | 'member' | 'owner'
  user: { _id: string; email: string; name: string } | null
  userId: string
}

interface InviteDoc {
  _id: string
  email: string
  expiresAt: number
  isAdmin: boolean
  orgId: string
  token: string
}

interface JoinRequestDoc {
  _id: string
  message?: string
  orgId: string
  status: 'approved' | 'pending' | 'rejected'
  userId: string
}

interface ProjectDoc {
  _creationTime: number
  _id: string
  createdAt: number
  description?: string
  editors?: string[]
  name: string
  orgId: string
  status?: string
  updatedAt: number
  userId: string
}

interface TaskDoc {
  _creationTime: number
  _id: string
  assigneeId?: string
  completed: boolean
  createdAt: number
  orgId: string
  priority?: string
  projectId: string
  title: string
  updatedAt: number
  userId: string
}

interface WikiDoc {
  _creationTime: number
  _id: string
  content?: string
  createdAt: number
  editors?: string[]
  orgId: string
  slug: string
  status: string
  title: string
  updatedAt: number
  userId: string
}

interface PaginatedResult<T> {
  continueCursor: string
  isDone: boolean
  page: T[]
}

const getClient = () => new ConvexHttpClient(process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? '')

const extractErrorCode = (e: unknown): { code: string } | null => {
  if (e instanceof Error) {
    const match = e.message.match(/\{"code":"([^"]+)"\}/)
    if (match?.[1]) return { code: match[1] }
    if (e.message.includes('ArgumentValidationError') || e.message.includes('does not match validator'))
      return { code: 'VALIDATION_ERROR' }
  }
  return null
}

const parseRef = (name: string) => {
  const [mod, fn] = name.split(':')
  if (!(mod && fn)) throw new Error(`Invalid API path: ${name}`)
  const ref = (anyApi as Record<string, Record<string, FunctionReference<'action' | 'mutation' | 'query'>>>)[mod]?.[fn]
  if (!ref) throw new Error(`API not found: ${name}`)
  return ref
}

const safe = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn()
  } catch (error) {
    const r = extractErrorCode(error)
    if (r) return r as T
    throw error
  }
}

const testConvex = {
  action: <T>(name: string, args: Record<string, unknown>) =>
    safe<T>(() => getClient().action(parseRef(name) as FunctionReference<'action'>, args)),
  mutation: <T>(name: string, args: Record<string, unknown>) =>
    safe<T>(() => getClient().mutation(parseRef(name) as FunctionReference<'mutation'>, args)),
  query: <T>(name: string, args: Record<string, unknown>) =>
    safe<T>(() => getClient().query(parseRef(name) as FunctionReference<'query'>, args))
}

const ensureTestUser = async () => {
  await testConvex.mutation<string>('testauth:ensureTestUser', {})
}

const createTestUser = async (email: string, name: string) =>
  testConvex.mutation<string>('testauth:createTestUser', { email, name })

const addTestOrgMember = async (orgId: string, userId: string, isAdmin: boolean) =>
  testConvex.mutation<string>('testauth:addTestOrgMember', { isAdmin, orgId, userId })

const removeTestOrgMember = async (orgId: string, userId: string) =>
  testConvex.mutation<boolean>('testauth:removeTestOrgMember', { orgId, userId })

const makeOrgTestUtils = (prefix: string) => ({
  cleanupOrgTestData: async () => {
    await testConvex.mutation('testauth:cleanupOrgTestData', { slugPrefix: prefix })
  },
  cleanupTestUsers: async () => {
    await testConvex.mutation('testauth:cleanupTestUsers', { emailPrefix: `${prefix}-` })
  },
  generateSlug: (suffix: string) => `${prefix}-${suffix}-${Date.now()}`
})

export type { InviteDoc, JoinRequestDoc, MemberDoc, OrgDoc, PaginatedResult, ProjectDoc, TaskDoc, WikiDoc }
export { addTestOrgMember, createTestUser, ensureTestUser, makeOrgTestUtils, removeTestOrgMember, testConvex }
