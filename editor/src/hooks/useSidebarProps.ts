import type { SidebarProps } from '../components/Sidebar'
import { useDesignSectionViewModel } from './useDesignSectionViewModel'
import { useSidebarViewModel } from './useSidebarViewModel'

type UseSidebarPropsParams = {
  messages: SidebarProps['messages']
  clears: SidebarProps['clears']
  account: SidebarProps['account']
  charts: SidebarProps['charts']
  frames: SidebarProps['frames']
  upload: Omit<SidebarProps['upload'], 'userIsAdmin'>
  actions: SidebarProps['actions']
  debug: SidebarProps['debug']
  design: Parameters<typeof useDesignSectionViewModel>[0]
}

export function useSidebarProps(params: UseSidebarPropsParams): SidebarProps {
  const designSectionProps = useDesignSectionViewModel(params.design)
  return useSidebarViewModel({
    messages: params.messages,
    clears: params.clears,
    account: params.account,
    charts: params.charts,
    frames: params.frames,
    upload: params.upload,
    design: { sectionProps: designSectionProps },
    actions: params.actions,
    debug: params.debug,
  })
}
