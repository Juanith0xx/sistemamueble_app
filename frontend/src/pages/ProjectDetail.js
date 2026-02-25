import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Upload, FileText, CheckCircle, Clock, ArrowRight, Link as LinkIcon, X, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { useDropzone } from 'react-dropzone';
import ObservationsSection from '@/components/ObservationsSection';

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
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [materialsFile, setMaterialsFile] = useState(null);
  const [uploadingMaterials, setUploadingMaterials] = useState(false);

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
    // Check if adding these files would exceed 10
    const totalFiles = documents.length + selectedFiles.length + acceptedFiles.length;
    if (totalFiles > 10) {
      toast.error(`Solo puedes tener hasta 10 documentos por proyecto. Ya tienes ${documents.length} y seleccionaste ${selectedFiles.length + acceptedFiles.length}`);
      return;
    }
    
    // Add files to selected list
    setSelectedFiles(prev => [...prev, ...acceptedFiles]);
  };

  const removeSelectedFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAllFiles = async () => {
    if (selectedFiles.length === 0) {
      toast.error('No hay archivos seleccionados');
      return;
    }

    setUploading(true);
    const progress = {};
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      progress[i] = 'uploading';
      setUploadProgress({...progress});

      const formData = new FormData();
      formData.append('file', file);

      try {
        const endpoint = uploadType === 'local' 
          ? `${API}/documents/upload-local?project_id=${id}&stage=${project.status}`
          : `${API}/documents/upload?project_id=${id}&stage=${project.status}`;
        
        if (uploadType === 'drive' && !driveConnected) {
          toast.error('Primero debes conectar Google Drive');
          progress[i] = 'error';
          failCount++;
          continue;
        }
        
        await axios.post(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        progress[i] = 'success';
        successCount++;
      } catch (error) {
        progress[i] = 'error';
        failCount++;
        console.error(`Error uploading ${file.name}:`, error);
      }
      setUploadProgress({...progress});
    }

    setUploading(false);
    
    if (successCount > 0) {
      toast.success(`${successCount} archivo(s) subido(s) exitosamente`);
    }
    if (failCount > 0) {
      toast.error(`${failCount} archivo(s) fallaron al subir`);
    }
    
    setSelectedFiles([]);
    setUploadProgress({});
    setUploadDialogOpen(false);
    fetchProjectData();
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 10 - documents.length,
    multiple: true
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

  // Verificar si existe el listado de materiales
  const getMaterialsList = () => {
    return documents.find(doc => doc.document_type === 'materials_list');
  };

  // Subir listado de materiales
  const handleUploadMaterialsList = async (file) => {
    if (!file) return;
    
    const validExtensions = ['.xls', '.xlsx'];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (!validExtensions.includes(fileExt)) {
      toast.error('El listado de materiales debe ser un archivo Excel (.xls o .xlsx)');
      return;
    }

    setUploadingMaterials(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(
        `${API}/documents/upload-local?project_id=${id}&stage=${project.status}&document_type=materials_list`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      toast.success('Listado de materiales subido exitosamente');
      setMaterialsFile(null);
      fetchProjectData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al subir listado de materiales');
    } finally {
      setUploadingMaterials(false);
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

      {/* Observations Section */}
      <ObservationsSection projectId={id} currentStage={project.status} />

      {/* Documents */}
      <div className="bg-white border border-slate-200 rounded-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono uppercase tracking-widest text-slate-400">Documentos</div>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm font-mono">
              {documents.length}/10
            </span>
          </div>
          {user?.role === 'designer' && documents.length < 10 && (
            <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
              setUploadDialogOpen(open);
              if (!open) {
                setSelectedFiles([]);
                setUploadProgress({});
              }
            }}>
              <DialogTrigger asChild>
                <Button
                  data-testid="upload-document-button"
                  variant="outline"
                  className="rounded-sm px-4 h-9 text-xs font-bold uppercase tracking-wide"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Subir Documentos
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg bg-white">
                <DialogHeader>
                  <DialogTitle className="font-heading text-xl uppercase tracking-tight">
                    Subir Documentos
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-1">
                    Puedes subir hasta {10 - documents.length} archivos más
                  </p>
                </DialogHeader>
                
                {/* Upload Type Selector */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                      Tipo de Almacenamiento
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setUploadType('local')}
                        className={`p-3 rounded-sm border-2 transition-all text-left ${
                          uploadType === 'local'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-semibold text-sm">PC Local</div>
                        <div className="text-xs text-slate-500 mt-1">Servidor</div>
                      </button>
                      <button
                        onClick={() => setUploadType('drive')}
                        className={`p-3 rounded-sm border-2 transition-all text-left ${
                          uploadType === 'drive'
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="font-semibold text-sm">Google Drive</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {driveConnected ? 'Conectado' : 'No conectado'}
                        </div>
                      </button>
                    </div>
                  </div>

                  {uploadType === 'drive' && !driveConnected && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-sm p-3">
                      <p className="text-xs text-yellow-800 mb-2">
                        Google Drive no está conectado
                      </p>
                      <Button
                        onClick={connectDrive}
                        size="sm"
                        className="bg-blue-600 text-white hover:bg-blue-700 rounded-sm h-8 text-xs font-bold uppercase"
                      >
                        Conectar Drive
                      </Button>
                    </div>
                  )}

                  <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-sm p-6 text-center cursor-pointer transition-colors ${
                      isDragActive ? 'border-orange-500 bg-orange-50' : 'border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <input {...getInputProps()} />
                    <Upload className="w-10 h-10 mx-auto mb-3 text-slate-400" />
                    <p className="text-sm text-slate-600 mb-1">
                      {isDragActive ? 'Suelta los archivos aquí' : 'Arrastra archivos o haz clic para seleccionar'}
                    </p>
                    <p className="text-xs text-slate-400">PDF o Excel (máx. {10 - documents.length} archivos)</p>
                  </div>

                  {/* Selected Files List */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Archivos seleccionados ({selectedFiles.length})
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {selectedFiles.map((file, index) => (
                          <div 
                            key={index}
                            className="flex items-center justify-between p-2 bg-slate-50 rounded-sm"
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                              <span className="text-sm text-slate-700 truncate">{file.name}</span>
                              <span className="text-xs text-slate-400 flex-shrink-0">
                                ({(file.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {uploadProgress[index] === 'uploading' && (
                                <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                              )}
                              {uploadProgress[index] === 'success' && (
                                <CheckCircle className="w-4 h-4 text-green-500" />
                              )}
                              {uploadProgress[index] === 'error' && (
                                <X className="w-4 h-4 text-red-500" />
                              )}
                              {!uploading && (
                                <button
                                  onClick={() => removeSelectedFile(index)}
                                  className="p-1 hover:bg-slate-200 rounded-sm transition-colors"
                                >
                                  <X className="w-4 h-4 text-slate-400" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Upload Button */}
                  {selectedFiles.length > 0 && (
                    <Button
                      onClick={uploadAllFiles}
                      disabled={uploading}
                      className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Subiendo...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Subir {selectedFiles.length} Archivo{selectedFiles.length > 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </DialogContent>
            </Dialog>
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
                    <div className="text-sm font-medium text-slate-900 flex items-center gap-2">
                      {doc.filename}
                      {doc.storage_type === 'local' && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-sm font-mono">
                          LOCAL
                        </span>
                      )}
                      {doc.storage_type !== 'local' && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-sm font-mono">
                          DRIVE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {new Date(doc.created_at).toLocaleString('es-ES')}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (doc.storage_type === 'local') {
                      window.open(`${API}/documents/download/${doc.document_id}`, '_blank');
                    } else {
                      window.open(doc.drive_url, '_blank');
                    }
                  }}
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
