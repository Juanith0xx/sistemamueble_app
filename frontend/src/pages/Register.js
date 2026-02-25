import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Factory, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'designer'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(formData.email, formData.password, formData.name, formData.role);
      toast.success('¡Cuenta creada exitosamente!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    { value: 'designer', label: 'Diseñador' },
    { value: 'manufacturing_chief', label: 'Jefe de Fabricación' },
    { value: 'purchasing', label: 'Adquisiciones' },
    { value: 'warehouse', label: 'Bodega' },
    { value: 'superadmin', label: 'Superadministrador' }
  ];

  return (
    <div className="min-h-screen flex">
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1570619511366-24c19247c731?crop=entropy&cs=srgb&fm=jpg&q=85')` }}
      >
        <div className="absolute inset-0 bg-slate-900/70" />
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-6">
            <img src="/robfu-logo.png" alt="Robfu" className="h-24 mb-6" />
          </div>
          <p className="text-xl text-slate-300 font-medium leading-relaxed">
            Únete al sistema de control más eficiente para la industria del mueble.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900 mb-2">
              Crear Cuenta
            </h2>
            <p className="text-sm text-slate-600">Regístrate en el sistema</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="register-form">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                Nombre Completo
              </Label>
              <Input
                data-testid="register-name-input"
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white focus:ring-offset-0 focus:border-orange-500 font-mono text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                Email
              </Label>
              <Input
                data-testid="register-email-input"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white focus:ring-offset-0 focus:border-orange-500 font-mono text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                Contraseña
              </Label>
              <Input
                data-testid="register-password-input"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white focus:ring-offset-0 focus:border-orange-500 font-mono text-sm"
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                Rol
              </Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger data-testid="register-role-select" className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white focus:ring-offset-0 focus:border-orange-500 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              data-testid="register-submit-button"
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando cuenta...
                </>
              ) : (
                'Registrarse'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              ¿Ya tienes cuenta?{' '}
              <Link to="/login" className="text-orange-500 font-semibold hover:text-orange-600">
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;