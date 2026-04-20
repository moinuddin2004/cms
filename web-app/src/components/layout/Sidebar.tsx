import { Link, useRouterState, useNavigate } from '@tanstack/react-router';
import { MapPin, Building2, LayoutDashboard, Users, MessageSquare, CalendarDays, UsersRound, FileText, BarChart3, CreditCard, HelpCircle, Bell, Settings, ChevronLeft, ChevronRight, LogOut, Loader2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';
import { useAuthStore } from '@/store/useAuthStore';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import apiClient from '@/lib/api';
import { toast } from 'sonner';
import { useState } from 'react';

interface NavItem {
    label: string;
    icon: React.ElementType;
    href: string;
    show?: (auth: ReturnType<typeof useAuthStore>) => boolean;
}

const mainNavItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Organizations', icon: Building2, href: '/organizations', show: (auth) => auth.isSuperAdmin },
    { label: 'Locations', icon: MapPin, href: '/locations', show: (auth) => auth.isSuperAdmin || auth.accessSource === 'owner' },
    { label: 'User Admin', icon: Shield, href: '/users' },
    { label: 'Patients', icon: Users, href: '/patients' },
    { label: 'Message', icon: MessageSquare, href: '/messages' },
    { label: 'Scheduling', icon: CalendarDays, href: '/scheduling' },
    { label: 'Teams', icon: UsersRound, href: '/teams' },
    { label: 'Medical Records', icon: FileText, href: '/medical-records' },
    { label: 'Reports', icon: BarChart3, href: '/reports' },
    { label: 'Billing & Payments', icon: CreditCard, href: '/billing' },
];

const bottomNavItems: NavItem[] = [
    { label: 'Help', icon: HelpCircle, href: '/help' },
    { label: 'Notification', icon: Bell, href: '/notifications' },
    { label: 'Settings', icon: Settings, href: '/settings' },
];

const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-blue-100 text-blue-700',
    DENTIST: 'bg-emerald-100 text-emerald-700',
    RECEPTIONIST: 'bg-purple-100 text-purple-700',
    SUPER_ADMIN: 'bg-slate-800 text-white',
};

export function Sidebar() {
    const { sidebarCollapsed, toggleSidebar } = useUIStore();
    const authStore = useAuthStore();
    const { user, clearAuth } = authStore;
    const routerState = useRouterState();
    const currentPath = routerState.location.pathname;
    const navigate = useNavigate();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await apiClient.post('/auth/logout');
            clearAuth();
            toast.success('Signed out successfully');
            navigate({ to: '/login' });
        } catch {
            clearAuth();
            navigate({ to: '/login' });
        }
    };

    // Generate initials from user name
    const getInitials = (name?: string) => {
        if (!name) return 'U';
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <aside
            className={cn(
                'fixed top-0 left-0 z-40 h-screen flex flex-col bg-white border-r border-border transition-all duration-300',
                sidebarCollapsed ? 'w-[var(--spacing-sidebar-collapsed)]' : 'w-[var(--spacing-sidebar)]',
            )}
        >
            {/* Logo & Collapse Toggle */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-border">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-primary to-emerald-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">M</span>
                    </div>
                    {!sidebarCollapsed && (
                        <span className="font-bold text-lg text-foreground whitespace-nowrap">
                            MedTrackr
                        </span>
                    )}
                </div>
                <button
                    onClick={toggleSidebar}
                    className="p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"
                    aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {sidebarCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>

            {/* Main Navigation */}
            <nav className="flex-1 py-4 px-3 overflow-y-auto">
                <ul className="space-y-1">
                    {mainNavItems.map((item) => {
                        if (item.show && !item.show(authStore)) return null;
                        const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
                        return (
                            <li key={item.href}>
                                <Link
                                    to={item.href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-primary/10 text-primary border border-primary/20'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                        sidebarCollapsed && 'justify-center px-2',
                                    )}
                                    title={sidebarCollapsed ? item.label : undefined}
                                >
                                    <item.icon size={20} className="flex-shrink-0" />
                                    {!sidebarCollapsed && <span>{item.label}</span>}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Bottom Section */}
            <div className="py-4 px-3 border-t border-border">
                <ul className="space-y-1 mb-4">
                    {bottomNavItems.map((item) => {
                        if (item.show && !item.show(authStore)) return null;
                        const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
                        return (
                            <li key={item.href}>
                                <Link
                                    to={item.href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                                        isActive
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                                        sidebarCollapsed && 'justify-center px-2',
                                    )}
                                    title={sidebarCollapsed ? item.label : undefined}
                                >
                                    <item.icon size={18} className="flex-shrink-0" />
                                    {!sidebarCollapsed && <span>{item.label}</span>}
                                </Link>
                            </li>
                        );
                    })}
                    {/* Logout */}
                    <li>
                        <button
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors',
                                sidebarCollapsed && 'justify-center px-2',
                            )}
                            title={sidebarCollapsed ? 'Sign out' : undefined}
                        >
                            {isLoggingOut ? (
                                <Loader2 size={18} className="flex-shrink-0 animate-spin" />
                            ) : (
                                <LogOut size={18} className="flex-shrink-0" />
                            )}
                            {!sidebarCollapsed && <span>Sign out</span>}
                        </button>
                    </li>
                </ul>

                <Separator className="mb-4" />

                {/* User Profile */}
                <Link
                    to="/settings"
                    className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent transition-colors cursor-pointer',
                        sidebarCollapsed && 'justify-center px-0',
                    )}
                >
                    <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {getInitials(user?.name)}
                        </AvatarFallback>
                    </Avatar>
                    {!sidebarCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                                {user?.name || 'User'}
                            </p>
                            <Badge
                                variant="secondary"
                                className={cn(
                                    'text-[10px] px-1.5 py-0 h-4 font-medium',
                                    ROLE_COLORS[user?.globalRole || ''] || 'bg-gray-100 text-gray-600'
                                )}
                            >
                                {user?.globalRole || 'Member'}
                            </Badge>
                        </div>
                    )}
                </Link>
            </div>
        </aside>
    );
}
