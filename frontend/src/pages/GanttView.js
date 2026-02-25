import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Chart } from 'react-google-charts';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const GanttView = () => {
  const [ganttData, setGanttData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGanttData();
  }, []);

  const fetchGanttData = async () => {
    try {
      const response = await axios.get(`${API}/gantt/data`);
      
      // Format data for Google Charts Gantt
      const chartData = [
        [
          { type: 'string', label: 'Task ID' },
          { type: 'string', label: 'Task Name' },
          { type: 'string', label: 'Resource' },
          { type: 'date', label: 'Start Date' },
          { type: 'date', label: 'End Date' },
          { type: 'number', label: 'Duration' },
          { type: 'number', label: 'Percent Complete' },
          { type: 'string', label: 'Dependencies' },
        ]
      ];

      response.data.tasks.forEach(task => {
        const startDate = new Date(task.start);
        const endDate = new Date(task.end);
        const dependencies = task.dependencies && task.dependencies.length > 0 
          ? task.dependencies.join(',') 
          : null;

        chartData.push([
          task.id,
          task.name,
          task.project_name,
          startDate,
          endDate,
          null,
          task.progress,
          dependencies
        ]);
      });

      setGanttData(chartData);
    } catch (error) {
      console.error('Error fetching gantt data:', error);
      toast.error('Error al cargar datos del Gantt');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-slate-500 font-mono uppercase text-sm">Cargando Gantt...</div>;
  }

  const options = {
    height: 600,
    gantt: {
      trackHeight: 40,
      criticalPathEnabled: false,
      arrow: {
        angle: 100,
        width: 2,
        color: '#F97316',
        radius: 0
      },
      palette: [
        {
          color: '#0EA5E9',
          dark: '#0284C7',
          light: '#7DD3FC'
        }
      ]
    }
  };

  return (
    <div data-testid="gantt-page">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-4xl font-bold uppercase tracking-tight text-slate-900">
          Gantt Chart
        </h1>
      </div>

      {ganttData.length <= 1 ? (
        <div className="bg-white border border-slate-200 rounded-sm p-12 text-center">
          <Calendar className="w-16 h-16 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-500 text-sm">No hay tareas programadas aún</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-sm overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 h-12 flex items-center px-4">
            <span className="font-mono text-xs uppercase tracking-widest text-slate-500">
              Timeline de Proyectos con Dependencias
            </span>
          </div>
          <div className="p-4">
            <Chart
              chartType="Gantt"
              width="100%"
              height="600px"
              data={ganttData}
              options={options}
            />
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 bg-white border border-slate-200 rounded-sm p-4">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">Información</div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: '#0EA5E9' }}></div>
            <span>Tareas del proyecto</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-orange-500"></div>
            <span>Líneas de dependencia (naranja)</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Las líneas muestran las dependencias entre etapas del mismo proyecto
        </p>
      </div>
    </div>
  );
};

export default GanttView;
