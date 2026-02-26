import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Chart } from 'react-google-charts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertCircle, CheckCircle, Clock, TrendingUp, X, Eye, ChevronRight, Users, UserCheck, UserX, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState(null);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [ganttData, setGanttData] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [togglingUser, setTogglingUser] = useState(null);

  useEffect(() => {
    if (user?.role !== 'superadmin') {
      toast.error('No tienes permisos para acceder a esta página');
      navigate('/');
      return;
    }
    fetchKPIs();
    fetchUsers();
  }, [user]);

  const fetchKPIs = async () => {
    try {
      const response = await axios.get(`${API}/dashboard/kpis`);
      setKpis(response.data);
    } catch (error) {
      console.error('Error fetching KPIs:', error);
      toast.error('Error al cargar KPIs');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await axios.get(`${API}/admin/users`);
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoadingUsers(false);
    }
  };

  const toggleUserAccess = async (userId) => {
    setTogglingUser(userId);
    try {
      const response = await axios.put(`${API}/admin/users/${userId}/toggle-access`);
      toast.success(response.data.message);
      fetchUsers(); // Refresh user list
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al cambiar estado del usuario');
    } finally {
      setTogglingUser(null);
    }
  };

  const getRoleBadge = (role) => {
    const roleMap = {
      superadmin: { label: 'Administrador', className: 'bg-purple-100 text-purple-700' },
      designer: { label: 'Diseñador', className: 'bg-blue-100 text-blue-700' },
      manufacturing_chief: { label: 'Jefe Fabricación', className: 'bg-cyan-100 text-cyan-700' },
      purchasing: { label: 'Compras', className: 'bg-yellow-100 text-yellow-700' },
      warehouse: { label: 'Bodega', className: 'bg-orange-100 text-orange-700' }
    };
    return roleMap[role] || { label: role, className: 'bg-slate-100 text-slate-700' };
  };

  const handleFilterClick = async (filterType) => {
    if (selectedFilter === filterType) {
      setSelectedFilter(null);
      setFilteredProjects([]);
      setGanttData([]);
      return;
    }

    setSelectedFilter(filterType);
    
    try {
      // Fetch projects with the specific filter
      const response = await axios.get(`${API}/dashboard/projects-by-status?status=${filterType}`);
      setFilteredProjects(response.data.projects);
      
      // Format Gantt data
      if (response.data.gantt_tasks && response.data.gantt_tasks.length > 0) {
        const chartData = [
          [
            { type: 'string', label: 'Task ID' },
            { type: 'string', label: 'Task Name' },
            { type: 'string', label: 'Resource' },
            { type: 'date', label: 'Start Date' },
            { type: 'date', label: 'End Date' },
            { type: 'number', label: 'Duration' },
            { type: 'number', label: 'Percent Complete' },
            { type: 'string', label: 'Dependencies' },
          ]
        ];

        response.data.gantt_tasks.forEach(task => {
          const startDate = new Date(task.start);
          const endDate = new Date(task.end);
          chartData.push([
            task.id,
            task.name,
            task.project_name,
            startDate,
            endDate,
            null,
            task.progress,
            null
          ]);
        });
        
        setGanttData(chartData);
      } else {
        setGanttData([]);
      }
    } catch (error) {
      console.error('Error fetching filtered projects:', error);
      toast.error('Error al cargar proyectos');
    }
  };

  const getFilterLabel = (filter) => {
    const labels = {
      'total': 'Todos los Proyectos',
      'on_time': 'Proyectos A Tiempo',
      'at_risk': 'Proyectos En Riesgo',
      'delayed': 'Proyectos Retrasados'
    };
    return labels[filter] || filter;
  };

  const getFilterColor = (filter) => {
    const colors = {
      'total': '#475569',
      'on_time': '#16A34A',
      'at_risk': '#CA8A04',
      'delayed': '#DC2626'
    };
    return colors[filter] || '#475569';
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
    return <div className="text-slate-500 font-mono uppercase text-sm">Cargando...</div>;
  }

  const chartData = [
    { stage: 'Diseño', retrasos: kpis?.delays_by_stage?.design || 0 },
    { stage: 'Validación', retrasos: kpis?.delays_by_stage?.validation || 0 },
    { stage: 'Compras', retrasos: kpis?.delays_by_stage?.purchasing || 0 },
    { stage: 'Bodega', retrasos: kpis?.delays_by_stage?.warehouse || 0 },
    { stage: 'Fabricación', retrasos: kpis?.delays_by_stage?.manufacturing || 0 }
  ];

  const ganttOptions = {
    height: Math.max(200, filteredProjects.length * 80),
    gantt: {
      trackHeight: 35,
      barHeight: 25,
      criticalPathEnabled: false,
      arrow: {
        angle: 100,
        width: 2,
        color: '#F97316',
        radius: 0
      },
      palette: [
        { color: getFilterColor(selectedFilter), dark: getFilterColor(selectedFilter), light: getFilterColor(selectedFilter) + '60' }
      ]
    }
  };

  return (
    <div data-testid="admin-panel">
      <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-slate-900 mb-6">
        Panel de Administración
      </h1>

      {/* KPI Cards - Now Clickable */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div 
          onClick={() => handleFilterClick('total')}
          className={`bg-white border-2 rounded-sm p-5 cursor-pointer transition-all hover:shadow-md ${
            selectedFilter === 'total' ? 'border-slate-600 ring-2 ring-slate-200' : 'border-slate-200 hover:border-slate-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">Total Proyectos</div>
              <div className="text-3xl font-heading font-bold text-slate-900">{kpis?.total_projects || 0}</div>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-sm flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-2">Click para ver detalles</div>
        </div>

        <div 
          onClick={() => handleFilterClick('on_time')}
          className={`bg-white border-2 rounded-sm p-5 cursor-pointer transition-all hover:shadow-md ${
            selectedFilter === 'on_time' ? 'border-green-600 ring-2 ring-green-200' : 'border-green-200 hover:border-green-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">A Tiempo</div>
              <div className="text-3xl font-heading font-bold text-green-600">{kpis?.on_time_projects || 0}</div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-sm flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-xs text-green-500 mt-2">Click para ver detalles</div>
        </div>

        <div 
          onClick={() => handleFilterClick('at_risk')}
          className={`bg-white border-2 rounded-sm p-5 cursor-pointer transition-all hover:shadow-md ${
            selectedFilter === 'at_risk' ? 'border-yellow-600 ring-2 ring-yellow-200' : 'border-yellow-200 hover:border-yellow-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">En Riesgo</div>
              <div className="text-3xl font-heading font-bold text-yellow-600">{kpis?.at_risk_projects || 0}</div>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-sm flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-xs text-yellow-500 mt-2">Click para ver detalles</div>
        </div>

        <div 
          onClick={() => handleFilterClick('delayed')}
          className={`bg-white border-2 rounded-sm p-5 cursor-pointer transition-all hover:shadow-md ${
            selectedFilter === 'delayed' ? 'border-red-600 ring-2 ring-red-200' : 'border-red-200 hover:border-red-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">Retrasados</div>
              <div className="text-3xl font-heading font-bold text-red-600">{kpis?.delayed_projects || 0}</div>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-sm flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-xs text-red-500 mt-2">Click para ver detalles</div>
        </div>
      </div>

      {/* Filtered Projects Section */}
      {selectedFilter && (
        <div className="mb-6 bg-white border-2 rounded-sm overflow-hidden" style={{ borderColor: getFilterColor(selectedFilter) }}>
          <div 
            className="px-5 py-4 flex items-center justify-between"
            style={{ backgroundColor: getFilterColor(selectedFilter) + '15' }}
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-2 h-8 rounded-sm"
                style={{ backgroundColor: getFilterColor(selectedFilter) }}
              />
              <div>
                <h3 className="font-bold text-slate-900 uppercase tracking-wide">
                  {getFilterLabel(selectedFilter)}
                </h3>
                <p className="text-xs text-slate-500">{filteredProjects.length} proyectos</p>
              </div>
            </div>
            <Button
              onClick={() => { setSelectedFilter(null); setFilteredProjects([]); setGanttData([]); }}
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-slate-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Projects List */}
          <div className="border-b border-slate-200">
            <div className="p-4">
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">Lista de Proyectos</div>
              {filteredProjects.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-sm">No hay proyectos en esta categoría</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredProjects.map((project) => {
                    const statusInfo = getStatusBadge(project.status);
                    return (
                      <div
                        key={project.project_id}
                        onClick={() => navigate(`/projects/${project.project_id}`)}
                        className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-sm cursor-pointer transition-colors"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm text-slate-900">{project.name}</h4>
                          <p className="text-xs text-slate-500">{project.client_name}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge className={`${statusInfo.className} inline-flex items-center rounded-sm px-2 py-1 text-xs font-mono font-medium ring-1 ring-inset`}>
                            {statusInfo.label}
                          </Badge>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Gantt Chart for Filtered Projects */}
          {ganttData.length > 1 && (
            <div className="p-4">
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">Diagrama de Gantt</div>
              <Chart
                chartType="Gantt"
                width="100%"
                data={ganttData}
                options={ganttOptions}
              />
            </div>
          )}
        </div>
      )}

      {/* Traffic Light Summary */}
      <div className="bg-white border border-slate-200 rounded-sm p-6 mb-6">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">Semáforo de Proyectos</div>
        <div className="flex items-center gap-8">
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => handleFilterClick('on_time')}
          >
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-2xl font-heading font-bold text-white">{kpis?.on_time_projects || 0}</span>
            </div>
            <div>
              <div className="font-semibold text-sm text-slate-900">Verde</div>
              <div className="text-xs text-slate-500">A tiempo</div>
            </div>
          </div>
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => handleFilterClick('at_risk')}
          >
            <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center">
              <span className="text-2xl font-heading font-bold text-white">{kpis?.at_risk_projects || 0}</span>
            </div>
            <div>
              <div className="font-semibold text-sm text-slate-900">Amarillo</div>
              <div className="text-xs text-slate-500">En riesgo</div>
            </div>
          </div>
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => handleFilterClick('delayed')}
          >
            <div className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-2xl font-heading font-bold text-white">{kpis?.delayed_projects || 0}</span>
            </div>
            <div>
              <div className="font-semibold text-sm text-slate-900">Rojo</div>
              <div className="text-xs text-slate-500">Retrasado</div>
            </div>
          </div>
        </div>
      </div>

      {/* Delays by Stage Chart */}
      <div className="bg-white border border-slate-200 rounded-sm p-6">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">
          Retrasos por Departamento
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="stage" 
              tick={{ fill: '#64748B', fontSize: 12, fontFamily: 'JetBrains Mono' }}
            />
            <YAxis 
              tick={{ fill: '#64748B', fontSize: 12, fontFamily: 'JetBrains Mono' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#FFFFFF', 
                border: '1px solid #CBD5E1', 
                borderRadius: '2px',
                fontFamily: 'Manrope'
              }}
            />
            <Bar dataKey="retrasos" fill="#F97316" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default AdminPanel;