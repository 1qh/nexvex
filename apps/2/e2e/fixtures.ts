import { expect as baseExpect, test as baseTest } from '@playwright/test'

import ChatPage from './pages/chat'
import DbChatPage from './pages/dbchat'
import DurableChatPage from './pages/durablechat'

interface Fixtures {
  chatPage: ChatPage
  dbChatPage: DbChatPage
  durableChatPage: DurableChatPage
}

const test = baseTest.extend<Fixtures>({
  chatPage: async ({ page }, run) => {
    const chatPage = new ChatPage(page)
    await run(chatPage)
  },
  dbChatPage: async ({ page }, run) => {
    const dbChatPage = new DbChatPage(page)
    await run(dbChatPage)
  },
  durableChatPage: async ({ page }, run) => {
    const durableChatPage = new DurableChatPage(page)
    await run(durableChatPage)
  }
})

export { baseExpect as expect, test }
