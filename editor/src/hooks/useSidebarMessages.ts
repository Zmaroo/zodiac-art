import type { SidebarProps } from '../components/Sidebar'

type UseSidebarMessagesParams = SidebarProps['messages']

export function useSidebarMessages(params: UseSidebarMessagesParams): SidebarProps['messages'] {
  return params
}
