import Dashboard from '@mui/icons-material/Dashboard';
import Book from '@mui/icons-material/Book';
import School from '@mui/icons-material/School';
import TrendingUp from '@mui/icons-material/TrendingUp';
import Notifications from '@mui/icons-material/Notifications';
import Settings from '@mui/icons-material/Settings';
import AdminPanelSettings from '@mui/icons-material/AdminPanelSettings';
import WorkOutline from '@mui/icons-material/WorkOutline';
import AssignmentInd from '@mui/icons-material/AssignmentInd';

/**
 * Single source of truth for primary app navigation (sidebar).
 * Navbar no longer duplicates these links.
 */
export const SIDEBAR_NAV = [
  { text: 'Dashboard', path: '/dashboard', Icon: Dashboard, roles: ['admin', 'instructor', 'student'] },
  { text: 'Browse courses', path: '/courses', Icon: School, roles: ['admin', 'instructor', 'student'] },
  { text: 'My courses', path: '/my-courses', Icon: Book, roles: ['student', 'instructor'] },
  { text: 'Workspace', path: '/student', Icon: WorkOutline, roles: ['student'] },
  { text: 'Instructor hub', path: '/instructor', Icon: AssignmentInd, roles: ['instructor'] },
  { text: 'Admin', path: '/admin', Icon: AdminPanelSettings, roles: ['admin'] },
  { text: 'My progress', path: '/my-progress', Icon: TrendingUp, roles: ['student'] },
  { text: 'Notifications', path: '/notifications', Icon: Notifications, roles: ['student'] },
  { text: 'Profile', path: '/profile', Icon: Settings, roles: ['admin', 'instructor', 'student'] },
];

export function navItemActive(pathname, itemPath) {
  if (itemPath === '/dashboard') return pathname === '/dashboard';
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}
