import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Upload, FileText, CheckCircle, Clock, ArrowRight, Link as LinkIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [estimatedDays, setEstimatedDays] = useState(5);
  const [driveConnected, setDriveConnected] = useState(false);
  const [uploadType, setUploadType] = useState('local'); // 'local' or 'drive'

  useEffect(() => {
    fetchProjectData();
    checkDriveStatus();
  }, [id]);

  const fetchProjectData = async () => {
    try {
      const [projectRes, docsRes] = await Promise.all([
        axios.get(`${API}/projects/${id}`),
        axios.get(`${API}/documents/project/${id}`)
      ]);
      setProject(projectRes.data);
      setDocuments(docsRes.data);
    } catch (error) {
      console.error('Error fetching project:', error);
      toast.error('Error al cargar proyecto');
    } finally {
      setLoading(false);
    }
  };

  const checkDriveStatus = async () => {
    try {
      const response = await axios.get(`${API}/drive/status`);
      setDriveConnected(response.data.connected);
    } catch (error) {
      console.error('Error checking drive status:', error);
    }
  };

  const connectDrive = async () => {
    try {
      const response = await axios.get(`${API}/drive/connect`);
      window.location.href = response.data.authorization_url;
    } catch (error) {
      toast.error('Error al conectar Google Drive');
    }
  };

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const endpoint = uploadType === 'local' 
        ? `${API}/documents/upload-local?project_id=${id}&stage=${project.status}`
        : `${API}/documents/upload?project_id=${id}&stage=${project.status}`;
      
      if (uploadType === 'drive' && !driveConnected) {
        toast.error('Primero debes conectar Google Drive');
        return;
      }
      
      await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Archivo subido exitosamente');
      setUploadDialogOpen(false);
      fetchProjectData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al subir archivo');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1
  });

  const handleAdvanceStage = async () => {
    try {
      await axios.post(`${API}/projects/${id}/advance-stage?estimated_days=${estimatedDays}`);
      toast.success('Etapa avanzada exitosamente');
      setAdvanceDialogOpen(false);
      fetchProjectData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al avanzar etapa');
    }
  };

  const canAdvanceStage = () => {
    if (!user || !project) return false;
    
    const stagePermissions = {
      'design': 'designer',
      'validation': 'manufacturing_chief',
      'purchasing': 'purchasing',
      'warehouse': 'warehouse',
      'manufacturing': 'designer'
    };
    
    return stagePermissions[project.status] === user.role;
  };

  const getStageProgress = () => {
    const stages = ['design', 'validation', 'purchasing', 'warehouse', 'manufacturing', 'completed'];
    const currentIndex = stages.indexOf(project?.status || 'design');
    return ((currentIndex + 1) / stages.length) * 100;
  };

  if (loading) {
    return <div className="text-slate-500 font-mono uppercase text-sm">Cargando...</div>;
  }

  if (!project) {
    return <div className="text-slate-500">Proyecto no encontrado</div>;
  }

  const stages = [
    { key: 'design_stage', label: 'Diseño', status: 'design' },
    { key: 'validation_stage', label: 'Validación', status: 'validation' },
    { key: 'purchasing_stage', label: 'Compras', status: 'purchasing' },
    { key: 'warehouse_stage', label: 'Bodega', status: 'warehouse' },
    { key: 'manufacturing_stage', label: 'Fabricación', status: 'manufacturing' }
  ];

  return (
    <div data-testid="project-detail-page">
      <Button
        onClick={() => navigate('/projects')}
        variant="ghost"
        className="mb-4 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-sm px-4 h-9 font-medium text-xs uppercase tracking-wide transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </Button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-slate-900">
            {project.name}
          </h1>
          <p className="text-sm text-slate-600 mt-1">Cliente: {project.client_name}</p>
        </div>
        {canAdvanceStage() && project.status !== 'completed' && (
          <Dialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
            <DialogTrigger asChild>
              <Button
                data-testid="advance-stage-button"
                className="bg-orange-500 text-white hover:bg-orange-600 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Avanzar Etapa
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl uppercase tracking-tight">Avanzar Etapa</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  ¿Cuántos días estimas para la siguiente etapa?
                </p>
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Días Estimados
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={estimatedDays}
                    onChange={(e) => setEstimatedDays(parseInt(e.target.value))}
                    className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white focus:ring-offset-0 focus:border-orange-500 font-mono text-sm"
                  />
                </div>
                <Button
                  onClick={handleAdvanceStage}
                  className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs transition-all active:scale-95"
                >
                  Confirmar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-white border border-slate-200 rounded-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-mono uppercase tracking-widest text-slate-400">Progreso</div>
          <div className="text-sm font-mono text-slate-700">{Math.round(getStageProgress())}%</div>
        </div>
        <Progress value={getStageProgress()} className="h-2" />
      </div>

      {/* Description */}
      <div className="bg-white border border-slate-200 rounded-sm p-5 mb-6">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">Descripción</div>
        <p className="text-sm text-slate-700">{project.description}</p>
      </div>

      {/* Stages Timeline */}
      <div className="bg-white border border-slate-200 rounded-sm p-5 mb-6">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-4">Etapas del Proyecto</div>
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const stageData = project[stage.key];
            const isActive = project.status === stage.status;
            const isCompleted = stageData.status === 'completed';
            const isPending = stageData.status === 'pending';

            return (
              <div
                key={stage.key}
                className={`p-4 rounded-sm border ${
                  isActive ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-sm flex items-center justify-center ${
                      isCompleted ? 'bg-green-500' : isActive ? 'bg-orange-500' : 'bg-slate-200'
                    }`}>
                      {isCompleted ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <Clock className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-900">{stage.label}</div>
                      <div className="text-xs text-slate-500 font-mono uppercase">
                        {isCompleted ? 'Completada' : isActive ? 'En progreso' : 'Pendiente'}
                      </div>
                    </div>
                  </div>
                  {stageData.estimated_days > 0 && (
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Duración estimada</div>
                      <div className="text-sm font-mono font-medium text-slate-900">
                        {stageData.estimated_days} días
                      </div>
                    </div>
                  )}
                </div>
                {stageData.start_date && (
                  <div className="mt-3 flex gap-4 text-xs text-slate-600 font-mono">
                    <div>
                      <span className="text-slate-400">Inicio: </span>
                      {new Date(stageData.start_date).toLocaleDateString('es-ES')}
                    </div>
                    {stageData.end_date && (
                      <div>
                        <span className="text-slate-400">Fin: </span>
                        {new Date(stageData.end_date).toLocaleDateString('es-ES')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Documents */}
      <div className="bg-white border border-slate-200 rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-slate-400">Documentos</div>
          {user?.role === 'designer' && (
            <>
              {!driveConnected ? (
                <Button
                  onClick={connectDrive}
                  variant="outline"
                  className="rounded-sm px-4 h-9 text-xs font-bold uppercase tracking-wide"
                >
                  Conectar Google Drive
                </Button>
              ) : (
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      data-testid="upload-document-button"
                      variant="outline"
                      className="rounded-sm px-4 h-9 text-xs font-bold uppercase tracking-wide"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Subir Documento
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md bg-white">
                    <DialogHeader>
                      <DialogTitle className="font-heading text-xl uppercase tracking-tight">
                        Subir Documento
                      </DialogTitle>
                    </DialogHeader>
                    <div
                      {...getRootProps()}
                      className={`border-2 border-dashed rounded-sm p-8 text-center cursor-pointer transition-colors ${
                        isDragActive ? 'border-orange-500 bg-orange-50' : 'border-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <input {...getInputProps()} />
                      <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
                      <p className="text-sm text-slate-600 mb-1">
                        {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo o haz clic para seleccionar'}
                      </p>
                      <p className="text-xs text-slate-400">PDF o Excel</p>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </>
          )}
        </div>

        {documents.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-4">No hay documentos</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.document_id}
                className="flex items-center justify-between p-3 rounded-sm border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <div className="text-sm font-medium text-slate-900">{doc.filename}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {new Date(doc.created_at).toLocaleString('es-ES')}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => window.open(doc.drive_url, '_blank')}
                  variant="ghost"
                  size="sm"
                  className="hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-sm h-8 px-3"
                >
                  <LinkIcon className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectDetail;
