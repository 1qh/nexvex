import { expect as baseExpect, test as baseTest } from '@playwright/test'

import BlogPage from './pages/blog'

interface Fixtures {
  blogPage: BlogPage
}

const test = baseTest.extend<Fixtures>({
  blogPage: async ({ page }, run) => {
    const blogPage = new BlogPage(page)
    await run(blogPage)
  }
})

export { baseExpect as expect, test }
