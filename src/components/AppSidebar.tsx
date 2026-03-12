import { NavLink } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { useDashboard } from '@/lib/context/DashboardContext';
import {
  Upload, FileText, Users, AlertTriangle, BarChart3, Shield, Database,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { to: '/', label: 'Upload Reports', icon: Upload, group: 'main' },
  { to: '/executive-brief', label: 'Executive Brief', icon: FileText, group: 'analysis' },
  { to: '/patient-flow', label: 'Patient Flow', icon: Activity, group: 'analysis' },
  { to: '/patients-at-risk', label: 'Patients at Risk', icon: AlertTriangle, group: 'analysis' },
  { to: '/analysis', label: 'Operational Analysis', icon: BarChart3, group: 'analysis' },
  { to: '/patients', label: 'Patient Review', icon: Users, group: 'analysis' },
  { to: '/validation', label: 'Data Validation', icon: Shield, group: 'data' },
  { to: '/evidence', label: 'Evidence', icon: Database, group: 'data' },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { isLoaded, allProviders, endOfDay } = useDashboard();

  const singleProvider = allProviders.length <= 1;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="px-4 py-5 border-b border-sidebar-border">
        {!collapsed ? (
          <div>
            <h1 className="font-display text-[15px] leading-tight text-sidebar-foreground">
              Lakeside Spine<br />& Wellness
            </h1>
            <p className="text-[11px] text-sidebar-foreground/45 mt-0.5 font-light">
              Operational Intelligence
            </p>
            {isLoaded && (
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-sidebar-foreground/60 font-medium uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_4px] shadow-success inline-block" />
                {endOfDay?.minDate && endOfDay?.maxDate
                  ? `${endOfDay.minDate.slice(0, 7)} · Reports Loaded`
                  : 'Reports Loaded'}
              </div>
            )}
            {!isLoaded && (
              <div className="flex items-center gap-1.5 mt-2 text-[10px] text-sidebar-foreground/60 font-medium uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-warning shadow-[0_0_4px] shadow-warning inline-block" />
                Upload Required
              </div>
            )}
          </div>
        ) : (
          <h1 className="text-xs font-bold text-center text-sidebar-foreground">LS</h1>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Main */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter(i => i.group === 'main').map(item => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      end
                      className={({ isActive }) => cn(
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-all',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/90'
                      )}
                    >
                      <item.icon className="h-[15px] w-[15px] shrink-0 opacity-80" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-2.5 h-px bg-sidebar-border" />

        {/* Analysis */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 px-2.5">
              Analytics
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter(i => i.group === 'analysis').map(item => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => cn(
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-all',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/90'
                      )}
                    >
                      <item.icon className="h-[15px] w-[15px] shrink-0 opacity-80" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mx-2.5 h-px bg-sidebar-border" />

        {/* Data */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[9px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 px-2.5">
              Data
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter(i => i.group === 'data').map(item => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => cn(
                        'flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] transition-all',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-foreground font-medium'
                          : 'text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/90'
                      )}
                    >
                      <item.icon className="h-[15px] w-[15px] shrink-0 opacity-80" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-3">
        {!collapsed && isLoaded && endOfDay?.minDate && endOfDay?.maxDate && (
          <div className="text-[9px] text-sidebar-foreground/40 space-y-0.5">
            <div>{endOfDay.minDate} — {endOfDay.maxDate}</div>
            {singleProvider && allProviders[0] && (
              <div>{allProviders[0]}</div>
            )}
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}