import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Factory, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(formData.email, formData.password);
      toast.success('¡Bienvenido!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div 
        className="hidden lg:flex lg:w-1/2 bg-cover bg-center relative"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1570619511366-24c19247c731?crop=entropy&cs=srgb&fm=jpg&q=85')` }}
      >
        <div className="absolute inset-0 bg-slate-900/70" />
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-6">
            <img src="/robfu-logo.png" alt="Robfu" className="h-20 mb-4" />
            <h1 className="font-heading text-5xl font-bold uppercase tracking-tight">Gantt Pro</h1>
          </div>
          <p className="text-xl text-slate-300 font-medium leading-relaxed">
            Sistema de control industrial para fábricas de muebles.
            <br />Optimiza tu producción con gestión en tiempo real.
          </p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 bg-white">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="font-heading text-3xl font-bold uppercase tracking-tight text-slate-900 mb-2">
              Iniciar Sesión
            </h2>
            <p className="text-sm text-slate-600">Accede a tu panel de control</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="login-form">
            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                Email
              </Label>
              <Input
                data-testid="login-email-input"
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
                data-testid="login-password-input"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white focus:ring-offset-0 focus:border-orange-500 font-mono text-sm"
              />
            </div>

            <Button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs transition-all active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Iniciando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              ¿No tienes cuenta?{' '}
              <Link to="/register" className="text-orange-500 font-semibold hover:text-orange-600">
                Regístrate aquí
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;