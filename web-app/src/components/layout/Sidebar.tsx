import { Link, useRouterState } from '@tanstack/react-router';
import {
    LayoutDashboard,
    Users,
    MessageSquare,
    CalendarDays,
    UsersRound,
    FileText,
    BarChart3,
    CreditCard,
    HelpCircle,
    Bell,
    Settings,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

interface NavItem {
    label: string;
    icon: React.ElementType;
    href: string;
}

const mainNavItems: NavItem[] = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/' },
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

export function Sidebar() {
    const { sidebarCollapsed, toggleSidebar } = useUIStore();
    const routerState = useRouterState();
    const currentPath = routerState.location.pathname;

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
                    <div className="flex-shrink-0 w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
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
                        const isActive = currentPath === item.href;
                        return (
                            <li key={item.href}>
                                <Link
                                    to={item.href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                                        isActive
                                            ? 'bg-brand-50 text-brand-700 border border-brand-200'
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
                    {bottomNavItems.map((item) => (
                        <li key={item.href}>
                            <Link
                                to={item.href}
                                className={cn(
                                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                                    sidebarCollapsed && 'justify-center px-2',
                                )}
                                title={sidebarCollapsed ? item.label : undefined}
                            >
                                <item.icon size={18} className="flex-shrink-0" />
                                {!sidebarCollapsed && <span>{item.label}</span>}
                            </Link>
                        </li>
                    ))}
                </ul>

                <Separator className="mb-4" />

                {/* User Profile */}
                <div
                    className={cn(
                        'flex items-center gap-3 px-3 py-2',
                        sidebarCollapsed && 'justify-center px-0',
                    )}
                >
                    <Avatar className="w-9 h-9 flex-shrink-0">
                        <AvatarFallback className="bg-brand-100 text-brand-700 text-sm font-semibold">
                            TW
                        </AvatarFallback>
                    </Avatar>
                    {!sidebarCollapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">Theresa Webb</p>
                            <p className="text-xs text-muted-foreground">Admin</p>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}
