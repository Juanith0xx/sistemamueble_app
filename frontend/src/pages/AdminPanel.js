import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminPanel = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'superadmin') {
      toast.error('No tienes permisos para acceder a esta página');
      navigate('/');
      return;
    }
    fetchKPIs();
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

  return (
    <div data-testid="admin-panel">
      <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-slate-900 mb-6">
        Panel de Administración
      </h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
        <div className="bg-white border border-slate-200 rounded-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">Total Proyectos</div>
              <div className="text-3xl font-heading font-bold text-slate-900">{kpis?.total_projects || 0}</div>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-sm flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-slate-600" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-green-200 rounded-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">A Tiempo</div>
              <div className="text-3xl font-heading font-bold text-green-600">{kpis?.on_time_projects || 0}</div>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-sm flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-yellow-200 rounded-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">En Riesgo</div>
              <div className="text-3xl font-heading font-bold text-yellow-600">{kpis?.at_risk_projects || 0}</div>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-sm flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" strokeWidth={1.5} />
            </div>
          </div>
        </div>

        <div className="bg-white border border-red-200 rounded-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">Retrasados</div>
              <div className="text-3xl font-heading font-bold text-red-600">{kpis?.delayed_projects || 0}</div>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-sm flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" strokeWidth={1.5} />
            </div>
          </div>
        </div>
      </div>

      {/* Traffic Light Summary */}
      <div className="bg-white border border-slate-200 rounded-sm p-6 mb-6">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">Semáforo de Proyectos</div>
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-2xl font-heading font-bold text-white">{kpis?.on_time_projects || 0}</span>
            </div>
            <div>
              <div className="font-semibold text-sm text-slate-900">Verde</div>
              <div className="text-xs text-slate-500">A tiempo</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center">
              <span className="text-2xl font-heading font-bold text-white">{kpis?.at_risk_projects || 0}</span>
            </div>
            <div>
              <div className="font-semibold text-sm text-slate-900">Amarillo</div>
              <div className="text-xs text-slate-500">En riesgo</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
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