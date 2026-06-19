import { Link, useLocation } from 'react-router-dom';
import { Download } from 'lucide-react';

function Header() {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Download', icon: Download },
    { path: '/downloads', label: 'Library', icon: Download },
  ];

  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span className="font-bold text-white">Spaces Downloader</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${location.pathname === item.path
                    ? 'bg-white/10 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded-full">
              Guest Mode
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
