import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Eye, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Studies = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studies, setStudies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_name: ''
  });

  useEffect(() => {
    fetchStudies();
  }, []);

  const fetchStudies = async () => {
    try {
      const response = await axios.get(`${API}/studies`);
      setStudies(response.data);
    } catch (error) {
      console.error('Error fetching studies:', error);
      toast.error('Error al cargar estudios');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API}/studies`, formData);
      toast.success('Estudio creado exitosamente');
      setDialogOpen(false);
      setFormData({ name: '', description: '', client_name: '' });
      navigate(`/studies/${response.data.study_id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear estudio');
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      draft: { label: 'Borrador', className: 'bg-slate-50 text-slate-600 ring-slate-500/10' },
      in_review: { label: 'En Revisión', className: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
      approved: { label: 'Aprobado', className: 'bg-green-50 text-green-700 ring-green-600/20' },
      rejected: { label: 'Rechazado', className: 'bg-red-50 text-red-700 ring-red-600/20' }
    };
    return statusMap[status] || statusMap.draft;
  };

  if (loading) {
    return <div className="text-slate-500 font-mono uppercase text-sm">Cargando...</div>;
  }

  return (
    <div data-testid="studies-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-slate-900">
            Estudios de Proyectos
          </h1>
          <p className="text-sm text-slate-600 mt-1">Simula tiempos antes de iniciar proyectos reales</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="new-study-button"
              className="bg-orange-500 text-white hover:bg-orange-600 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Estudio
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-white">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl uppercase tracking-tight">Crear Estudio</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Nombre del Proyecto
                </Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Cliente
                </Label>
                <Input
                  required
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Descripción
                </Label>
                <Textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="rounded-sm border-slate-300 bg-slate-50 focus:bg-white text-sm"
                  rows={3}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs transition-all active:scale-95"
              >
                Crear Estudio
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Proyecto</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Cliente</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Estado</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Duración</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Creado por</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Fecha</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Acción</th>
            </tr>
          </thead>
          <tbody>
            {studies.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-8 text-slate-500 text-sm">No hay estudios</td>
              </tr>
            ) : (
              studies.map((study) => {
                const statusInfo = getStatusBadge(study.status);
                return (
                  <tr
                    key={study.study_id}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{study.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{study.client_name}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusInfo.className} inline-flex items-center rounded-sm px-2 py-1 text-xs font-mono font-medium ring-1 ring-inset`}>
                        {statusInfo.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-slate-700">{study.total_estimated_days} días</td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {study.created_by_name || 'Desconocido'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                      {new Date(study.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        data-testid={`view-study-${study.study_id}`}
                        onClick={() => navigate(`/studies/${study.study_id}`)}
                        variant="ghost"
                        size="sm"
                        className="hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-sm h-8 px-3 font-medium text-xs uppercase tracking-wide transition-colors"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Studies;
