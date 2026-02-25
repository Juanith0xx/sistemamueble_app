import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { Button } from '@/components/ui/button';
import { Calendar, List } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GanttView = () => {
  const [ganttData, setGanttData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(ViewMode.Day);

  useEffect(() => {
    fetchGanttData();
  }, []);

  const fetchGanttData = async () => {
    try {
      const response = await axios.get(`${API}/gantt/data`);
      
      const tasks = response.data.map(task => ({
        start: new Date(task.start),
        end: new Date(task.end),
        name: task.name,
        id: task.id,
        type: 'task',
        progress: task.progress,
        isDisabled: false,
        styles: {
          backgroundColor: getColorByStatus(task.status),
          backgroundSelectedColor: getColorByStatus(task.status),
          progressColor: '#0EA5E9',
          progressSelectedColor: '#0EA5E9'
        }
      }));

      setGanttData(tasks);
    } catch (error) {
      console.error('Error fetching gantt data:', error);
      toast.error('Error al cargar datos del Gantt');
    } finally {
      setLoading(false);
    }
  };

  const getColorByStatus = (status) => {
    const colorMap = {
      'pending': '#94A3B8',
      'in_progress': '#F97316',
      'completed': '#22C55E',
      'delayed': '#EF4444'
    };
    return colorMap[status] || '#CBD5E1';
  };

  if (loading) {
    return <div className="text-slate-500 font-mono uppercase text-sm">Cargando Gantt...</div>;
  }

  return (
    <div data-testid="gantt-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-slate-900">
          Gantt Chart
        </h1>
        <div className="flex gap-2">
          <Button
            onClick={() => setViewMode(ViewMode.Day)}
            variant={viewMode === ViewMode.Day ? 'default' : 'outline'}
            className="rounded-sm px-4 h-9 text-xs font-bold uppercase tracking-wide"
          >
            Día
          </Button>
          <Button
            onClick={() => setViewMode(ViewMode.Week)}
            variant={viewMode === ViewMode.Week ? 'default' : 'outline'}
            className="rounded-sm px-4 h-9 text-xs font-bold uppercase tracking-wide"
          >
            Semana
          </Button>
          <Button
            onClick={() => setViewMode(ViewMode.Month)}
            variant={viewMode === ViewMode.Month ? 'default' : 'outline'}
            className="rounded-sm px-4 h-9 text-xs font-bold uppercase tracking-wide"
          >
            Mes
          </Button>
        </div>
      </div>

      {ganttData.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-sm p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 text-sm">No hay tareas programadas aún</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 h-12 flex items-center px-4">
            <span className="font-mono text-xs uppercase tracking-widest text-slate-500">
              Timeline de Proyectos
            </span>
          </div>
          <div className="overflow-auto" style={{ height: 'calc(100vh - 16rem)' }}>
            <Gantt
              tasks={ganttData}
              viewMode={viewMode}
              locale="es"
              listCellWidth=""
              columnWidth={viewMode === ViewMode.Month ? 300 : viewMode === ViewMode.Week ? 250 : 60}
            />
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 bg-white border border-slate-200 rounded-sm p-4">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">Leyenda</div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-slate-400"></div>
            <span className="text-xs text-slate-600">Pendiente</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-orange-500"></div>
            <span className="text-xs text-slate-600">En Progreso</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-green-500"></div>
            <span className="text-xs text-slate-600">Completado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm bg-red-500"></div>
            <span className="text-xs text-slate-600">Retrasado</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttView;
