/* eslint-disable jest/no-conditional-in-test */
import { test } from './fixtures'
import { cleanupTestData, testConvex } from './helpers'

test.describe('Conflict Detection with expectedUpdatedAt', () => {
  test.beforeAll(async () => {
    await cleanupTestData()
  })

  test.afterAll(async () => {
    await cleanupTestData()
  })

  test('update with matching expectedUpdatedAt succeeds', async () => {
    const id = await testConvex.mutation<string>('blog:create', {
        category: 'tech',
        content: 'Conflict test content',
        published: false,
        title: 'Conflict Match'
      }),
      blogs = await testConvex.query<{ _id: string; title: string; updatedAt: number }[]>('blog:all', {
        where: { own: true }
      }),
      created = blogs.find(b => b._id === id),
      updatedAt = created?.updatedAt ?? 0

    test.expect(created).toBeDefined()

    const updated = await testConvex.mutation<{ title: string }>('blog:update', {
      expectedUpdatedAt: updatedAt,
      id,
      title: 'Updated Title'
    })

    test.expect(updated.title).toBe('Updated Title')
  })

  test('update with mismatched expectedUpdatedAt throws CONFLICT', async () => {
    const id = await testConvex.mutation<string>('blog:create', {
      category: 'tech',
      content: 'Conflict mismatch content',
      published: false,
      title: 'Conflict Mismatch'
    })

    let threw = false,
      errorMessage = ''

    try {
      await testConvex.mutation<{ title: string }>('blog:update', {
        expectedUpdatedAt: 1,
        id,
        title: 'Should Fail'
      })
    } catch (error) {
      threw = true
      errorMessage = String(error)
    }

    test.expect(threw).toBe(true)
    test.expect(errorMessage).toContain('CONFLICT')
  })

  test('update without expectedUpdatedAt always succeeds', async () => {
    const id = await testConvex.mutation<string>('blog:create', {
        category: 'tech',
        content: 'No conflict check',
        published: false,
        title: 'No Conflict'
      }),
      updated = await testConvex.mutation<{ title: string }>('blog:update', {
        id,
        title: 'Updated Without Check'
      })

    test.expect(updated.title).toBe('Updated Without Check')
  })

  // eslint-disable-next-line max-statements
  test('concurrent updates detected via expectedUpdatedAt', async () => {
    const id = await testConvex.mutation<string>('blog:create', {
        category: 'tech',
        content: 'Concurrent test',
        published: false,
        title: 'Concurrent Test'
      }),
      blogs = await testConvex.query<{ _id: string; updatedAt: number }[]>('blog:all', { where: { own: true } }),
      created = blogs.find(b => b._id === id),
      originalUpdatedAt = created?.updatedAt ?? 0

    test.expect(created).toBeDefined()

    await testConvex.mutation<{ title: string }>('blog:update', {
      id,
      title: 'First Update'
    })

    let threw = false
    try {
      await testConvex.mutation<{ title: string }>('blog:update', {
        expectedUpdatedAt: originalUpdatedAt,
        id,
        title: 'Stale Update'
      })
    } catch (error) {
      threw = true
      test.expect(String(error)).toContain('CONFLICT')
    }

    test.expect(threw).toBe(true)
  })
})
