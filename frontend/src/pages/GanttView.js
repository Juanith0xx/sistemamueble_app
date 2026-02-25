import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Chart } from 'react-google-charts';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Color palette for different projects
const PROJECT_COLORS = [
  { color: '#3B82F6', dark: '#1D4ED8', light: '#93C5FD' }, // Blue
  { color: '#10B981', dark: '#059669', light: '#6EE7B7' }, // Green
  { color: '#F59E0B', dark: '#D97706', light: '#FCD34D' }, // Amber
  { color: '#8B5CF6', dark: '#7C3AED', light: '#C4B5FD' }, // Violet
  { color: '#EC4899', dark: '#DB2777', light: '#F9A8D4' }, // Pink
  { color: '#06B6D4', dark: '#0891B2', light: '#67E8F9' }, // Cyan
  { color: '#EF4444', dark: '#DC2626', light: '#FCA5A5' }, // Red
  { color: '#84CC16', dark: '#65A30D', light: '#BEF264' }, // Lime
];

const GanttView = () => {
  const [ganttData, setGanttData] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGanttData();
  }, []);

  const fetchGanttData = async () => {
    try {
      const response = await axios.get(`${API}/gantt/data`);
      
      // Group tasks by project
      const projectMap = new Map();
      response.data.tasks.forEach(task => {
        if (!projectMap.has(task.project_id)) {
          projectMap.set(task.project_id, {
            id: task.project_id,
            name: task.project_name,
            tasks: []
          });
        }
        projectMap.get(task.project_id).tasks.push(task);
      });
      
      const projectList = Array.from(projectMap.values());
      setProjects(projectList);
      
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

  // Create palette based on number of projects
  const palette = projects.map((_, idx) => PROJECT_COLORS[idx % PROJECT_COLORS.length]);

  const options = {
    height: Math.max(400, projects.length * 200 + 100),
    gantt: {
      trackHeight: 40,
      barHeight: 28,
      criticalPathEnabled: false,
      innerGridTrack: { fill: '#f8fafc' },
      innerGridDarkTrack: { fill: '#f1f5f9' },
      arrow: {
        angle: 100,
        width: 2,
        color: '#F97316',
        radius: 0
      },
      palette: palette
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
        <>
          {/* Project Legend */}
          <div className="mb-4 bg-white border border-slate-200 rounded-sm p-4">
            <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">
              Proyectos ({projects.length})
            </div>
            <div className="flex flex-wrap gap-3">
              {projects.map((project, idx) => (
                <div key={project.id} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-sm">
                  <div 
                    className="w-4 h-4 rounded-sm" 
                    style={{ backgroundColor: PROJECT_COLORS[idx % PROJECT_COLORS.length].color }}
                  />
                  <span className="text-sm font-medium text-slate-700">{project.name}</span>
                  <span className="text-xs text-slate-400">({project.tasks.length} etapas)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Gantt Chart with Project Separators */}
          <div className="space-y-4">
            {projects.map((project, projectIdx) => {
              // Filter data for this project
              const projectData = [
                ganttData[0], // Header
                ...ganttData.slice(1).filter(row => row[2] === project.name)
              ];
              
              if (projectData.length <= 1) return null;
              
              const projectOptions = {
                height: Math.max(150, project.tasks.length * 50 + 50),
                gantt: {
                  trackHeight: 40,
                  barHeight: 28,
                  criticalPathEnabled: false,
                  innerGridTrack: { fill: '#ffffff' },
                  innerGridDarkTrack: { fill: '#fafafa' },
                  arrow: {
                    angle: 100,
                    width: 2,
                    color: '#F97316',
                    radius: 0
                  },
                  palette: [PROJECT_COLORS[projectIdx % PROJECT_COLORS.length]]
                }
              };

              return (
                <div 
                  key={project.id}
                  className="bg-white border-2 rounded-sm overflow-hidden"
                  style={{ borderColor: PROJECT_COLORS[projectIdx % PROJECT_COLORS.length].color }}
                >
                  {/* Project Header */}
                  <div 
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ backgroundColor: PROJECT_COLORS[projectIdx % PROJECT_COLORS.length].light + '40' }}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-3 h-8 rounded-sm"
                        style={{ backgroundColor: PROJECT_COLORS[projectIdx % PROJECT_COLORS.length].color }}
                      />
                      <div>
                        <h3 className="font-bold text-slate-900 uppercase tracking-wide">
                          {project.name}
                        </h3>
                        <p className="text-xs text-slate-500">{project.tasks.length} etapas</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Project Gantt */}
                  <div className="p-2">
                    <Chart
                      chartType="Gantt"
                      width="100%"
                      data={projectData}
                      options={projectOptions}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Information */}
      <div className="mt-4 bg-white border border-slate-200 rounded-sm p-4">
        <div className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-3">Información</div>
        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-orange-500"></div>
            <span>Líneas de dependencia</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Cada proyecto se muestra en un bloque separado con su propio color para facilitar la identificación
        </p>
      </div>
    </div>
  );
};

export default GanttView;
