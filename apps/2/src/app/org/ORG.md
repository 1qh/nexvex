Multi-tenant SaaS organization support with:

- Users can belong to 0, 1, or many orgs
- Role hierarchy: owner → admin → member
- Org-scoped data with full type safety
- Invite and join request flows

## Role Hierarchy

### Storage Model

| Role | Storage | Description |
|------|---------|--
| `owner` | `org.userId` | Exactly 1 per org, stored on org table |
| `admin` | `orgMember.isAdmin = true` | 0-N, can manage members |
| `member` | `orgMember.isAdmin = false` | 0-N, basic access |

### Permission Matrix

| Action | Owner | Admin | Member |
|--------|:-----:|:-----:|:------:|
| View org data | ✓ | ✓ | ✓ |
| Create/edit own content | ✓ | ✓ | ✓ |
| Edit/delete others' content | ✓ | ✓ | - |
| Invite members | ✓ | ✓ | - |
| Approve join requests | ✓ | ✓ | - |
| Remove members | ✓ | ✓* | - |
| Promote/demote roles | ✓ | - | - |
| Edit org settings | ✓ | ✓ | - |
| Transfer ownership | ✓ | - | - |
| Delete org | ✓ | - | - |

*Admin cannot remove owner or other admins

### Constraints

1. **Single Owner**: `org.userId` is always exactly 1 owner
2. **Ownership Transfer**: Must transfer to an admin
3. **Admin Limits**: Admins cannot modify owner or other admins
4. **Leave Rules**: Owner cannot leave (must transfer first)

Legend: **[B]** = Backend, **[U]** = UI, **[T]** = E2E Test

## 1. Organization CRUD

### 1.1 Create Organization

| # | Type | Feature |
|---|------|---------|
| 1 | B | `org:create` mutation |
| 2 | B | Creator becomes owner (`org.userId`) |
| 3 | B | Slug uniqueness validation |
| 4 | U | `/org/new` page with form |
| 5 | U | Slug availability check (live) |
| 6 | T | Create org - success |
| 7 | T | Create org - creator becomes owner |
| 8 | T | Create org - duplicate slug fails |

### 1.2 Read Organization

