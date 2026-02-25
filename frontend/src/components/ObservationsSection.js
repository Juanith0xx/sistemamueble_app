import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MessageSquare, Send, User } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ObservationsSection = ({ projectId, currentStage }) => {
  const { user } = useAuth();
  const [observations, setObservations] = useState([]);
  const [users, setUsers] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newObservation, setNewObservation] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);

  useEffect(() => {
    fetchObservations();
    fetchUsers();
  }, [projectId]);

  const fetchObservations = async () => {
    try {
      const response = await axios.get(`${API}/observations/project/${projectId}`);
      setObservations(response.data);
    } catch (error) {
      console.error('Error fetching observations:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users/all`);
      setUsers(response.data.filter(u => u.user_id !== user.user_id));
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleSubmit = async () => {
    if (!newObservation.trim()) {
      toast.error('Escribe una observación');
      return;
    }
    if (selectedRecipients.length === 0) {
      toast.error('Selecciona al menos un destinatario');
      return;
    }

    try {
      await axios.post(`${API}/observations`, {
        project_id: projectId,
        stage: currentStage,
        content: newObservation,
        recipients: selectedRecipients
      });
      toast.success('Observación enviada');
      setNewObservation('');
      setSelectedRecipients([]);
      setDialogOpen(false);
      fetchObservations();
    } catch (error) {
      toast.error('Error al enviar observación');
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      designer: 'bg-blue-100 text-blue-700',
      manufacturing_chief: 'bg-purple-100 text-purple-700',
      purchasing: 'bg-yellow-100 text-yellow-800',
      warehouse: 'bg-orange-100 text-orange-700',
      superadmin: 'bg-red-100 text-red-700'
    };
    return colors[role] || 'bg-slate-100 text-slate-700';
  };

  const getRoleLabel = (role) => {
    const labels = {
      designer: 'Diseñador',
      manufacturing_chief: 'Jefe Fabricación',
      purchasing: 'Compras',
      warehouse: 'Bodega',
      superadmin: 'Admin'
    };
    return labels[role] || role;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400">
          Observaciones ({observations.length})
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              data-testid="new-observation-button"
              variant="outline"
              className="rounded-sm px-4 h-9 text-xs font-bold uppercase tracking-wide"
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Nueva Observación
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg bg-white">
            <DialogHeader>
              <DialogTitle className="font-heading text-xl uppercase tracking-tight">
                Nueva Observación
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                  Observación / Comentario
                </Label>
                <Textarea
                  value={newObservation}
                  onChange={(e) => setNewObservation(e.target.value)}
                  placeholder="Escribe tu observación o corrección..."
                  rows={4}
                  className="rounded-sm border-slate-300 bg-slate-50 focus:bg-white text-sm"
                />
              </div>

              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">
                  Notificar a
                </Label>
                <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-sm p-3">
                  {users.map((u) => (
                    <div key={u.user_id} className="flex items-center space-x-2">
                      <Checkbox
                        id={u.user_id}
                        checked={selectedRecipients.includes(u.user_id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedRecipients([...selectedRecipients, u.user_id]);
                          } else {
                            setSelectedRecipients(selectedRecipients.filter(id => id !== u.user_id));
                          }
                        }}
                      />
                      <label
                        htmlFor={u.user_id}
                        className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
                      >
                        <span>{u.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-sm ${getRoleBadgeColor(u.role)}`}>
                          {getRoleLabel(u.role)}
                        </span>
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                className="w-full bg-orange-500 text-white hover:bg-orange-600 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs"
              >
                <Send className="w-4 h-4 mr-2" />
                Enviar Observación
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {observations.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-8">No hay observaciones</p>
      ) : (
        <div className="space-y-3">
          {observations.map((obs) => {
            const isRecipient = obs.recipients.includes(user.user_id);
            return (
              <div
                key={obs.observation_id}
                className={`p-4 rounded-sm border transition-colors ${
                  isRecipient 
                    ? 'border-orange-300 bg-orange-50' 
                    : 'border-slate-200 bg-slate-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-sm bg-slate-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-slate-500" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-slate-900">{obs.created_by_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-sm ${getRoleBadgeColor(obs.created_by_role)}`}>
                        {getRoleLabel(obs.created_by_role)}
                      </span>
                      {isRecipient && (
                        <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-sm font-mono">
                          PARA TI
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed">{obs.content}</p>
                    <div className="text-xs text-slate-400 font-mono mt-2">
                      {new Date(obs.created_at).toLocaleString('es-ES')} · Etapa: {obs.stage}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ObservationsSection;
