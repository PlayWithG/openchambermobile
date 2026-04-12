import React from 'react';
import {
  RiChat4Line,
  RiFolder6Line,
  RiGitBranchLine,
  RiTerminalBoxLine,
  RiSettings3Line,
} from '@remixicon/react';
import { useUIStore, type MainTab } from '@/stores/useUIStore';
import { cn } from '@/lib/utils';

type NavItem = {
  id: MainTab | 'settings';
  label: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'chat', label: 'Chat', icon: <RiChat4Line className="h-5 w-5" /> },
  { id: 'files', label: 'Files', icon: <RiFolder6Line className="h-5 w-5" /> },
  { id: 'git', label: 'Git', icon: <RiGitBranchLine className="h-5 w-5" /> },
  { id: 'terminal', label: 'Terminal', icon: <RiTerminalBoxLine className="h-5 w-5" /> },
  { id: 'settings', label: 'Settings', icon: <RiSettings3Line className="h-5 w-5" /> },
];

interface MobileBottomNavProps {
  /** When true, nav collapses (keyboard is open) */
  keyboardOpen?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ keyboardOpen = false }) => {
  const activeMainTab = useUIStore((state) => state.activeMainTab);
  const setActiveMainTab = useUIStore((state) => state.setActiveMainTab);
  const setSettingsDialogOpen = useUIStore((state) => state.setSettingsDialogOpen);

  const handleSelect = React.useCallback((item: NavItem) => {
    if (item.id === 'settings') {
      setSettingsDialogOpen(true);
      return;
    }
    setActiveMainTab(item.id as MainTab);
  }, [setActiveMainTab, setSettingsDialogOpen]);

  const isActive = (item: NavItem): boolean => {
    if (item.id === 'settings') return false;
    return activeMainTab === item.id;
  };

  return (
    <nav
      className={cn('mobile-bottom-nav', keyboardOpen && 'keyboard-open')}
      aria-label="Bottom navigation"
    >
      <div className="flex h-12 w-full items-center justify-around px-1">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-1 transition-colors',
                'min-w-[44px] min-h-[44px]',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {item.icon}
              {/* Active indicator dot */}
              {active && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