| # | Type | Feature |
|---|------|---------|
| 9 | B | `org:get` query (by ID, member only) |
| 10 | B | `org:getBySlug` query (public) |
| 11 | B | `org:getPublic` query (name/slug/avatar only) |
| 12 | B | `org:myOrgs` query (all user's orgs with roles) |
| 13 | B | `org:isSlugAvailable` query |
| 14 | U | `/org` page (list my orgs) |
| 15 | U | `/org/[slug]` page (org dashboard) |
| 16 | U | `OrgSwitcher` component |
| 17 | T | Get org - success |
| 18 | T | Get org by slug - success |
| 19 | T | Get org by slug - not found |
| 20 | T | My orgs - includes created org |
| 21 | T | Slug available - returns true |
| 22 | T | Slug taken - returns false |

### 1.3 Update Organization

| # | Type | Feature |
|---|------|---------|
| 23 | B | `org:update` mutation (admin+) |
| 24 | B | Slug change with uniqueness check |
| 25 | U | `/org/[slug]/settings` page |
| 26 | U | `OrgSettingsForm` component |
| 27 | T | Owner updates org name |
| 28 | T | Owner updates org slug |
| 29 | T | Admin updates org name |
| 30 | T | Admin updates org slug |
| 31 | T | Update - duplicate slug fails |
| 32 | T | Member cannot update org |

### 1.4 Delete Organization

| # | Type | Feature |
|---|------|---------|
| 33 | B | `org:remove` mutation (owner only) |
| 34 | B | Cascade delete: tasks → projects → requests → invites → members → org |
| 35 | U | Delete button in settings (owner only) |
| 36 | U | Confirmation dialog |
| 37 | T | Owner can delete |
| 38 | T | Admin cannot delete |
| 39 | T | Delete cascades members |
| 40 | T | Delete cascades invites |
| 41 | T | Delete cascades projects and tasks |

## 2. Membership

### 2.1 View Members

| # | Type | Feature |
|---|------|---------|
| 42 | B | `org:members` query (returns all with roles) |
| 43 | B | `org:membership` query (current user's role) |
| 44 | U | `/org/[slug]/members` page |
| 45 | U | `MemberList` component |
| 46 | U | `RoleBadge` component |
| 47 | T | Members - shows owner |
| 48 | T | Members - shows admins and members |
| 49 | T | Membership - owner has owner role |

### 2.2 Role Management (Owner Only)

| # | Type | Feature |
|---|------|---------|
| 50 | B | `org:setAdmin` mutation (owner only) |
| 51 | B | Cannot modify owner via setAdmin |
| 52 | U | Promote/demote dropdown in MemberList |
| 53 | T | Owner sets member as admin |
| 54 | T | Owner demotes admin to member |
| 55 | T | Admin cannot setAdmin |
| 56 | T | Member cannot setAdmin |
| 57 | T | setAdmin - cannot modify owner |

### 2.3 Remove Member

| # | Type | Feature |
|---|------|---------|
| 58 | B | `org:removeMember` mutation (admin+) |
| 59 | B | Admin cannot remove other admins |
| 60 | B | Cannot remove owner (not in orgMember) |
| 61 | U | Remove button in MemberList dropdown |
| 62 | T | Owner removes member |
| 63 | T | Owner removes admin |
| 64 | T | Admin removes member |
| 65 | T | Admin cannot remove admin |
| 66 | T | Member cannot remove anyone |

### 2.4 Leave Organization

| # | Type | Feature |
|---|------|---------|
| 67 | B | `org:leave` mutation |
| 68 | B | Owner cannot leave (MUST_TRANSFER_OWNERSHIP) |
| 69 | U | Leave button in settings (non-owner) |
| 70 | U | Confirmation dialog |
| 71 | U | Redirect to `/org` after leaving |
| 72 | T | Member can leave |
| 73 | T | Admin can leave |
| 74 | T | Owner cannot leave |
| 75 | T | Last admin leaves - org still functional |

### 2.5 Transfer Ownership

| # | Type | Feature |
|---|------|---------|
| 76 | B | `org:transferOwnership` mutation (owner only) |
| 77 | B | Target must be admin |
| 78 | B | Old owner becomes admin after transfer |
| 79 | U | Transfer section in settings (owner only) |
| 80 | U | Admin member dropdown |
| 81 | U | Confirmation dialog |
| 82 | T | Transfer to admin - success |
| 83 | T | Transfer to member fails (TARGET_MUST_BE_ADMIN) |
| 84 | T | Admin cannot transfer |
| 85 | T | Race - target leaves mid-transfer |

## 3. Invites

### 3.1 Create Invite

| # | Type | Feature |
|---|------|---------|
| 86 | B | `org:invite` mutation (admin+) |
| 87 | B | Generate unique token |
| 88 | B | 7-day expiry |
| 89 | B | `isAdmin` flag for admin invites |
| 90 | U | `InviteDialog` component |
| 91 | U | Email input + admin toggle |
| 92 | U | Copy invite link to clipboard |
| 93 | T | Owner creates invite |
| 94 | T | Admin creates invite |
| 95 | T | Member cannot invite |
| 96 | T | Can create admin invite |

### 3.2 Accept Invite

| # | Type | Feature |
|---|------|---------|
| 97 | B | `org:acceptInvite` mutation |
| 98 | B | Validate token exists |
| 99 | B | Check not expired |
| 100 | B | Check not already member |
| 101 | B | Delete invite after use (single-use) |
| 102 | B | Clean up pending join request if exists |
| 103 | U | `/org/invite/[token]` page |
| 104 | U | Show org info + accept button |
| 105 | U | Redirect to org after accept |
| 106 | T | Accept invite - becomes member |
| 107 | T | Accept admin invite - becomes admin |
| 108 | T | Invalid token fails |
| 109 | T | Expired invite fails |
| 110 | T | Already member fails |
| 111 | T | Invite is single-use |
| 112 | T | Accept cleans up pending join request |
| 113 | T | Self-invite fails (ALREADY_ORG_MEMBER) |

### 3.3 Manage Invites

| # | Type | Feature |
|---|------|---------|
| 114 | B | `org:pendingInvites` query (admin+) |
| 115 | B | `org:revokeInvite` mutation (admin+) |
| 116 | U | `PendingInvitesList` component |
| 117 | U | Show email, role, expiry |
| 118 | U | Copy link button |
| 119 | U | Revoke button with confirmation |
| 120 | T | Pending invites - shows invites |
| 121 | T | Revoke invite - success |
| 122 | T | Non-member cannot see pending invites |

## 4. Join Requests

### 4.1 Request to Join

| # | Type | Feature |
|---|------|---------|
| 123 | B | `org:requestJoin` mutation |
| 124 | B | Cannot request if already member |
| 125 | B | Cannot request if pending request exists |
| 126 | B | Optional message field |
| 127 | U | `/org/[slug]/join` page (public) |
| 128 | U | Show org info (via getPublic) |
| 129 | U | Request form with message |
| 130 | U | Show pending status if already requested |
| 131 | T | Non-member requests to join |
| 132 | T | Already member fails |
| 133 | T | Duplicate request fails |

### 4.2 View Own Request

| # | Type | Feature |
|---|------|---------|
| 134 | B | `org:myJoinRequest` query |
| 135 | U | Show pending status on join page |
| 136 | T | myJoinRequest - returns pending request |
| 137 | T | myJoinRequest - null when no request |

### 4.3 Cancel Request

| # | Type | Feature |
|---|------|---------|
| 138 | B | `org:cancelJoinRequest` mutation |
| 139 | B | Only requester can cancel |
| 140 | B | Only pending requests can be cancelled |
| 141 | U | Cancel button on join page |
| 142 | T | User cancels own request |

### 4.4 Manage Requests (Admin)

| # | Type | Feature |
|---|------|---------|
| 143 | B | `org:pendingJoinRequests` query (admin+) |
| 144 | B | `org:approveJoinRequest` mutation (admin+) |
| 145 | B | `org:rejectJoinRequest` mutation (admin+) |
| 146 | B | Approve with optional `isAdmin` flag |
| 147 | U | `JoinRequestsList` component |
| 148 | U | Show user info, message, date |
| 149 | U | Approve button (with admin toggle) |
| 150 | U | Reject button |
| 151 | T | Owner approves - user becomes member |
| 152 | T | Owner rejects - user not added |
| 153 | T | Admin approves - user becomes member |
| 154 | T | Admin rejects - user not added |
| 155 | T | Approve already-member fails |
| 156 | T | Non-member cannot see join requests |

## 5. Projects (Org-Scoped)

### 5.1 Project CRUD

| # | Type | Feature |
|---|------|---------|
| 157 | B | `project:create` mutation (any member) |
| 158 | B | `project:list` query (paginated) |
| 159 | B | `project:read` query |
| 160 | B | `project:update` mutation (creator or admin) |
| 161 | B | `project:rm` mutation (creator or admin) |
| 162 | B | `project:bulkRm` mutation (admin only) |
| 163 | B | Cascade delete to tasks |
| 164 | B | Conflict detection (expectedUpdatedAt) |
| 165 | U | `/org/[slug]/projects` page (list) |
| 166 | U | `/org/[slug]/projects/new` page |
| 167 | U | `/org/[slug]/projects/[id]` page (detail) |
| 168 | U | `/org/[slug]/projects/[id]/edit` page |
| 169 | U | Delete with task count warning |
| 170 | U | Bulk select + delete (admin) |
| 171 | T | Create project - success |
| 172 | T | Create project - tracks userId |
| 173 | T | List projects - paginated |
| 174 | T | Read project - success |
| 175 | T | Update project - owner can update |
| 176 | T | Update project - admin can update any |
| 177 | T | Update project - member blocked from other's |
| 178 | T | Delete project - owner can delete |
| 179 | T | Delete project - admin can delete any |
| 180 | T | Delete project - member blocked from other's |
| 181 | T | Delete project - cascades tasks |
| 182 | T | Bulk delete - admin success |
| 183 | T | Bulk delete - member blocked |
| 184 | T | Conflict detection - stale update fails |

### 5.2 Project Isolation

| # | Type | Feature |
|---|------|---------|
| 185 | T | Read project - not found for wrong org |
| 186 | T | List projects - only shows org projects |
| 187 | T | Non-member cannot list projects |

## 6. Tasks (Org-Scoped)

### 6.1 Task CRUD

| # | Type | Feature |
|---|------|---------|
| 188 | B | `task:create` mutation (any member) |
| 189 | B | `task:list` query (paginated) |
| 190 | B | `task:read` query |
| 191 | B | `task:update` mutation (creator or admin) |
| 192 | B | `task:rm` mutation (creator or admin) |
| 193 | B | `task:byProject` query |
| 194 | U | Task list in project detail page |
| 195 | U | Add task form |
| 196 | U | Delete task button |
| 197 | U | Edit task (inline or dialog) |
| 198 | T | Create task - success |
| 199 | T | Create task - tracks userId |
| 200 | T | Read task - success |
| 201 | T | Update task - creator can update |
| 202 | T | Update task - admin can update any |
| 203 | T | Update task - member blocked from other's |
| 204 | T | Delete task - creator can delete |
| 205 | T | Delete task - admin can delete any |
| 206 | T | Delete task - member blocked from other's |
| 207 | T | byProject - returns tasks for project |

### 6.2 Task Toggle

| # | Type | Feature |
|---|------|---------|
| 208 | B | `task:toggle` mutation (creator or admin) |
| 209 | U | Checkbox in task row |
| 210 | T | Toggle - owner can toggle |
| 211 | T | Toggle - admin can toggle any |
| 212 | T | Toggle - member blocked from other's |
| 213 | T | Toggle - double toggle returns to original |

### 6.3 Task Assignment

| # | Type | Feature |
|---|------|---------|
| 214 | B | `task:assign` mutation (admin only) |
| 215 | B | Assignee must be org member |
| 216 | B | Can unassign (null assigneeId) |
| 217 | U | Assignee dropdown in task row (admin only) |
| 218 | U | Show assignee avatar/name |
| 219 | T | Assign to member - success |
| 220 | T | Assign to self - success |
| 221 | T | Unassign - success |
| 222 | T | Assign to non-member fails |
| 223 | T | Member cannot assign |

### 6.4 Task Bulk Operations

| # | Type | Feature |
|---|------|---------|
| 224 | B | `task:bulkRm` mutation (admin only) |
| 225 | B | `task:bulkUpdate` mutation (admin only) |
| 226 | U | Selection checkboxes (admin only) |
| 227 | U | Select all checkbox |
| 228 | U | Bulk action bar |
| 229 | U | Bulk delete |
| 230 | U | Bulk mark complete/incomplete |
| 231 | T | Bulk delete - success |
| 232 | T | Bulk update - success |
| 233 | T | Bulk delete - member blocked |
| 234 | T | Bulk update - member blocked |

## 7. Frontend Infrastructure

### 7.1 Org Context & Hooks

| # | Type | Feature |
|---|------|---------|
| 235 | U | `OrgProvider` context |
| 236 | U | `useOrg` hook (inside /org/[slug]/*) |
| 237 | U | `useMyOrgs` hook |
| 238 | U | `useActiveOrg` hook (cookie-based) |
| 239 | U | `getActiveOrg` server helper |
| 240 | U | `setActiveOrgCookie` helper |

### 7.2 Org Layout

| # | Type | Feature |
|---|------|---------|
| 241 | U | `/org/[slug]/layout.tsx` |
| 242 | U | Layout syncs active org cookie |
| 243 | U | Layout provides OrgProvider |

### 7.3 Components

| # | Type | Feature |
|---|------|---------|
| 244 | U | `OrgAvatar` component |
| 245 | U | `NoOrgPrompt` component |

## 8. UI Integration Tests

### 8.1 Org Switcher

| # | Type | Feature |
|---|------|---------|
| 246 | T | OrgSwitcher renders at homepage |
| 247 | T | OrgSwitcher shows all orgs with role badges |
| 248 | T | Click org navigates to /org/[slug] |
| 249 | T | Current org highlighted |
| 250 | T | No orgs shows create link |

### 8.2 Leave Organization UI

| # | Type | Feature |
|---|------|---------|
| 251 | T | Leave button visible for member/admin |
| 252 | T | Leave button NOT visible for owner |
| 253 | T | Click leave → confirmation → leaves |
| 254 | T | After leave → redirected to /org |

### 8.3 Transfer Ownership UI

| # | Type | Feature |
|---|------|---------|
| 255 | T | Transfer section visible for owner only |
| 256 | T | Dropdown shows only admin members |
| 257 | T | Transfer → confirmation → success |
| 258 | T | After transfer → user becomes admin |

### 8.4 Pending Invites UI

| # | Type | Feature |
|---|------|---------|
| 259 | T | Pending invites visible for admin+ |
| 260 | T | Shows email, role badge, expiry |
| 261 | T | Copy link button works |
| 262 | T | Revoke → confirmation → removed |

### 8.5 Join Request UI

| # | Type | Feature |
|---|------|---------|
| 263 | T | Non-member sees request form |
| 264 | T | Submit request → shows pending |
| 265 | T | Cancel request → returns to form |
| 266 | T | Member redirected from join page |
| 267 | T | Admin sees pending requests |
| 268 | T | Approve → user in members list |
| 269 | T | Reject → request removed |

### 8.6 Task Assignment UI

| # | Type | Feature |
|---|------|---------|
| 270 | T | Admin sees assignee dropdown |
| 271 | T | Member does NOT see dropdown |
| 272 | T | Assign → shows assignee avatar |
| 273 | T | Unassign → shows "Unassigned" |

### 8.7 Task Editing UI

| # | Type | Feature |
|---|------|---------|
| 274 | T | Edit button for task creator |
| 275 | T | Edit button for admin on any task |
| 276 | T | Edit title saves successfully |
| 277 | T | Member cannot edit other's task |

### 8.8 Bulk Operations UI

| # | Type | Feature |
|---|------|---------|
| 278 | T | Checkboxes visible for admin |
| 279 | T | Select multiple → action bar appears |
| 280 | T | Bulk delete → confirmation → deleted |
| 281 | T | Member does NOT see checkboxes |

## 9. Access Control Tests

### 9.1 Route Protection

| # | Type | Feature |
|---|------|---------|
| 282 | T | Non-member visits /org/[slug] → 403 |
| 283 | T | Non-member visits /org/[slug]/settings → 403 |
| 284 | T | Member visits /org/[slug]/settings → 403 |
| 285 | T | Admin visits /org/[slug]/settings → success |
| 286 | T | Invalid slug → 404 |
| 287 | T | Unauthenticated → redirect to login |

### 9.2 Cookie/Context

| # | Type | Feature |
|---|------|---------|
| 288 | T | Visit /org/[slug] → cookie set |
| 289 | T | Refresh → org context preserved |
| 290 | T | Switch org → cookie updated |
| 291 | T | Org deleted → cookie cleared |
| 292 | T | User removed → cookie cleared |

## 10. Error Handling Tests

| # | Type | Feature |
|---|------|---------|
| 293 | T | Duplicate slug → error toast |
| 294 | T | Expired invite → error page |
| 295 | T | Already member invite → message |
| 296 | T | Network error → retry option |
| 297 | T | Concurrent edit conflict → message |

## 11. Validation Error Tests

| # | Type | Feature |
|---|------|---------|
| 298 | T | org:get - malformed ID |
| 299 | T | org:update - malformed ID |
| 300 | T | org:remove - malformed ID |
| 301 | T | org:membership - malformed ID |
| 302 | T | org:members - malformed ID |
| 303 | T | org:setAdmin - malformed member ID |
| 304 | T | org:removeMember - malformed ID |
| 305 | T | org:leave - malformed org ID |
| 306 | T | org:invite - malformed org ID |
| 307 | T | org:revokeInvite - malformed ID |
| 308 | T | org:pendingInvites - malformed ID |
| 309 | T | org:pendingJoinRequests - malformed ID |
| 310 | T | org:requestJoin - malformed ID |
| 311 | T | org:approveJoinRequest - malformed ID |
| 312 | T | org:rejectJoinRequest - malformed ID |
| 313 | T | org:cancelJoinRequest - malformed ID |
| 314 | T | org:transferOwnership - malformed org ID |
| 315 | T | org:transferOwnership - malformed user ID |
| 316 | T | project:read - malformed ID |
| 317 | T | project:update - malformed ID |
| 318 | T | project:rm - malformed ID |
| 319 | T | task:read - malformed ID |
| 320 | T | task:update - malformed ID |
| 321 | T | task:toggle - malformed ID |
| 322 | T | task:rm - malformed ID |
| 323 | T | task:assign - malformed ID |

## Test Files

| File | Category | Tests |
|------|----------|-------|
| `e2e/org.test.ts` | Org + Membership + Invites + Join Requests | ~90 |
| `e2e/org-project.test.ts` | Projects + Tasks | ~55 |
| `e2e/org-ui.test.ts` | UI Integration | ~36 |
| `e2e/org-access.test.ts` | Access Control + Cookie | ~11 |
| `e2e/org-errors.test.ts` | Error Handling + Validation | ~31 |

## Commands

```bash
# Lint + typecheck
bun fix

# Run org tests
cd apps/2 && timeout 120 bun with-env playwright test e2e/org.test.ts --timeout=10000

# Run project tests
cd apps/2 && timeout 120 bun with-env playwright test e2e/org-project.test.ts --timeout=10000

# Run all org tests
cd apps/2 && timeout 300 bun with-env playwright test e2e/org*.test.ts --timeout=15000 --reporter=line
```
