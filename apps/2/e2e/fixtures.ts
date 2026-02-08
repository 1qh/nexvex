import { expect as baseExpect, test as baseTest } from '@playwright/test'

import ChatPage from './pages/chat'
import CrudPage from './pages/crud'
import MoviePage from './pages/movie'

interface Fixtures {
  chatPage: ChatPage
  crudPage: CrudPage
  moviePage: MoviePage
}

const test = baseTest.extend<Fixtures>({
  chatPage: async ({ page }, run) => {
    const chatPage = new ChatPage(page)
    await run(chatPage)
  },
  crudPage: async ({ page }, run) => {
    const crudPage = new CrudPage(page)
    await run(crudPage)
  },
  moviePage: async ({ page }, run) => {
    const moviePage = new MoviePage(page)
    await run(moviePage)
  }
})

export { baseExpect as expect, test }
