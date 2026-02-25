import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Plus, Clock, CheckCircle2, AlertCircle, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const projectsRes = await axios.get(`${API}/projects`);
      setProjects(projectsRes.data);

      const activeCount = projectsRes.data.filter(p => p.status !== 'completed').length;
      const completedCount = projectsRes.data.filter(p => p.status === 'completed').length;
      
      setStats({
        total: projectsRes.data.length,
        active: activeCount,
        completed: completedCount
      });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      draft: { label: 'Borrador', className: 'bg-slate-50 text-slate-600 ring-slate-500/10' },
      design: { label: 'Diseño', className: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
      validation: { label: 'Validación', className: 'bg-purple-50 text-purple-700 ring-purple-600/20' },
      purchasing: { label: 'Compras', className: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20' },
      warehouse: { label: 'Bodega', className: 'bg-orange-50 text-orange-700 ring-orange-600/20' },
      manufacturing: { label: 'Fabricación', className: 'bg-cyan-50 text-cyan-700 ring-cyan-600/20' },
      completed: { label: 'Completado', className: 'bg-green-50 text-green-700 ring-green-600/20' }
    };
    return statusMap[status] || statusMap.draft;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-500 font-mono uppercase text-sm">Cargando...</div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="text-sm text-slate-600 mt-1">Bienvenido, {user?.name}</p>
        </div>
        {user?.role === 'designer' && (
          <Button
            data-testid="create-project-button"
            onClick={() => navigate('/projects')}
            className="bg-orange-500 text-white hover:bg-orange-600 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs shadow-sm hover:shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Proyecto
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6">
        <div className="bg-white border border-slate-200 rounded-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">Total Proyectos</div>
              <div className="text-3xl font-heading font-bold text-slate-900">{stats?.total || 0}</div>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-sm flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">Activos</div>
              <div className="text-3xl font-heading font-bold text-orange-500">{stats?.active || 0}</div>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-sm flex items-center justify-center">
              <Clock className="w-6 h-6 text-orange-600" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">Completados</div>
              <div className="text-3xl font-heading font-bold text-green-600">{stats?.completed || 0}</div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-sm flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white border border-slate-200 rounded-sm">
        <div className="p-5 border-b border-slate-200">
          <h2 className="font-mono text-xs uppercase tracking-wider text-slate-500">Proyectos Recientes</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {projects.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500 text-sm">No hay proyectos aún</p>
            </div>
          ) : (
            projects.slice(0, 5).map((project) => {
              const statusInfo = getStatusBadge(project.status);
              return (
                <div
                  key={project.project_id}
                  data-testid={`project-item-${project.project_id}`}
                  onClick={() => navigate(`/projects/${project.project_id}`)}
                  className="p-4 hover:bg-slate-50/50 transition-colors cursor-pointer flex items-center justify-between"
                >
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-slate-900">{project.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{project.client_name}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge className={`${statusInfo.className} inline-flex items-center rounded-sm px-2 py-1 text-xs font-mono font-medium ring-1 ring-inset`}>
                      {statusInfo.label}
                    </Badge>
                    <div className="text-xs text-slate-400 font-mono">
                      {new Date(project.created_at).toLocaleDateString('es-ES')}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;