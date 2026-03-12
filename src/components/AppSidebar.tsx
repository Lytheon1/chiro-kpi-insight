import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { useDashboard } from '@/lib/context/DashboardContext';
import {
  Upload, FileText, Users, AlertTriangle, BarChart3, Shield, Database, Settings,
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
  const location = useLocation();
  const { isLoaded, allProviders, endOfDay } = useDashboard();

  const singleProvider = allProviders.length <= 1;

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="px-3 py-3">
        {!collapsed && (
          <div>
            <h1 className="text-sm font-bold tracking-tight text-sidebar-foreground">CTC KPI</h1>
            {isLoaded && singleProvider && allProviders[0] && (
              <p className="text-[10px] text-sidebar-foreground/60 mt-0.5 truncate">{allProviders[0]}</p>
            )}
          </div>
        )}
        {collapsed && <h1 className="text-xs font-bold text-center text-sidebar-foreground">CTC</h1>}
      </SidebarHeader>

      <SidebarContent>
        {/* Status Indicator */}
        {!collapsed && (
          <div className="px-3 mb-2">
            {isLoaded ? (
              <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/30 w-full justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                Reports Loaded
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/30 w-full justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-warning inline-block" />
                Upload Required
              </Badge>
            )}
          </div>
        )}

        {/* Main Navigation */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[9px] uppercase tracking-wider">Navigation</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter(i => i.group === 'main').map(item => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      end
                      className={({ isActive }) => cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Analysis Pages */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[9px] uppercase tracking-wider">Analysis</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter(i => i.group === 'analysis').map(item => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Data */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel className="text-[9px] uppercase tracking-wider">Data</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.filter(i => i.group === 'data').map(item => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) => cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-3 py-2">
        {!collapsed && isLoaded && endOfDay?.minDate && endOfDay?.maxDate && (
          <div className="text-[9px] text-sidebar-foreground/50 space-y-0.5">
            <div>{endOfDay.minDate} — {endOfDay.maxDate}</div>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
