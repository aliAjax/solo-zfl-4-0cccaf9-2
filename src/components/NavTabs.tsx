import { Link, useLocation } from 'react-router-dom';
import { BookOpen, FlaskConical } from 'lucide-react';

export default function NavTabs() {
  const { pathname } = useLocation();
  const tabs = [
    { to: '/', label: '气味档案', icon: BookOpen, active: pathname === '/' },
    { to: '/blend', label: '调香台', icon: FlaskConical, active: pathname.startsWith('/blend') },
  ];
  return (
    <nav className="mt-5 flex gap-2">
      {tabs.map((t) => (
        <Link
          key={t.to}
          to={t.to}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
            t.active
              ? 'bg-ochre-500 text-paper-50 border-ochre-500 shadow-paper'
              : 'bg-paper-100/70 text-ink-700 border-paper-300 hover:bg-paper-200'
          }`}
        >
          <t.icon className="w-4 h-4" />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
