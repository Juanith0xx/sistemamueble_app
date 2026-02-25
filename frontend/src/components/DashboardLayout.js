import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Bell, LogOut, Menu, X, Factory, LayoutDashboard, FolderKanban, GanttChart, ShoppingCart, Shield, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { Badge } from '@/components/ui/badge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API}/notifications`);
      setNotifications(response.data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const menuItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['all'] },
    { label: 'Estudios', path: '/studies', icon: FileText, roles: ['all'] },
    { label: 'Proyectos', path: '/projects', icon: FolderKanban, roles: ['all'] },
    { label: 'Gantt', path: '/gantt', icon: GanttChart, roles: ['all'] },
    { label: 'Ordenes de Compra', path: '/purchase-orders', icon: ShoppingCart, roles: ['purchasing', 'superadmin'] },
    { label: 'Panel Admin', path: '/admin', icon: Shield, roles: ['superadmin'] },
  ];

  const filteredMenu = menuItems.filter(item => 
    item.roles.includes('all') || item.roles.includes(user?.role)
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen bg-background font-body">
      {/* Sidebar */}
      <aside className={`bg-white border-r border-slate-200 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0 md:w-20'} overflow-hidden`}>
        <div className="h-full flex flex-col">
          <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
            {sidebarOpen && (
              <div className="flex items-center">
                <img src="/robfu-logo.png" alt="Robfu" className="h-8" />
              </div>
            )}
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 rounded-sm transition-colors md:hidden">
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {filteredMenu.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-4 h-10 rounded-sm text-xs font-bold uppercase tracking-wide transition-all ${
                    isActive 
                      ? 'bg-slate-900 text-white' 
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={1.5} />
                  {sidebarOpen && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-slate-200">
            {sidebarOpen && (
              <div className="mb-3">
                <div className="flex items-center gap-3 mb-2">
                  {user?.avatar_url ? (
                    <img
                      src={`${process.env.REACT_APP_BACKEND_URL}${user.avatar_url}`}
                      alt={user.name}
                      className="w-10 h-10 rounded-sm object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-sm bg-slate-200 flex items-center justify-center">
                      <span className="text-slate-600 font-bold text-sm">
                        {user?.name?.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-xs font-mono uppercase tracking-widest text-slate-400">Usuario</div>
                    <div className="text-sm font-medium text-slate-900">{user?.name}</div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 capitalize">{user?.role?.replace('_', ' ')}</span>
                      {user?.stars > 0 && (
                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-sm font-medium">
                          ⭐ {user.stars}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/profile')}
                  className="text-xs text-orange-500 hover:text-orange-600 font-medium"
                >
                  Ver perfil
                </button>
              </div>
            )}
            <Button
              data-testid="logout-button"
              onClick={handleLogout}
              variant="ghost"
              className="w-full justify-start gap-2 h-9 text-xs font-bold uppercase tracking-wide"
            >
              <LogOut className="w-4 h-4" />
              {sidebarOpen && 'Cerrar Sesión'}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)} 
            className="md:hidden p-2 hover:bg-slate-100 rounded-sm transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                data-testid="notifications-button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-slate-100 rounded-sm transition-colors relative"
              >
                <Bell className="w-5 h-5 text-slate-600" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-mono w-5 h-5 rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 rounded-sm shadow-lg z-50 max-h-96 overflow-y-auto">
                  <div className="p-3 border-b border-slate-200">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-slate-500">Notificaciones</h3>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-slate-500">No hay notificaciones</div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.notification_id}
                        className={`p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer ${
                          !notif.read ? 'bg-orange-50' : ''
                        }`}
                        onClick={async () => {
                          if (!notif.read) {
                            await axios.put(`${API}/notifications/${notif.notification_id}/read`);
                            fetchNotifications();
                          }
                        }}
                      >
                        <p className="text-sm text-slate-700">{notif.message}</p>
                        <p className="text-xs text-slate-400 mt-1 font-mono">
                          {new Date(notif.created_at).toLocaleString('es-ES')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;