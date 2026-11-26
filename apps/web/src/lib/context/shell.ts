import { getContext, setContext } from 'svelte'
import type { BugDeLoiWebMcpState } from '#lib/agent/webmcp.ts'

export interface ShellActions {
  openSearch: () => void
  openAgent: () => void
  getWebMcpState: () => BugDeLoiWebMcpState
}

const SHELL_KEY = Symbol('bugdeloi-shell')

export function setShellActions(actions: ShellActions): void {
  setContext(SHELL_KEY, actions)
}

export function getShellActions(): ShellActions | undefined {
  return getContext<ShellActions | undefined>(SHELL_KEY)
}
