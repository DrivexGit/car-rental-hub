import {
  LayoutDashboard, Users, MessageSquare, Car, Calendar, BookOpen, HelpCircle, LogOut, ClipboardList, Globe,
  Bell, UserRound, Receipt, TriangleAlert, Gift, Images
} from 'lucide-react';

import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Leads / CRM', url: '/leads', icon: Users },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
  { title: 'Vehicles', url: '/vehicles', icon: Car },
  { title: 'Car photos', url: '/car-photos', icon: Images },
  { title: 'Notifications', url: '/notifications', icon: Bell },
  { title: 'Reservations', url: '/reservations', icon: ClipboardList },
  { title: 'App customers', url: '/customers', icon: UserRound },
  { title: 'Invoices', url: '/invoices', icon: Receipt },
  { title: 'Fines & Salik', url: '/fines', icon: TriangleAlert },
  { title: 'Offers', url: '/offers', icon: Gift },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'Documents', url: '/documents', icon: BookOpen },
  { title: 'FAQ', url: '/faq', icon: HelpCircle },
  { title: 'Site Multipliers', url: '/site-multipliers', icon: Globe },
];


export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { signOut, staffProfile } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && 'CarBox'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end={item.url === '/'} className="hover:bg-muted/50" activeClassName="bg-muted text-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && staffProfile && (
          <p className="px-3 text-xs text-muted-foreground truncate">{staffProfile.full_name}</p>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && 'Sign Out'}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
