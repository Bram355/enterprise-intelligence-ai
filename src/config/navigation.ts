import { Bot, FileText, LayoutDashboard, Settings, Wrench, type LucideIcon } from 'lucide-react'
import type { Permission } from '../lib/permissions'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  description: string
  permission?: Permission
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview of knowledge and activity' },
  { to: '/assistant', label: 'AI Assistant', icon: Bot, description: 'Ask questions about approved knowledge' },
  { to: '/library', label: 'Knowledge Library', icon: FileText, description: 'Upload, organise and search documents' },
  { to: '/support', label: 'Technical Support', icon: Wrench, description: 'Guided troubleshooting workflows' },
  { to: '/admin', label: 'Administration', icon: Settings, description: 'Users, roles, departments and audit logs', permission: 'admin.view' },
]
