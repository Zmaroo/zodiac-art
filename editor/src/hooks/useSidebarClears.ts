import type { SidebarProps } from '../components/Sidebar'

type UseSidebarClearsParams = SidebarProps['clears']

export function useSidebarClears(params: UseSidebarClearsParams): SidebarProps['clears'] {
  return params
}
