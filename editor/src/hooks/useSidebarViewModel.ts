import type { SidebarProps } from '../components/Sidebar'
type UseSidebarViewModelParams = Omit<SidebarProps, 'upload' | 'design'> & {
  upload: Omit<SidebarProps['upload'], 'userIsAdmin'>
  design: Omit<SidebarProps['design'], 'sectionProps'> & {
    sectionProps: SidebarProps['design']['sectionProps']
  }
}

export function useSidebarViewModel(params: UseSidebarViewModelParams): SidebarProps {
  return {
    ...params,
    upload: {
      ...params.upload,
      userIsAdmin: Boolean(params.account.user?.is_admin),
    },
    design: {
      sectionProps: params.design.sectionProps,
    },
  }
}
