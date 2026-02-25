import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, User, Save } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const Profile = () => {
  const { user } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || ''
  });

  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      await axios.post(`${API}/users/upload-avatar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Avatar actualizado. Recarga la página para ver el cambio.');
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al subir avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      await axios.put(`${API}/users/me`, formData);
      toast.success('Perfil actualizado exitosamente');
      setEditing(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al actualizar perfil');
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp']
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024 // 5MB
  });

  const getRoleLabel = (role) => {
    const labels = {
      designer: 'Diseñador',
      manufacturing_chief: 'Jefe de Fabricación',
      purchasing: 'Adquisiciones',
      warehouse: 'Bodega',
      superadmin: 'Superadministrador'
    };
    return labels[role] || role;
  };

  return (
    <div data-testid="profile-page">
      <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-slate-900 mb-6">
        Mi Perfil
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Avatar Section */}
        <div className="bg-white border border-slate-200 rounded-sm p-6">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">
            Foto de Perfil
          </Label>
          
          <div className="flex flex-col items-center">
            {user?.avatar_url ? (
              <img
                src={`${process.env.REACT_APP_BACKEND_URL}${user.avatar_url}`}
                alt={user.name}
                className="w-32 h-32 rounded-sm object-cover border-2 border-slate-200 mb-4"
              />
            ) : (
              <div className="w-32 h-32 rounded-sm bg-slate-200 flex items-center justify-center mb-4 border-2 border-slate-300">
                <User className="w-16 h-16 text-slate-400" />
              </div>
            )}

            <div
              {...getRootProps()}
              className={`w-full border-2 border-dashed rounded-sm p-4 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-orange-500 bg-orange-50' : 'border-slate-300 hover:border-slate-400'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} disabled={uploading} />
              <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
              <p className="text-xs text-slate-600 mb-1">
                {uploading ? 'Subiendo...' : isDragActive ? 'Suelta la imagen aquí' : 'Arrastra o haz clic para subir'}
              </p>
              <p className="text-xs text-slate-400">PNG, JPG hasta 5MB</p>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="md:col-span-2 bg-white border border-slate-200 rounded-sm p-6">
          <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 block">
            Información del Usuario
          </Label>

          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">Nombre</div>
              <div className="text-lg font-semibold text-slate-900">{user?.name}</div>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">Email</div>
              <div className="text-sm text-slate-700 font-mono">{user?.email}</div>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">Rol</div>
              <div className="inline-block bg-slate-100 text-slate-700 px-3 py-1 rounded-sm text-sm font-medium">
                {getRoleLabel(user?.role)}
              </div>
            </div>

            <div>
              <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-1">Cuenta Creada</div>
              <div className="text-sm text-slate-600 font-mono">
                {user?.created_at ? new Date(user.created_at).toLocaleString('es-ES') : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* My Mentions Section */}
      <div className="mt-6 bg-white border border-slate-200 rounded-sm p-6">
        <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 block">
          Mis Menciones Recientes
        </Label>
        <p className="text-sm text-slate-500">
          Aquí aparecerán las observaciones donde te mencionen otros usuarios.
        </p>
      </div>
    </div>
  );
};

export default Profile;
