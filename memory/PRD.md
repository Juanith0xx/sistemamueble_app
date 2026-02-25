# Robfu - Sistema de Gestión de Producción Industrial

## Descripción General
Aplicación web multi-usuario para gestionar el ciclo de vida de proyectos de muebles en una fábrica, desde el diseño hasta la fabricación. Incluye sistema de Gantt para visualización de tiempos y un módulo de "Estudios de Proyectos" para simulación previa.

## Requerimientos del Usuario
- Diagrama Gantt dinámico y en tiempo real
- 5 roles de usuario con permisos específicos
- Carga local de archivos PDF/Excel
- Sistema de observaciones con alertas
- Dashboard con semáforo de estados
- Estudios de proyectos para simulación de tiempos
- Exportación a PDF de simulaciones
- Branding personalizado (Robfu)

## Roles de Usuario
| Rol | Permisos |
|-----|----------|
| Superadministrador | Dashboard KPIs, gestión total |
| Diseñador | Crear proyectos, cargar diseños |
| Jefe de Fabricación | Validación técnica |
| Adquisiciones | Órdenes de compra, estimar tiempos de compras y bodega |
| Bodega | Confirmar recepción de materiales |

## Stack Tecnológico
- **Frontend:** React 19, TailwindCSS, Shadcn/UI, react-google-charts
- **Backend:** FastAPI, MongoDB (Motor async), JWT
- **PDF:** ReportLab

## Funcionalidades Implementadas

### Autenticación y Usuarios (Completado)
- Login/Registro con JWT
- Control de acceso basado en roles
- Gestión de perfiles con foto

### Proyectos y Gantt (Completado)
- CRUD de proyectos
- Flujo de estados por etapas
- Visualización Gantt con dependencias
- Sistema de observaciones

### Estudios de Proyectos (Completado - Feb 25, 2026)
- Crear simulaciones de proyectos
- Estimaciones por etapa según rol
- Gantt visual de simulación
- Exportación PDF con Gantt incluido
- Aprobación para convertir en proyecto real

### Órdenes de Compra (Completado)
- Crear órdenes de compra
- Gestión de proveedores
- Acceso restringido a rol purchasing

## Credenciales de Prueba
- Admin: admin@sistemamuebles.cl / test123
- Diseñador: disenador@sistemamuebles.cl / test123
- Jefe Fab: jefe.fabricacion@sistemamuebles.cl / test123
- Compras: compras@sistemamuebles.cl / test123
- Bodega: bodega@sistemamuebles.cl / test123

## Backlog / Tareas Futuras
- [ ] Refactorizar server.py (1400+ líneas) en múltiples archivos
- [ ] Seguridad SaaS (multi-tenencia, 2FA, rate limiting) - aplazado por usuario
- [ ] Reactivar integración Google Drive (credenciales pendientes)
- [ ] Reactivar notificaciones por email con Resend (API key pendiente)

## Notas Técnicas
- URL Preview: https://workflow-production.preview.emergentagent.com
- MongoDB excluye _id en todas las respuestas
- Archivos se almacenan en /app/uploads/
