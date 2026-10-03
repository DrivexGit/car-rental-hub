import { ReactNode, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellRing } from 'lucide-react';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { NotificationsProvider, enableStaffPush, useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <NotificationsProvider>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center justify-between border-b px-4">
              <SidebarTrigger />
              <HeaderActions />
            </header>
            <main className="flex-1 p-6 overflow-auto">
              {children}
            </main>
          </div>
        </div>
      </SidebarProvider>
    </NotificationsProvider>
  );
}

function HeaderActions() {
  const { unread } = useNotifications();
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));
  return (
    <div className="flex items-center gap-2">
      {perm === 'default' && (
        <Button size="sm" variant="outline" onClick={async () => setPerm(await enableStaffPush())}>
          <BellRing className="mr-2 h-4 w-4" /> Enable alerts
        </Button>
      )}
      <Link to="/notifications" className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-muted" aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">{unread}</span>}
      </Link>
    </div>
  );
}
