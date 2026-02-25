import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Download, CheckCircle, Clock, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const StudyDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [estimates, setEstimates] = useState({
    design: { days: 0, notes: '' },
    validation: { days: 0, notes: '' },
    purchasing: { days: 0, notes: '' },
    warehouse: { days: 0, notes: '' },
    manufacturing: { days: 0, notes: '' }
  });

  useEffect(() => {
    fetchStudy();
  }, [id]);

  const fetchStudy = async () => {
    try {
      const response = await axios.get(`${API}/studies/${id}`);
      setStudy(response.data);
      
      // Pre-fill estimates
      setEstimates({
        design: { 
          days: response.data.design_stage.estimated_days || 0, 
          notes: response.data.design_stage.notes || '' 
        },
        validation: { 
          days: response.data.validation_stage.estimated_days || 0, 
          notes: response.data.validation_stage.notes || '' 
        },
        purchasing: { 
          days: response.data.purchasing_stage.estimated_days || 0, 
          notes: response.data.purchasing_stage.notes || '' 
        },
        warehouse: { 
          days: response.data.warehouse_stage.estimated_days || 0, 
          notes: response.data.warehouse_stage.notes || '' 
        },
        manufacturing: { 
          days: response.data.manufacturing_stage.estimated_days || 0, 
          notes: response.data.manufacturing_stage.notes || '' 
        }
      });
    } catch (error) {
      console.error('Error fetching study:', error);
      toast.error('Error al cargar estudio');
    } finally {
      setLoading(false);
    }
  };

  const handleEstimateUpdate = async (stage) => {
    try {
      await axios.put(`${API}/studies/${id}/estimate/${stage}`, {
        estimated_days: parseInt(estimates[stage].days),
        notes: estimates[stage].notes
      });
      toast.success('Estimación actualizada');
      fetchStudy();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar estimación');
    }
  };

  const handleExportPDF = async () => {
    try {
      toast.info('Generando PDF...');
      const response = await axios.get(`${API}/studies/${id}/pdf`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `estudio_${study.name.replace(/\s+/g, '_')}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF descargado exitosamente');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Error al exportar PDF');
    }
  };

  const handleApprove = async () => {
    if (!window.confirm('¿Aprobar este estudio e iniciar el proyecto real?')) return;
    
    try {
      const response = await axios.post(`${API}/studies/${id}/approve`);
      toast.success('¡Proyecto iniciado exitosamente!');
      navigate(`/projects/${response.data.project_id}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al aprobar estudio');
    }
  };

  const canEditStage = (stage) => {
    const permissions = {
      design: ['designer', 'superadmin'],
      validation: ['manufacturing_chief', 'superadmin'],
      purchasing: ['purchasing', 'superadmin'],
      warehouse: ['purchasing', 'warehouse', 'superadmin'],  // Compras puede editar ambos
      manufacturing: ['designer', 'superadmin']
    };
    return permissions[stage]?.includes(user?.role);
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

  const getStageProgress = () => {
    if (!study) return 0;
    const stages = [
      study.design_stage.estimated_days > 0,
      study.validation_stage.estimated_days > 0,
      study.purchasing_stage.estimated_days > 0,
      study.warehouse_stage.estimated_days > 0,
      study.manufacturing_stage.estimated_days > 0
    ];
    const completed = stages.filter(Boolean).length;
    return (completed / 5) * 100;
  };

  if (loading) {
    return <div className="text-slate-500 font-mono uppercase text-sm">Cargando...</div>;
  }

  if (!study) {
    return <div className="text-slate-500">Estudio no encontrado</div>;
  }

  const statusInfo = getStatusBadge(study.status);

  const stages = [
    { 
      key: 'design', 
      label: 'Diseño', 
      data: study.design_stage,
      icon: '📐',
      color: 'blue'
    },
    { 
      key: 'validation', 
      label: 'Validación Técnica', 
      data: study.validation_stage,
      icon: '✓',
      color: 'purple'
    },
    { 
      key: 'purchasing', 
      label: 'Compras', 
      data: study.purchasing_stage,
      icon: '🛒',
      color: 'yellow'
    },
    { 
      key: 'warehouse', 
      label: 'Bodega / Recepción', 
      data: study.warehouse_stage,
      icon: '📦',
      color: 'orange'
    },
    { 
      key: 'manufacturing', 
      label: 'Fabricación', 
      data: study.manufacturing_stage,
      icon: '🏭',
      color: 'cyan'
    }
  ];

  return (
    <div data-testid="study-detail-page">
      <Button
        onClick={() => navigate('/studies')}
        variant="ghost"
        className="mb-4 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-sm px-4 h-9 font-medium text-xs uppercase tracking-wide transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a Estudios
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-slate-900">
            {study.name}
          </h1>
          <p className="text-sm text-slate-600 mt-1">Cliente: {study.client_name}</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleExportPDF}
            variant="outline"
            className="rounded-sm px-4 h-10 text-xs font-bold uppercase tracking-wide"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
          {study.status === 'draft' && (user?.role === 'superadmin' || user?.user_id === study.created_by) && (
            <Button
              onClick={handleApprove}
              className="bg-green-600 text-white hover:bg-green-700 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Aprobar e Iniciar Proyecto
            </Button>
          )}
        </div>
      </div>

      {/* Status and Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white border border-slate-200 rounded-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Estado</span>
            <Badge className={`${statusInfo.className} inline-flex items-center rounded-sm px-2 py-1 text-xs font-mono font-medium ring-1 ring-inset`}>
              {statusInfo.label}
            </Badge>
          </div>
          <div className="text-xs text-slate-500 space-y-1">
            <div>Creado: {new Date(study.created_at).toLocaleDateString('es-ES')}</div>
            {study.estimated_start_date && (
              <div>Inicio estimado: {new Date(study.estimated_start_date).toLocaleDateString('es-ES')}</div>
            )}
            {study.estimated_end_date && (
              <div>Fin estimado: {new Date(study.estimated_end_date).toLocaleDateString('es-ES')}</div>
            )}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">Duración Total</span>
            <span className="text-2xl font-heading font-bold text-orange-500">{study.total_estimated_days} días</span>
          </div>
          <div className="space-y-2">
            <div className="text-xs text-slate-500">Progreso de estimaciones</div>
            <Progress value={getStageProgress()} className="h-2" />
            <div className="text-xs text-slate-500 text-right">{Math.round(getStageProgress())}% completado</div>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="bg-white border border-slate-200 rounded-sm p-5 mb-6">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">Descripción</div>
        <p className="text-sm text-slate-700">{study.description}</p>
      </div>

      {/* Stages Estimation Forms */}
      <div className="space-y-4">
        {stages.map((stage) => {
          const canEdit = canEditStage(stage.key);
          const hasEstimate = stage.data.estimated_days > 0;

          return (
            <div
              key={stage.key}
              className={`bg-white border rounded-sm overflow-hidden ${
                canEdit ? 'border-orange-200' : 'border-slate-200'
              }`}
            >
              <div className={`p-4 ${canEdit ? 'bg-orange-50' : 'bg-slate-50'} border-b border-slate-200`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{stage.icon}</span>
                    <div>
                      <h3 className="font-semibold text-sm text-slate-900">{stage.label}</h3>
                      {stage.data.estimated_by && (
                        <p className="text-xs text-slate-500 mt-1">
                          Estimado por: {stage.data.estimated_by} el {new Date(stage.data.estimated_at).toLocaleDateString('es-ES')}
                        </p>
                      )}
                    </div>
                  </div>
                  {hasEstimate ? (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-green-600" />
                      <span className="text-lg font-mono font-bold text-green-600">
                        {stage.data.estimated_days} días
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-mono uppercase">Pendiente</span>
                  )}
                </div>
              </div>

              <div className="p-4">
                {canEdit ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                          Días Estimados
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          value={estimates[stage.key].days}
                          onChange={(e) => setEstimates({
                            ...estimates,
                            [stage.key]: { ...estimates[stage.key], days: e.target.value }
                          })}
                          className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white font-mono text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                          Notas (Opcional)
                        </Label>
                        <Input
                          value={estimates[stage.key].notes}
                          onChange={(e) => setEstimates({
                            ...estimates,
                            [stage.key]: { ...estimates[stage.key], notes: e.target.value }
                          })}
                          placeholder="Ej: Proceso complejo, requiere proveedores especiales"
                          className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => handleEstimateUpdate(stage.key)}
                      className="bg-orange-500 text-white hover:bg-orange-600 rounded-sm px-4 h-9 text-xs font-bold uppercase tracking-wide"
                    >
                      Guardar Estimación
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">
                    {stage.data.notes ? (
                      <div>
                        <span className="font-medium">Notas:</span> {stage.data.notes}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">
                        Esta etapa debe ser estimada por otro departamento
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Timeline Visualization - Gantt Mejorado */}
      {study.total_estimated_days > 0 && (
        <div className="mt-6 bg-white border border-slate-200 rounded-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Diagrama de Gantt - Simulación
            </div>
            <div className="text-xs text-slate-500">
              Total: {study.total_estimated_days} días laborales
            </div>
          </div>
          
          <div className="space-y-3">
            {stages.map((stage, index) => {
              if (stage.data.estimated_days === 0) return null;
              
              const startDay = stages.slice(0, index).reduce((sum, s) => sum + s.data.estimated_days, 0);
              const width = (stage.data.estimated_days / study.total_estimated_days) * 100;
              
              return (
                <div key={stage.key}>
                  <div className="flex items-center gap-3 mb-1.5">
                    <span className="text-lg">{stage.icon}</span>
                    <span className="text-xs font-medium text-slate-700 w-40">{stage.label}</span>
                    <span className="text-xs text-slate-500 font-mono">{stage.data.estimated_days} días</span>
                  </div>
                  <div className="relative h-12 bg-slate-100 rounded-sm overflow-hidden ml-10">
                    <div
                      className={`absolute h-full transition-all duration-500 flex items-center px-3 text-white text-xs font-bold shadow-md
                        ${stage.color === 'blue' ? 'bg-blue-500' : ''}
                        ${stage.color === 'purple' ? 'bg-purple-500' : ''}
                        ${stage.color === 'yellow' ? 'bg-yellow-500' : ''}
                        ${stage.color === 'orange' ? 'bg-orange-500' : ''}
                        ${stage.color === 'cyan' ? 'bg-cyan-500' : ''}
                      `}
                      style={{ 
                        width: `${width}%`,
                        marginLeft: `${(startDay / study.total_estimated_days) * 100}%`
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span>{stage.data.estimated_days}d</span>
                        {stage.data.notes && (
                          <span className="text-xs opacity-80 truncate ml-2">{stage.data.notes}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Timeline ruler */}
            <div className="mt-6 ml-10">
              <div className="relative h-8 border-t border-slate-300">
                {[0, 25, 50, 75, 100].map((percent) => (
                  <div
                    key={percent}
                    className="absolute top-0 flex flex-col items-center"
                    style={{ left: `${percent}%` }}
                  >
                    <div className="w-px h-2 bg-slate-400"></div>
                    <span className="text-xs text-slate-500 mt-1 font-mono">
                      Día {Math.round((percent / 100) * study.total_estimated_days)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fechas estimadas */}
            {study.estimated_start_date && study.estimated_end_date && (
              <div className="mt-4 pt-4 border-t border-slate-200 flex justify-between items-center ml-10">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-600">
                    Inicio: <span className="font-mono">{new Date(study.estimated_start_date).toLocaleDateString('es-ES')}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-600">
                    Fin: <span className="font-mono">{new Date(study.estimated_end_date).toLocaleDateString('es-ES')}</span>
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyDetail;
