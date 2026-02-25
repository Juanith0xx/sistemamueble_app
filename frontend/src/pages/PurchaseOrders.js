import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PurchaseOrders = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    project_id: '',
    supplier: '',
    notes: ''
  });
  const [items, setItems] = useState([
    { description: '', quantity: 1, unit_price: 0 }
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, projectsRes] = await Promise.all([
        axios.get(`${API}/purchase-orders`),
        axios.get(`${API}/projects`)
      ]);
      setOrders(ordersRes.data);
      setProjects(projectsRes.data.filter(p => p.status === 'purchasing'));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Error al cargar órdenes');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unit_price: 0 }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = field === 'description' ? value : parseFloat(value) || 0;
    setItems(newItems);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/purchase-orders`, {
        ...formData,
        items: items
      });
      toast.success('Orden de compra creada exitosamente');
      setDialogOpen(false);
      setFormData({ project_id: '', supplier: '', notes: '' });
      setItems([{ description: '', quantity: 1, unit_price: 0 }]);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Error al crear orden');
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: 'Pendiente', className: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20' },
      sent: { label: 'Enviada', className: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
      received: { label: 'Recibida', className: 'bg-green-50 text-green-700 ring-green-600/20' }
    };
    return statusMap[status] || statusMap.pending;
  };

  if (loading) {
    return <div className="text-slate-500 font-mono uppercase text-sm">Cargando...</div>;
  }

  return (
    <div data-testid="purchase-orders-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-slate-900">
          Órdenes de Compra
        </h1>
        {user?.role === 'purchasing' && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                data-testid="new-order-button"
                className="bg-orange-500 text-white hover:bg-orange-600 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 mr-2" />
                Nueva Orden
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl bg-white max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading text-xl uppercase tracking-tight">
                  Crear Orden de Compra
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4" data-testid="create-order-form">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Proyecto
                  </Label>
                  <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })} required>
                    <SelectTrigger className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white text-sm">
                      <SelectValue placeholder="Seleccionar proyecto" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.project_id} value={project.project_id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
                    Proveedor
                  </Label>
                  <Input
                    required
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="h-10 rounded-sm border-slate-300 bg-slate-50 focus:bg-white text-sm"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Items</Label>
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      variant="outline"
                      size="sm"
                      className="rounded-sm h-8 text-xs font-bold uppercase tracking-wide"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Agregar Item
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {items.map((item, index) => (
                      <div key={index} className="flex gap-2 items-start">
                        <div className="flex-1">
                          <Input
                            placeholder="Descripción"
                            value={item.description}
                            onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                            className="h-9 rounded-sm border-slate-300 bg-slate-50 text-xs"
                            required
                          />
                        </div>
                        <div className="w-20">
                          <Input
                            type="number"
                            placeholder="Cant."
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="h-9 rounded-sm border-slate-300 bg-slate-50 font-mono text-xs"
                            required
                          />
                        </div>
                        <div className="w-24">
                          <Input
                            type="number"
                            placeholder="Precio"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => handleItemChange(index, 'unit_price', e.target.value)}
                            className="h-9 rounded-sm border-slate-300 bg-slate-50 font-mono text-xs"
                            required
                          />
                        </div>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-sm border border-slate-200">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono uppercase tracking-wider text-slate-500">Total</span>
                    <span className="text-lg font-mono font-bold text-slate-900">
                      ${calculateTotal().toFixed(2)}
                    </span>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-slate-900 text-white hover:bg-slate-800 rounded-sm px-6 h-10 font-bold uppercase tracking-wide text-xs transition-all active:scale-95"
                >
                  Crear Orden
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
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">ID</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Proveedor</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Total</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Estado</th>
              <th className="bg-slate-50 text-slate-500 font-mono text-xs uppercase tracking-wider text-left h-10 px-4">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-500 text-sm">No hay órdenes de compra</td>
              </tr>
            ) : (
              orders.map((order) => {
                const statusInfo = getStatusBadge(order.status);
                return (
                  <tr
                    key={order.po_id}
                    data-testid={`order-row-${order.po_id}`}
                    className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs font-mono text-slate-600">
                      {order.po_id.substring(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{order.supplier}</td>
                    <td className="px-4 py-3 text-sm font-mono font-medium text-slate-900">
                      ${order.total.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`${statusInfo.className} inline-flex items-center rounded-sm px-2 py-1 text-xs font-mono font-medium ring-1 ring-inset`}>
                        {statusInfo.label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500 font-mono">
                      {new Date(order.created_at).toLocaleDateString('es-ES')}
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

export default PurchaseOrders;