import {
  convexAuthNextjsMiddleware as convexProxy,
  nextjsMiddlewareRedirect as go,
  createRouteMatcher as matcher
} from '@convex-dev/auth/nextjs/server'

const login = matcher(['/login', '/login/:path']),
  protect = matcher(['/group-chat'])

export default convexProxy(async (r, { convexAuth: { isAuthenticated: ok } }) => {
  const { pathname } = r.nextUrl
  if (pathname.startsWith('/_next')) return
  if (login(r) && (await ok())) return go(r, '/')
  if (protect(r) && !(await ok())) return go(r, '/login')
})

export const config = {
  // oxlint-disable-next-line unicorn/prefer-string-raw
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)']
}
