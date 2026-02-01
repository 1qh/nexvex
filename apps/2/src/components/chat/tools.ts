interface ToolPart {
  errorText?: string
  input?: Record<string, unknown>
  output?: unknown
  state?: string
  toolCallId?: string
  toolName?: string
  type: string
}

const getToolName = (type: string): string => type.replace('tool-', '')

export { getToolName }
export type { ToolPart }
