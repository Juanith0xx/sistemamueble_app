import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Projects = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_name: '',
    design_estimated_days: 7
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API}/projects`);
      setProjects(response.data);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast.error('Error al cargar proyectos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/projects`, formData);
      toast.success('Proyecto creado exitosamente');
      setDialogOpen(false);
      setFormData({ name: '', description: '', client_name: '', design_estimated_days: 7 });
      fetchProjects();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear proyecto');
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
    return <div className="text-slate-500 font-mono uppercase text-sm">Cargando...</div>;
  }

  return (
    <div data-testid="projects-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-slate-900">
          Proyectos
        </h1>
        {user?.role === 'designer' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                data-testid="new-project-button"
                className="bg-orange-500 text-white hover:bg-orange-600 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Proyecto
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl uppercase tracking-tight">Crear Proyecto</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="create-project-form">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Nombre del Proyecto
                  </Label>
                  <Input
                    data-testid="project-name-input"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white focus:ring-offset-0 focus:border-orange-500 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Cliente
                  </Label>
                  <Input
                    data-testid="project-client-input"
                    required
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white focus:ring-offset-0 focus:border-orange-500 text-sm"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Descripción
                  </Label>
                  <Textarea
                    data-testid="project-description-input"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="rounded-sm border-slate-300 bg-slate-50 focus:bg-white focus:ring-offset-0 focus:border-orange-500 text-sm"
                    rows={3}
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Días Estimados de Diseño
                  </Label>
                  <Input
                    data-testid="project-days-input"
                    type="number"
                    min="1"
                    required
                    value={formData.design_estimated_days}
                    onChange={(e) => setFormData({ ...formData, design_estimated_days: parseInt(e.target.value) })}
                    className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white focus:ring-offset-0 focus:border-orange-500 font-mono text-sm"
                  />
                </div>

                <Button
                  data-testid="submit-project-button"
                  type="submit"
                  className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs transition-all active:scale-95"
                >
                  Crear Proyecto
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Proyecto</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Cliente</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Estado</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Creado</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Acción</th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500 text-sm">No hay proyectos</td>
              </tr>
            ) : (
              projects.map((project) => {
                const statusInfo = getStatusBadge(project.status);
                return (
                  <tr
                    key={project.project_id}
                    data-testid={`project-row-${project.project_id}`}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{project.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{project.client_name}</td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusInfo.className} inline-flex items-center rounded-sm px-2 py-1 text-xs font-mono font-medium ring-1 ring-inset`}>
                        {statusInfo.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                      {new Date(project.created_at).toLocaleDateString('es-ES')}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        data-testid={`view-project-${project.project_id}`}
                        onClick={() => navigate(`/projects/${project.project_id}`)}
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

export default Projects;