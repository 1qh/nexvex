import { defineAgentApi, defineInternalAgentApi } from 'convex-durable-agents'

import { components, internal } from './_generated/api'

const {
    addToolError,
    addToolResult,
    createThread,
    deleteThread,
    getThread,
    listMessages,
    listMessagesWithStreams,
    listThreads,
    resumeThread,
    sendMessage,
    stopThread
  } = defineAgentApi(components.durable, internal.durablechat.durableChatHandler, {
    workpoolEnqueueAction: internal.workpool.enqueueWorkpoolAction
  }),
  {
    getThread: internalGetThread,
    listMessages: internalListMessages,
    sendMessage: internalSendMessage
  } = defineInternalAgentApi(components.durable, internal.durablechat.durableChatHandler, {
    workpoolEnqueueAction: internal.workpool.enqueueWorkpoolAction
  })

export {
  addToolError,
  addToolResult,
  createThread,
  deleteThread,
  getThread,
  internalGetThread,
  internalListMessages,
  internalSendMessage,
  listMessages,
  listMessagesWithStreams,
  listThreads,
  resumeThread,
  sendMessage,
  stopThread
}
