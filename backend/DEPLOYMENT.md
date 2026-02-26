# Robfu Backend - Deployment Guide

## Variables de Entorno Requeridas

```env
# MongoDB (Requerido)
MONGO_URL=mongodb+srv://usuario:password@cluster.mongodb.net
DB_NAME=robfu_production

# JWT (Requerido - cambiar en producción)
JWT_SECRET_KEY=tu-clave-secreta-super-segura-cambiar-en-produccion

# CORS (Requerido - URL de tu frontend en Vercel)
CORS_ORIGINS=https://tu-app.vercel.app

# Resend Email (Opcional)
RESEND_API_KEY=re_xxxxx
SENDER_EMAIL=noreply@tudominio.com

# Google Drive (Opcional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_DRIVE_REDIRECT_URI=
FRONTEND_URL=https://tu-app.vercel.app
```

## Opciones de Deployment

### 1. Railway (Recomendado)
1. Crea cuenta en [railway.app](https://railway.app)
2. Conecta tu repositorio GitHub
3. Selecciona la carpeta `backend/`
4. Configura las variables de entorno
5. Railway detectará automáticamente FastAPI

### 2. Render
1. Crea cuenta en [render.com](https://render.com)
2. Nuevo Web Service → Conecta GitHub
3. Root Directory: `backend`
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `uvicorn server:app --host 0.0.0.0 --port $PORT`

### 3. Fly.io
1. Instala flyctl: `curl -L https://fly.io/install.sh | sh`
2. `fly launch` en la carpeta backend
3. `fly secrets set MONGO_URL=... DB_NAME=...`
4. `fly deploy`

## Archivos de Configuración Incluidos

- `Procfile` - Para Heroku/Railway
- `render.yaml` - Para Render
- `fly.toml` - Para Fly.io
- `Dockerfile` - Para cualquier plataforma con Docker

## Base de Datos MongoDB

Opciones gratuitas:
- [MongoDB Atlas](https://www.mongodb.com/atlas) - 512MB gratis
- [Railway](https://railway.app) - MongoDB addon

## Después del Deploy

1. Copia la URL de tu backend (ej: `https://robfu-backend.railway.app`)
2. En Vercel, configura la variable de entorno:
   - `REACT_APP_BACKEND_URL=https://robfu-backend.railway.app`
3. Redeploy el frontend en Vercel
