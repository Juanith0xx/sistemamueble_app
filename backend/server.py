from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, UploadFile, File, Query
from fastapi.responses import RedirectResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import resend
import asyncio
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
import io
import tempfile

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Resend settings
resend.api_key = os.getenv("RESEND_API_KEY", "")
SENDER_EMAIL = os.getenv("SENDER_EMAIL", "onboarding@resend.dev")

# Google Drive settings
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_DRIVE_REDIRECT_URI = os.getenv("GOOGLE_DRIVE_REDIRECT_URI", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserRole:
    DESIGNER = "designer"
    MANUFACTURING_CHIEF = "manufacturing_chief"
    PURCHASING = "purchasing"
    WAREHOUSE = "warehouse"
    SUPERADMIN = "superadmin"

class ProjectStatus:
    DRAFT = "draft"
    DESIGN = "design"
    VALIDATION = "validation"
    PURCHASING = "purchasing"
    WAREHOUSE = "warehouse"
    MANUFACTURING = "manufacturing"
    COMPLETED = "completed"

class StageStatus:
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"

class UserRegister(BaseModel):
    email: str
    password: str
    name: str
    role: str

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    role: str
    avatar_url: Optional[str] = None
    stars: int = 0  # Estrellas de recompensa por completar antes del plazo
    created_at: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class ProjectStage(BaseModel):
    estimated_days: int = 0
    actual_days: int = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    responsible_user_id: Optional[str] = None
    status: str = StageStatus.PENDING

class ProjectCreate(BaseModel):
    name: str
    description: str
    client_name: str
    design_estimated_days: int

class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    project_id: str
    name: str
    description: str
    client_name: str
    created_by: str
    status: str
    design_stage: ProjectStage
    validation_stage: ProjectStage
    purchasing_stage: ProjectStage
    warehouse_stage: ProjectStage
    manufacturing_stage: ProjectStage
    created_at: str
    updated_at: str

class DocumentUpload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    document_id: str
    project_id: str
    filename: str
    file_type: str
    drive_file_id: str
    drive_url: str
    uploaded_by: str
    stage: str
    created_at: str

class PurchaseOrderItem(BaseModel):
    description: str
    quantity: int
    unit_price: float

class PurchaseOrderCreate(BaseModel):
    project_id: str
    supplier: str
    items: List[PurchaseOrderItem]
    notes: Optional[str] = None

class PurchaseOrder(BaseModel):
    model_config = ConfigDict(extra="ignore")
    po_id: str
    project_id: str
    supplier: str
    items: List[PurchaseOrderItem]
    total: float
    status: str
    notes: Optional[str] = None
    created_by: str
    created_at: str
    updated_at: str

class StudyStageEstimate(BaseModel):
    estimated_days: int = 0
    estimated_by: Optional[str] = None
    estimated_at: Optional[str] = None
    notes: Optional[str] = None

class ProjectStudyCreate(BaseModel):
    name: str
    description: str
    client_name: str

class ProjectStudy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    study_id: str
    name: str
    description: str
    client_name: str
    created_by: str
    status: str  # draft, in_review, approved, rejected
    design_stage: StudyStageEstimate
    validation_stage: StudyStageEstimate
    purchasing_stage: StudyStageEstimate
    warehouse_stage: StudyStageEstimate
    manufacturing_stage: StudyStageEstimate
    total_estimated_days: int
    estimated_start_date: Optional[str] = None
    estimated_end_date: Optional[str] = None
    started_project_id: Optional[str] = None
    created_at: str
    updated_at: str

class StageEstimateUpdate(BaseModel):
    estimated_days: int
    notes: Optional[str] = None

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    notification_id: str
    user_id: str
    project_id: str
    message: str
    read: bool
    created_at: str

class ObservationCreate(BaseModel):
    project_id: str
    stage: str
    content: str
    recipients: List[str]  # List of user_ids

class Observation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    observation_id: str
    project_id: str
    stage: str
    content: str
    created_by: str
    created_by_name: Optional[str] = None
    created_by_role: Optional[str] = None
    recipients: List[str]
    created_at: str

# ==================== AUTH HELPERS ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(authorization: str = Header(None)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if user_doc is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user_doc)

# ==================== NOTIFICATION HELPER ====================

async def send_notification_email(recipient_email: str, subject: str, html_content: str):
    if not resend.api_key:
        logger.warning("Resend API key not configured, skipping email")
        return
    
    params = {
        "from": SENDER_EMAIL,
        "to": [recipient_email],
        "subject": subject,
        "html": html_content
    }
    
    try:
        email = await asyncio.to_thread(resend.Emails.send, params)
        logger.info(f"Email sent to {recipient_email}")
        return email.get("id")
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")

async def create_notification(user_id: str, project_id: str, message: str):
    notification = {
        "notification_id": str(uuid.uuid4()),
        "user_id": user_id,
        "project_id": project_id,
        "message": message,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if user_doc and resend.api_key:
        await send_notification_email(
            user_doc["email"],
            "Nueva notificación - Sistema Gantt",
            f"<h2>Nueva notificación</h2><p>{message}</p>"
        )

# ==================== GOOGLE DRIVE HELPERS ====================

async def get_drive_service(user: User):
    creds_doc = await db.drive_credentials.find_one({"user_id": user.user_id})
    if not creds_doc:
        raise HTTPException(status_code=400, detail="Google Drive no está conectado. Por favor conecta tu Drive primero.")
    
    creds = Credentials(
        token=creds_doc["access_token"],
        refresh_token=creds_doc.get("refresh_token"),
        token_uri=creds_doc["token_uri"],
        client_id=creds_doc["client_id"],
        client_secret=creds_doc["client_secret"],
        scopes=creds_doc["scopes"]
    )
    
    if creds.expired and creds.refresh_token:
        logger.info(f"Refreshing expired token for user {user.user_id}")
        creds.refresh(GoogleRequest())
        
        await db.drive_credentials.update_one(
            {"user_id": user.user_id},
            {"$set": {
                "access_token": creds.token,
                "expiry": creds.expiry.isoformat() if creds.expiry else None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return build('drive', 'v3', credentials=creds)

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_input: UserRegister):
    existing = await db.users.find_one({"email": user_input.email})
    if existing:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    user_id = str(uuid.uuid4())
    user_doc = {
        "user_id": user_id,
        "email": user_input.email,
        "password_hash": get_password_hash(user_input.password),
        "name": user_input.name,
        "role": user_input.role,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(
        data={"sub": user_id},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    user = User(
        user_id=user_id,
        email=user_input.email,
        name=user_input.name,
        role=user_input.role,
        created_at=user_doc["created_at"]
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email})
    if not user_doc or not verify_password(credentials.password, user_doc["password_hash"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    access_token = create_access_token(
        data={"sub": user_doc["user_id"]},
        expires_delta=timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    
    user = User(
        user_id=user_doc["user_id"],
        email=user_doc["email"],
        name=user_doc["name"],
        role=user_doc["role"],
        created_at=user_doc["created_at"]
    )
    
    return Token(access_token=access_token, token_type="bearer", user=user)

@api_router.get("/auth/me", response_model=User)
async def get_me(user: User = Depends(get_current_user)):
    return user

# ==================== PROJECT ROUTES ====================

@api_router.post("/projects", response_model=Project)
async def create_project(project_input: ProjectCreate, user: User = Depends(get_current_user)):
    if user.role != UserRole.DESIGNER:
        raise HTTPException(status_code=403, detail="Solo los diseñadores pueden crear proyectos")
    
    project_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    start_date = datetime.now(timezone.utc)
    end_date = start_date + timedelta(days=project_input.design_estimated_days)
    
    project_doc = {
        "project_id": project_id,
        "name": project_input.name,
        "description": project_input.description,
        "client_name": project_input.client_name,
        "created_by": user.user_id,
        "status": ProjectStatus.DESIGN,
        "design_stage": {
            "estimated_days": project_input.design_estimated_days,
            "actual_days": 0,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "responsible_user_id": user.user_id,
            "status": StageStatus.IN_PROGRESS
        },
        "validation_stage": {"estimated_days": 0, "actual_days": 0, "status": StageStatus.PENDING},
        "purchasing_stage": {"estimated_days": 0, "actual_days": 0, "status": StageStatus.PENDING},
        "warehouse_stage": {"estimated_days": 0, "actual_days": 0, "status": StageStatus.PENDING},
        "manufacturing_stage": {"estimated_days": 0, "actual_days": 0, "status": StageStatus.PENDING},
        "created_at": now,
        "updated_at": now
    }
    
    await db.projects.insert_one(project_doc)
    project_doc.pop("_id", None)
    
    return Project(**project_doc)

@api_router.get("/projects")
async def get_projects(status: Optional[str] = None, user: User = Depends(get_current_user)):
    query = {}
    
    if user.role == UserRole.DESIGNER:
        query["created_by"] = user.user_id
    
    if status:
        query["status"] = status
    
    projects = await db.projects.find(query, {"_id": 0}).to_list(1000)
    
    # Add creator name to each project
    result = []
    for p in projects:
        project_dict = dict(p)
        creator = await db.users.find_one({"user_id": p.get("created_by")}, {"_id": 0, "name": 1})
        project_dict["created_by_name"] = creator["name"] if creator else "Desconocido"
        result.append(project_dict)
    
    return result

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, user: User = Depends(get_current_user)):
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return Project(**project)

@api_router.post("/projects/{project_id}/advance-stage")
async def advance_project_stage(project_id: str, user: User = Depends(get_current_user)):
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    current_status = project["status"]
    
    # Verificar si se requiere listado de materiales antes de avanzar desde validación
    if current_status == ProjectStatus.VALIDATION:
        materials_list = await db.documents.find_one({
            "project_id": project_id,
            "document_type": "materials_list"
        })
        if not materials_list:
            raise HTTPException(
                status_code=400, 
                detail="Debe subir el listado de materiales (Excel) antes de avanzar a la siguiente etapa"
            )
    
    # Verificar si se requiere orden de compra antes de avanzar desde compras
    if current_status == ProjectStatus.PURCHASING:
        purchase_order = await db.documents.find_one({
            "project_id": project_id,
            "document_type": "purchase_order"
        })
        if not purchase_order:
            raise HTTPException(
                status_code=400, 
                detail="Debe subir la Orden de Compra Materiales antes de avanzar a la siguiente etapa"
            )
    
    # Verificar si se confirmó recepción de materiales antes de avanzar desde bodega
    if current_status == ProjectStatus.WAREHOUSE:
        if not project.get("warehouse_stage", {}).get("materials_confirmed", False):
            raise HTTPException(
                status_code=400, 
                detail="Debe confirmar que todos los materiales están listos antes de avanzar a fabricación"
            )
    
    updates = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    stage_map = {
        ProjectStatus.DESIGN: ("design_stage", ProjectStatus.VALIDATION, "validation_stage", UserRole.MANUFACTURING_CHIEF),
        ProjectStatus.VALIDATION: ("validation_stage", ProjectStatus.PURCHASING, "purchasing_stage", UserRole.PURCHASING),
        ProjectStatus.PURCHASING: ("purchasing_stage", ProjectStatus.WAREHOUSE, "warehouse_stage", UserRole.WAREHOUSE),
        ProjectStatus.WAREHOUSE: ("warehouse_stage", ProjectStatus.MANUFACTURING, "manufacturing_stage", UserRole.DESIGNER),
        ProjectStatus.MANUFACTURING: ("manufacturing_stage", ProjectStatus.COMPLETED, None, None)
    }
    
    if current_status not in stage_map:
        raise HTTPException(status_code=400, detail="El proyecto no puede avanzar más")
    
    current_stage_key, next_status, next_stage_key, next_role = stage_map[current_status]
    
    updates[f"{current_stage_key}.status"] = StageStatus.COMPLETED
    updates[f"{current_stage_key}.end_date"] = datetime.now(timezone.utc).isoformat()
    updates["status"] = next_status
    
    if next_stage_key:
        # La siguiente etapa comienza sin tiempo estimado - el usuario responsable lo definirá
        updates[f"{next_stage_key}.start_date"] = datetime.now(timezone.utc).isoformat()
        updates[f"{next_stage_key}.status"] = StageStatus.IN_PROGRESS
        updates[f"{next_stage_key}.estimated_days"] = 0  # Pendiente de definir
        
        if next_role:
            next_users = await db.users.find({"role": next_role}, {"_id": 0}).to_list(100)
            for next_user in next_users:
                await create_notification(
                    next_user["user_id"],
                    project_id,
                    f"El proyecto '{project['name']}' ha avanzado a la etapa {next_status}. Por favor define tu tiempo estimado."
                )
    
    await db.projects.update_one({"project_id": project_id}, {"$set": updates})
    
    updated_project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return Project(**updated_project)

@api_router.put("/projects/{project_id}/stage-duration")
async def update_stage_duration(project_id: str, stage: str, new_days: int, user: User = Depends(get_current_user)):
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    stage_key = f"{stage}_stage"
    if stage_key not in project:
        raise HTTPException(status_code=400, detail="Etapa inválida")
    
    current_stage = project[stage_key]
    if not current_stage.get("start_date"):
        raise HTTPException(status_code=400, detail="Esta etapa aún no ha comenzado")
    
    start = datetime.fromisoformat(current_stage["start_date"])
    new_end = start + timedelta(days=new_days)
    
    updates = {
        f"{stage_key}.estimated_days": new_days,
        f"{stage_key}.end_date": new_end.isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.update_one({"project_id": project_id}, {"$set": updates})
    
    updated_project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return Project(**updated_project)

@api_router.post("/projects/{project_id}/set-my-estimate")
async def set_my_stage_estimate(project_id: str, estimated_days: int, user: User = Depends(get_current_user)):
    """Permite al usuario de la etapa actual definir su tiempo estimado"""
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    current_status = project["status"]
    
    # Verificar permisos según etapa actual
    stage_permissions = {
        "design": UserRole.DESIGNER,
        "validation": UserRole.MANUFACTURING_CHIEF,
        "purchasing": UserRole.PURCHASING,
        "warehouse": UserRole.WAREHOUSE,
        "manufacturing": UserRole.DESIGNER
    }
    
    if current_status not in stage_permissions:
        raise HTTPException(status_code=400, detail="El proyecto está en un estado que no permite definir tiempo")
    
    if user.role != stage_permissions[current_status] and user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="No tienes permiso para definir el tiempo de esta etapa")
    
    stage_key = f"{current_status}_stage"
    current_stage = project.get(stage_key, {})
    
    if not current_stage.get("start_date"):
        raise HTTPException(status_code=400, detail="Esta etapa aún no ha comenzado")
    
    start = datetime.fromisoformat(current_stage["start_date"])
    new_end = start + timedelta(days=estimated_days)
    
    updates = {
        f"{stage_key}.estimated_days": estimated_days,
        f"{stage_key}.end_date": new_end.isoformat(),
        f"{stage_key}.estimated_by": user.user_id,
        f"{stage_key}.estimated_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.update_one({"project_id": project_id}, {"$set": updates})
    
    updated_project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return Project(**updated_project)

@api_router.post("/projects/{project_id}/confirm-materials")
async def confirm_materials_received(project_id: str, user: User = Depends(get_current_user)):
    """Bodega confirma que todos los materiales están listos para fabricación"""
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    if project["status"] != ProjectStatus.WAREHOUSE:
        raise HTTPException(status_code=400, detail="El proyecto no está en etapa de bodega")
    
    if user.role != UserRole.WAREHOUSE and user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo el usuario de bodega puede confirmar los materiales")
    
    updates = {
        "warehouse_stage.materials_confirmed": True,
        "warehouse_stage.materials_confirmed_at": datetime.now(timezone.utc).isoformat(),
        "warehouse_stage.materials_confirmed_by": user.user_id,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.update_one({"project_id": project_id}, {"$set": updates})
    
    updated_project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    return Project(**updated_project)

@api_router.post("/projects/{project_id}/complete-early")
async def complete_stage_early(project_id: str, user: User = Depends(get_current_user)):
    """Permite completar la etapa actual antes del plazo y ganar estrellas"""
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    current_status = project["status"]
    
    # Verificar permisos según etapa actual
    stage_permissions = {
        "design": UserRole.DESIGNER,
        "validation": UserRole.MANUFACTURING_CHIEF,
        "purchasing": UserRole.PURCHASING,
        "warehouse": UserRole.WAREHOUSE,
        "manufacturing": UserRole.DESIGNER
    }
    
    if current_status not in stage_permissions:
        raise HTTPException(status_code=400, detail="El proyecto no está en una etapa que se pueda completar")
    
    if user.role != stage_permissions[current_status] and user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="No tienes permiso para completar esta etapa")
    
    stage_key = f"{current_status}_stage"
    current_stage = project.get(stage_key, {})
    
    if not current_stage.get("start_date"):
        raise HTTPException(status_code=400, detail="Esta etapa aún no ha iniciado")
    
    now = datetime.now(timezone.utc)
    stars_earned = 0
    is_early = False
    days_early = 0
    
    # Solo calcular estrellas si hay fecha de fin definida
    if current_stage.get("end_date"):
        end_date = datetime.fromisoformat(current_stage["end_date"])
        is_early = now < end_date
        days_early = (end_date - now).days if is_early else 0
        
        if is_early:
            # Calcular estrellas según días de anticipación
            if days_early >= 5:
                stars_earned = 3
            elif days_early >= 2:
                stars_earned = 2
            else:
                stars_earned = 1
            
            # Agregar estrellas al usuario
            await db.users.update_one(
                {"user_id": user.user_id},
                {"$inc": {"stars": stars_earned}}
            )
    
    # Marcar etapa como completada
    updates = {
        f"{stage_key}.status": StageStatus.COMPLETED,
        f"{stage_key}.end_date": now.isoformat(),
        f"{stage_key}.actual_days": (now - datetime.fromisoformat(current_stage["start_date"])).days,
        f"{stage_key}.completed_early": is_early,
        f"{stage_key}.days_early": days_early,
        "updated_at": now.isoformat()
    }
    
    # Si es la última etapa (manufacturing), completar el proyecto
    if current_status == ProjectStatus.MANUFACTURING:
        updates["status"] = ProjectStatus.COMPLETED
        updates["completed_at"] = now.isoformat()
        updates["completed_early"] = is_early
        
        # Notificar al admin
        admins = await db.users.find({"role": UserRole.SUPERADMIN}, {"_id": 0}).to_list(100)
        for admin in admins:
            await create_notification(
                admin["user_id"],
                project_id,
                f"🎉 El proyecto '{project['name']}' ha sido completado" + 
                (f" con {days_early} días de anticipación! El usuario ganó {stars_earned} ⭐" if is_early else ".")
            )
    else:
        # Avanzar a la siguiente etapa
        stage_map = {
            "design": ("validation", UserRole.MANUFACTURING_CHIEF),
            "validation": ("purchasing", UserRole.PURCHASING),
            "purchasing": ("warehouse", UserRole.WAREHOUSE),
            "warehouse": ("manufacturing", UserRole.DESIGNER)
        }
        
        next_status, next_role = stage_map[current_status]
        next_stage_key = f"{next_status}_stage"
        
        updates["status"] = next_status
        updates[f"{next_stage_key}.start_date"] = now.isoformat()
        updates[f"{next_stage_key}.status"] = StageStatus.IN_PROGRESS
        updates[f"{next_stage_key}.estimated_days"] = 0
        
        # Notificar al siguiente usuario
        next_users = await db.users.find({"role": next_role}, {"_id": 0}).to_list(100)
        for next_user in next_users:
            await create_notification(
                next_user["user_id"],
                project_id,
                f"El proyecto '{project['name']}' avanzó a tu etapa" +
                (f" (completado {days_early} días antes!)" if is_early else ".")
            )
        
        # Notificar al admin si fue antes del plazo
        if is_early:
            admins = await db.users.find({"role": UserRole.SUPERADMIN}, {"_id": 0}).to_list(100)
            for admin in admins:
                await create_notification(
                    admin["user_id"],
                    project_id,
                    f"⭐ {user.name} completó la etapa '{current_status}' del proyecto '{project['name']}' con {days_early} días de anticipación! Ganó {stars_earned} estrellas."
                )
    
    await db.projects.update_one({"project_id": project_id}, {"$set": updates})
    
    updated_project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    return {
        "project": Project(**updated_project),
        "stars_earned": stars_earned,
        "days_early": days_early,
        "is_early": is_early,
        "message": f"¡Felicidades! Completaste {days_early} días antes y ganaste {stars_earned} ⭐" if is_early else "Etapa completada"
    }

# ==================== DOCUMENT ROUTES ====================

@api_router.post("/documents/upload")
async def upload_document(
    project_id: str,
    stage: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user)
):
    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    try:
        service = await get_drive_service(user)
        
        file_content = await file.read()
        file_metadata = {
            'name': file.filename,
            'mimeType': file.content_type
        }
        
        media = MediaIoBaseUpload(
            io.BytesIO(file_content),
            mimetype=file.content_type,
            resumable=True
        )
        
        drive_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, webViewLink'
        ).execute()
        
        document = {
            "document_id": str(uuid.uuid4()),
            "project_id": project_id,
            "filename": file.filename,
            "file_type": file.content_type,
            "drive_file_id": drive_file['id'],
            "drive_url": drive_file['webViewLink'],
            "uploaded_by": user.user_id,
            "stage": stage,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.documents.insert_one(document)
        document.pop("_id", None)
        
        return DocumentUpload(**document)
    
    except Exception as e:
        logger.error(f"Error uploading to Drive: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al subir archivo: {str(e)}")

@api_router.post("/documents/upload-local")
async def upload_document_local(
    project_id: str,
    stage: str,
    file: UploadFile = File(...),
    document_type: str = "general",
    user: User = Depends(get_current_user)
):
    project = await db.projects.find_one({"project_id": project_id})
    if not project:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    
    # Validar que el listado de materiales sea un archivo Excel
    if document_type == "materials_list":
        valid_extensions = ['.xls', '.xlsx']
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in valid_extensions:
            raise HTTPException(
                status_code=400, 
                detail="El listado de materiales debe ser un archivo Excel (.xls o .xlsx)"
            )
    
    try:
        # Crear carpeta del proyecto si no existe
        project_upload_dir = Path(f"/app/backend/uploads/{project_id}")
        project_upload_dir.mkdir(parents=True, exist_ok=True)
        
        # Generar nombre único para el archivo
        file_extension = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = project_upload_dir / unique_filename
        
        # Guardar archivo
        file_content = await file.read()
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Crear registro en base de datos
        document = {
            "document_id": str(uuid.uuid4()),
            "project_id": project_id,
            "filename": file.filename,
            "file_type": file.content_type,
            "document_type": document_type,
            "storage_type": "local",
            "local_path": str(file_path),
            "unique_filename": unique_filename,
            "uploaded_by": user.user_id,
            "stage": stage,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.documents.insert_one(document)
        document.pop("_id", None)
        
        return document
    
    except Exception as e:
        logger.error(f"Error uploading local file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al subir archivo: {str(e)}")

@api_router.get("/documents/download/{document_id}")
async def download_document(document_id: str, user: User = Depends(get_current_user)):
    from fastapi.responses import FileResponse
    
    document = await db.documents.find_one({"document_id": document_id}, {"_id": 0})
    if not document:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    
    if document.get("storage_type") == "local":
        file_path = Path(document["local_path"])
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Archivo no encontrado en el servidor")
        
        return FileResponse(
            path=str(file_path),
            filename=document["filename"],
            media_type=document.get("file_type", "application/octet-stream")
        )
    else:
        # Redirigir a Google Drive
        return {"redirect_url": document.get("drive_url")}

@api_router.get("/documents/project/{project_id}", response_model=List[Dict])
async def get_project_documents(project_id: str, user: User = Depends(get_current_user)):
    documents = await db.documents.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    return documents

# ==================== PROJECT STUDY ROUTES ====================

@api_router.post("/studies", response_model=ProjectStudy)
async def create_study(study_input: ProjectStudyCreate, user: User = Depends(get_current_user)):
    study_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    study_doc = {
        "study_id": study_id,
        "name": study_input.name,
        "description": study_input.description,
        "client_name": study_input.client_name,
        "created_by": user.user_id,
        "status": "draft",
        "design_stage": {
            "estimated_days": 0,
            "estimated_by": None,
            "estimated_at": None,
            "notes": None
        },
        "validation_stage": {
            "estimated_days": 0,
            "estimated_by": None,
            "estimated_at": None,
            "notes": None
        },
        "purchasing_stage": {
            "estimated_days": 0,
            "estimated_by": None,
            "estimated_at": None,
            "notes": None
        },
        "warehouse_stage": {
            "estimated_days": 0,
            "estimated_by": None,
            "estimated_at": None,
            "notes": None
        },
        "manufacturing_stage": {
            "estimated_days": 0,
            "estimated_by": None,
            "estimated_at": None,
            "notes": None
        },
        "total_estimated_days": 0,
        "estimated_start_date": None,
        "estimated_end_date": None,
        "started_project_id": None,
        "created_at": now,
        "updated_at": now
    }
    
    await db.studies.insert_one(study_doc)
    study_doc.pop("_id", None)
    
    return ProjectStudy(**study_doc)

@api_router.get("/studies")
async def get_studies(user: User = Depends(get_current_user)):
    # All users can see all studies to enable collaboration
    # Each role can edit only their allowed stages
    studies = await db.studies.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Add creator name to each study
    result = []
    for s in studies:
        study_dict = dict(s)
        creator = await db.users.find_one({"user_id": s.get("created_by")}, {"_id": 0, "name": 1})
        study_dict["created_by_name"] = creator["name"] if creator else "Desconocido"
        result.append(study_dict)
    
    return result

@api_router.get("/studies/{study_id}", response_model=ProjectStudy)
async def get_study(study_id: str, user: User = Depends(get_current_user)):
    study = await db.studies.find_one({"study_id": study_id}, {"_id": 0})
    if not study:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    return ProjectStudy(**study)

@api_router.put("/studies/{study_id}/estimate/{stage}")
async def update_stage_estimate(
    study_id: str, 
    stage: str, 
    estimate: StageEstimateUpdate,
    user: User = Depends(get_current_user)
):
    study = await db.studies.find_one({"study_id": study_id}, {"_id": 0})
    if not study:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    
    # En estudios de proyectos (simulaciones), todos los usuarios pueden 
    # editar todas las etapas para hacer estimaciones colaborativas
    allowed_roles = [UserRole.DESIGNER, UserRole.MANUFACTURING_CHIEF, UserRole.PURCHASING, UserRole.WAREHOUSE, UserRole.SUPERADMIN]
    valid_stages = ["design", "validation", "purchasing", "warehouse", "manufacturing"]
    
    if stage not in valid_stages:
        raise HTTPException(status_code=400, detail="Etapa inválida")
    
    if user.role not in allowed_roles:
        raise HTTPException(status_code=403, detail="No tienes permiso para estimar etapas")
    
    stage_key = f"{stage}_stage"
    now = datetime.now(timezone.utc).isoformat()
    
    # Update stage estimate
    update_data = {
        f"{stage_key}.estimated_days": estimate.estimated_days,
        f"{stage_key}.estimated_by": user.user_id,
        f"{stage_key}.estimated_at": now,
        f"{stage_key}.notes": estimate.notes,
        "updated_at": now
    }
    
    await db.studies.update_one({"study_id": study_id}, {"$set": update_data})
    
    # Recalculate total
    updated_study = await db.studies.find_one({"study_id": study_id}, {"_id": 0})
    total_days = sum([
        updated_study["design_stage"]["estimated_days"],
        updated_study["validation_stage"]["estimated_days"],
        updated_study["purchasing_stage"]["estimated_days"],
        updated_study["warehouse_stage"]["estimated_days"],
        updated_study["manufacturing_stage"]["estimated_days"]
    ])
    
    # Calculate dates if all estimates are provided
    if total_days > 0:
        start_date = datetime.now(timezone.utc)
        end_date = start_date + timedelta(days=total_days)
        
        await db.studies.update_one(
            {"study_id": study_id},
            {"$set": {
                "total_estimated_days": total_days,
                "estimated_start_date": start_date.isoformat(),
                "estimated_end_date": end_date.isoformat()
            }}
        )
    
    final_study = await db.studies.find_one({"study_id": study_id}, {"_id": 0})
    return ProjectStudy(**final_study)

@api_router.post("/studies/{study_id}/approve")
async def approve_study(study_id: str, user: User = Depends(get_current_user)):
    study = await db.studies.find_one({"study_id": study_id}, {"_id": 0})
    if not study:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    
    if user.role != UserRole.SUPERADMIN and user.user_id != study["created_by"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para aprobar este estudio")
    
    # Create real project from study
    project_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    design_days = study["design_stage"]["estimated_days"]
    if design_days == 0:
        raise HTTPException(status_code=400, detail="Debe tener al menos estimación de diseño")
    
    design_start = now
    design_end = design_start + timedelta(days=design_days)
    
    project_doc = {
        "project_id": project_id,
        "name": study["name"],
        "description": study["description"],
        "client_name": study["client_name"],
        "created_by": study["created_by"],
        "status": ProjectStatus.DESIGN,
        "design_stage": {
            "estimated_days": design_days,
            "actual_days": 0,
            "start_date": design_start.isoformat(),
            "end_date": design_end.isoformat(),
            "responsible_user_id": study["created_by"],
            "status": StageStatus.IN_PROGRESS
        },
        "validation_stage": {"estimated_days": study["validation_stage"]["estimated_days"], "actual_days": 0, "status": StageStatus.PENDING},
        "purchasing_stage": {"estimated_days": study["purchasing_stage"]["estimated_days"], "actual_days": 0, "status": StageStatus.PENDING},
        "warehouse_stage": {"estimated_days": study["warehouse_stage"]["estimated_days"], "actual_days": 0, "status": StageStatus.PENDING},
        "manufacturing_stage": {"estimated_days": study["manufacturing_stage"]["estimated_days"], "actual_days": 0, "status": StageStatus.PENDING},
        "created_at": now.isoformat(),
        "updated_at": now.isoformat()
    }
    
    await db.projects.insert_one(project_doc)
    
    # Update study status
    await db.studies.update_one(
        {"study_id": study_id},
        {"$set": {
            "status": "approved",
            "started_project_id": project_id,
            "updated_at": now.isoformat()
        }}
    )
    
    return {"project_id": project_id, "message": "Estudio aprobado y proyecto creado"}

@api_router.get("/studies/{study_id}/pdf")
async def export_study_pdf(study_id: str, user: User = Depends(get_current_user)):
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_CENTER
    from reportlab.graphics.shapes import Drawing, Rect, String
    from reportlab.graphics import renderPDF
    import tempfile
    
    study = await db.studies.find_one({"study_id": study_id}, {"_id": 0})
    if not study:
        raise HTTPException(status_code=404, detail="Estudio no encontrado")
    
    # Create temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_file:
        pdf_path = tmp_file.name
    
    # Use landscape orientation for better Gantt visualization
    doc = SimpleDocTemplate(pdf_path, pagesize=landscape(A4), topMargin=0.5*inch, bottomMargin=0.5*inch)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#1e293b'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    elements.append(Paragraph("ESTUDIO DE PROYECTO", title_style))
    elements.append(Spacer(1, 0.3*inch))
    
    # Project Info
    info_data = [
        ["Proyecto:", study["name"]],
        ["Cliente:", study["client_name"]],
        ["Descripción:", study["description"]],
        ["Duración Total:", f"{study['total_estimated_days']} días"],
        ["Fecha Estimada Inicio:", study["estimated_start_date"][:10] if study.get("estimated_start_date") else "Por definir"],
        ["Fecha Estimada Fin:", study["estimated_end_date"][:10] if study.get("estimated_end_date") else "Por definir"],
    ]
    
    info_table = Table(info_data, colWidths=[2.5*inch, 7.5*inch])
    info_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f1f5f9')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#1e293b')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1'))
    ]))
    
    elements.append(info_table)
    elements.append(Spacer(1, 0.4*inch))
    
    # Gantt Chart
    if study['total_estimated_days'] > 0:
        elements.append(Paragraph("DIAGRAMA DE GANTT", styles['Heading2']))
        elements.append(Spacer(1, 0.2*inch))
        
        # Create Gantt drawing - wider for landscape
        gantt_width = 10 * inch
        gantt_height = 3 * inch
        d = Drawing(gantt_width, gantt_height)
        
        stages_info = [
            ("design_stage", "Diseño", colors.HexColor('#3B82F6')),
            ("validation_stage", "Validación", colors.HexColor('#A855F7')),
            ("purchasing_stage", "Compras", colors.HexColor('#EAB308')),
            ("warehouse_stage", "Bodega", colors.HexColor('#F97316')),
            ("manufacturing_stage", "Fabricación", colors.HexColor('#06B6D4'))
        ]
        
        y_offset = gantt_height - 40
        bar_height = 35
        spacing = 50
        
        cumulative_days = 0
        for stage_key, stage_label, stage_color in stages_info:
            stage_data = study[stage_key]
            if stage_data['estimated_days'] > 0:
                # Label
                d.add(String(10, y_offset + 10, stage_label, fontSize=9, fillColor=colors.HexColor('#475569')))
                
                # Calculate bar position and width
                start_x = 120 + (cumulative_days / study['total_estimated_days']) * (gantt_width - 140)
                bar_width = (stage_data['estimated_days'] / study['total_estimated_days']) * (gantt_width - 140)
                
                # Draw bar
                d.add(Rect(start_x, y_offset, bar_width, bar_height, 
                          fillColor=stage_color, strokeColor=stage_color, strokeWidth=1))
                
                # Days text
                d.add(String(start_x + 5, y_offset + 12, f"{stage_data['estimated_days']}d", 
                           fontSize=8, fillColor=colors.white, fontName='Helvetica-Bold'))
                
                cumulative_days += stage_data['estimated_days']
                y_offset -= spacing
        
        # Timeline markers
        timeline_y = 20
        for i in [0, 0.25, 0.5, 0.75, 1.0]:
            x_pos = 120 + i * (gantt_width - 140)
            d.add(Rect(x_pos, timeline_y, 1, 10, fillColor=colors.HexColor('#94A3B8')))
            day_label = int(i * study['total_estimated_days'])
            d.add(String(x_pos - 10, timeline_y - 10, f"Día {day_label}", 
                        fontSize=7, fillColor=colors.HexColor('#64748B')))
        
        elements.append(d)
        elements.append(Spacer(1, 0.3*inch))
    
    # Stages Timeline Table
    elements.append(Paragraph("CRONOGRAMA ESTIMADO POR ETAPAS", styles['Heading2']))
    elements.append(Spacer(1, 0.2*inch))
    
    stages_data = [
        ["Etapa", "Días Estimados", "Notas", "Estimado Por"]
    ]
    
    stage_names = {
        "design_stage": "Diseño",
        "validation_stage": "Validación Técnica",
        "purchasing_stage": "Compras",
        "warehouse_stage": "Bodega / Recepción",
        "manufacturing_stage": "Fabricación"
    }
    
    for stage_key, stage_label in stage_names.items():
        stage_data = study[stage_key]
        estimated_by = "Pendiente"
        if stage_data.get("estimated_by"):
            user_doc = await db.users.find_one({"user_id": stage_data["estimated_by"]}, {"_id": 0, "name": 1})
            estimated_by = user_doc["name"] if user_doc else "Usuario"
        
        stages_data.append([
            stage_label,
            f"{stage_data['estimated_days']} días",
            stage_data.get("notes") or "-",
            estimated_by
        ])
    
    stages_table = Table(stages_data, colWidths=[2.5*inch, 1.5*inch, 4*inch, 2*inch])
    stages_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f97316')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    
    elements.append(stages_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Footer
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.HexColor('#64748b'),
        alignment=TA_CENTER
    )
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph(f"Generado el {datetime.now(timezone.utc).strftime('%d/%m/%Y %H:%M')}", footer_style))
    elements.append(Paragraph("Sistema Robfu - Gestión de Producción Industrial", footer_style))
    
    doc.build(elements)
    
    return FileResponse(
        path=pdf_path,
        media_type="application/pdf",
        filename=f"estudio_{study['name'].replace(' ', '_')}.pdf"
    )

# ==================== PURCHASE ORDER ROUTES ====================

@api_router.post("/purchase-orders", response_model=PurchaseOrder)
async def create_purchase_order(po_input: PurchaseOrderCreate, user: User = Depends(get_current_user)):
    if user.role != UserRole.PURCHASING:
        raise HTTPException(status_code=403, detail="Solo el departamento de compras puede crear órdenes")
    
    total = sum(item.quantity * item.unit_price for item in po_input.items)
    
    po_doc = {
        "po_id": str(uuid.uuid4()),
        "project_id": po_input.project_id,
        "supplier": po_input.supplier,
        "items": [item.model_dump() for item in po_input.items],
        "total": total,
        "status": "pending",
        "notes": po_input.notes,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.purchase_orders.insert_one(po_doc)
    po_doc.pop("_id", None)
    
    return PurchaseOrder(**po_doc)

@api_router.get("/purchase-orders", response_model=List[PurchaseOrder])
async def get_purchase_orders(project_id: Optional[str] = None, user: User = Depends(get_current_user)):
    query = {}
    if project_id:
        query["project_id"] = project_id
    
    orders = await db.purchase_orders.find(query, {"_id": 0}).to_list(1000)
    return [PurchaseOrder(**o) for o in orders]

@api_router.put("/purchase-orders/{po_id}/status")
async def update_po_status(po_id: str, status: str, user: User = Depends(get_current_user)):
    await db.purchase_orders.update_one(
        {"po_id": po_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    po = await db.purchase_orders.find_one({"po_id": po_id}, {"_id": 0})
    return PurchaseOrder(**po)

# ==================== GANTT ROUTES ====================

@api_router.get("/gantt/data")
async def get_gantt_data(user: User = Depends(get_current_user)):
    query = {}
    if user.role == UserRole.DESIGNER:
        query["created_by"] = user.user_id
    
    projects = await db.projects.find(query, {"_id": 0}).to_list(1000)
    
    gantt_tasks = []
    dependencies = []
    
    for project in projects:
        stages = [
            ("design_stage", "Diseño"),
            ("validation_stage", "Validación"),
            ("purchasing_stage", "Compras"),
            ("warehouse_stage", "Bodega"),
            ("manufacturing_stage", "Fabricación")
        ]
        
        previous_task_id = None
        for idx, (stage_key, stage_name) in enumerate(stages):
            stage = project.get(stage_key, {})
            if stage.get("start_date"):
                task_id = f"{project['project_id']}-{stage_key}"
                gantt_tasks.append({
                    "id": task_id,
                    "project_id": project["project_id"],
                    "project_name": project["name"],
                    "name": f"{project['name']} - {stage_name}",
                    "start": stage["start_date"],
                    "end": stage.get("end_date", stage["start_date"]),
                    "progress": 100 if stage["status"] == StageStatus.COMPLETED else 50 if stage["status"] == StageStatus.IN_PROGRESS else 0,
                    "status": stage["status"],
                    "stage": stage_key,
                    "dependencies": [previous_task_id] if previous_task_id else []
                })
                
                # Add dependency link for frontend visualization
                if previous_task_id:
                    dependencies.append({
                        "from": previous_task_id,
                        "to": task_id
                    })
                
                previous_task_id = task_id
    
    return {
        "tasks": gantt_tasks,
        "dependencies": dependencies
    }

# ==================== DASHBOARD ROUTES ====================

@api_router.get("/dashboard/kpis")
async def get_dashboard_kpis(user: User = Depends(get_current_user)):
    if user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo el superadmin puede acceder a los KPIs")
    
    total_projects = await db.projects.count_documents({})
    active_projects = await db.projects.count_documents({"status": {"$nin": [ProjectStatus.COMPLETED, ProjectStatus.DRAFT]}})
    completed_projects = await db.projects.count_documents({"status": ProjectStatus.COMPLETED})
    
    projects = await db.projects.find({"status": {"$ne": ProjectStatus.COMPLETED}}, {"_id": 0}).to_list(1000)
    
    delayed_count = 0
    on_time_count = 0
    at_risk_count = 0
    
    now = datetime.now(timezone.utc)
    
    for project in projects:
        stage_key = f"{project['status']}_stage"
        if stage_key in project:
            stage = project[stage_key]
            if stage.get("end_date"):
                end_date = datetime.fromisoformat(stage["end_date"])
                days_diff = (end_date - now).days
                
                if days_diff < 0:
                    delayed_count += 1
                elif days_diff <= 2:
                    at_risk_count += 1
                else:
                    on_time_count += 1
    
    delays_by_stage = {}
    for stage in ["design", "validation", "purchasing", "warehouse", "manufacturing"]:
        stage_key = f"{stage}_stage"
        stage_projects = [p for p in projects if p.get("status") == stage]
        delayed = 0
        for p in stage_projects:
            if stage_key in p and p[stage_key].get("end_date"):
                end_date = datetime.fromisoformat(p[stage_key]["end_date"])
                if end_date < now:
                    delayed += 1
        delays_by_stage[stage] = delayed
    
    return {
        "total_projects": total_projects,
        "active_projects": active_projects,
        "completed_projects": completed_projects,
        "delayed_projects": delayed_count,
        "on_time_projects": on_time_count,
        "at_risk_projects": at_risk_count,
        "delays_by_stage": delays_by_stage
    }

@api_router.get("/dashboard/projects-by-status")
async def get_projects_by_status(status: str, user: User = Depends(get_current_user)):
    if user.role != UserRole.SUPERADMIN:
        raise HTTPException(status_code=403, detail="Solo el superadmin puede acceder")
    
    all_projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    now = datetime.now(timezone.utc)
    
    filtered_projects = []
    
    for project in all_projects:
        if status == "total":
            filtered_projects.append(project)
        else:
            # Check project status based on current stage end date
            stage_key = f"{project['status']}_stage"
            if stage_key in project and project[stage_key].get("end_date"):
                end_date = datetime.fromisoformat(project[stage_key]["end_date"])
                days_diff = (end_date - now).days
                
                if status == "delayed" and days_diff < 0:
                    filtered_projects.append(project)
                elif status == "at_risk" and 0 <= days_diff <= 2:
                    filtered_projects.append(project)
                elif status == "on_time" and days_diff > 2:
                    filtered_projects.append(project)
    
    # Generate Gantt data for filtered projects
    gantt_tasks = []
    for project in filtered_projects:
        stages = [
            ("design_stage", "Diseño"),
            ("validation_stage", "Validación"),
            ("purchasing_stage", "Compras"),
            ("warehouse_stage", "Bodega"),
            ("manufacturing_stage", "Fabricación")
        ]
        
        for stage_key, stage_name in stages:
            stage = project.get(stage_key, {})
            if stage.get("start_date"):
                gantt_tasks.append({
                    "id": f"{project['project_id']}-{stage_key}",
                    "project_id": project["project_id"],
                    "project_name": project["name"],
                    "name": f"{project['name']} - {stage_name}",
                    "start": stage["start_date"],
                    "end": stage.get("end_date", stage["start_date"]),
                    "progress": 100 if stage["status"] == StageStatus.COMPLETED else 50 if stage["status"] == StageStatus.IN_PROGRESS else 0,
                    "status": stage["status"]
                })
    
    return {
        "projects": filtered_projects,
        "gantt_tasks": gantt_tasks
    }

# ==================== NOTIFICATION ROUTES ====================

@api_router.get("/notifications", response_model=List[Notification])
async def get_notifications(user: User = Depends(get_current_user)):
    notifications = await db.notifications.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return [Notification(**n) for n in notifications]

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: User = Depends(get_current_user)):
    await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user.user_id},
        {"$set": {"read": True}}
    )
    return {"success": True}

# ==================== OBSERVATION/COMMENT ROUTES ====================

@api_router.post("/observations", response_model=Observation)
async def create_observation(obs_input: ObservationCreate, user: User = Depends(get_current_user)):
    observation_id = str(uuid.uuid4())
    
    observation = {
        "observation_id": observation_id,
        "project_id": obs_input.project_id,
        "stage": obs_input.stage,
        "content": obs_input.content,
        "created_by": user.user_id,
        "created_by_name": user.name,
        "created_by_role": user.role,
        "recipients": obs_input.recipients,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.observations.insert_one(observation)
    
    # Create notifications for recipients
    project = await db.projects.find_one({"project_id": obs_input.project_id}, {"_id": 0})
    project_name = project["name"] if project else "Proyecto"
    
    for recipient_id in obs_input.recipients:
        await create_notification(
            recipient_id,
            obs_input.project_id,
            f"{user.name} te ha mencionado en una observación del proyecto '{project_name}'"
        )
    
    observation.pop("_id", None)
    return Observation(**observation)

@api_router.get("/observations/project/{project_id}", response_model=List[Observation])
async def get_project_observations(project_id: str, user: User = Depends(get_current_user)):
    observations = await db.observations.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    return [Observation(**o) for o in observations]

@api_router.get("/observations/my-mentions", response_model=List[Observation])
async def get_my_mentions(user: User = Depends(get_current_user)):
    observations = await db.observations.find(
        {"recipients": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return [Observation(**o) for o in observations]

# ==================== USER PROFILE/AVATAR ROUTES ====================

@api_router.post("/users/upload-avatar")
async def upload_avatar(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    try:
        # Validate file type
        if not file.content_type.startswith('image/'):
            raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")
        
        # Generate unique filename
        file_extension = Path(file.filename).suffix
        unique_filename = f"{user.user_id}{file_extension}"
        file_path = Path(f"/app/backend/avatars/{unique_filename}")
        
        # Save file
        file_content = await file.read()
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Update user avatar_url
        avatar_url = f"/api/avatars/{unique_filename}"
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": {"avatar_url": avatar_url}}
        )
        
        return {"avatar_url": avatar_url, "message": "Avatar actualizado exitosamente"}
    
    except Exception as e:
        logger.error(f"Error uploading avatar: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al subir avatar: {str(e)}")

@api_router.get("/avatars/{filename}")
async def get_avatar(filename: str):
    file_path = Path(f"/app/backend/avatars/{filename}")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Avatar no encontrado")
    
    return FileResponse(
        path=str(file_path),
        media_type="image/jpeg"
    )

@api_router.get("/users/all", response_model=List[Dict])
async def get_all_users(user: User = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

@api_router.put("/users/me", response_model=User)
async def update_user_profile(user_update: UserUpdate, user: User = Depends(get_current_user)):
    update_data = {}
    
    if user_update.name:
        update_data["name"] = user_update.name
    
    if user_update.email:
        # Check if email already exists for another user
        existing = await db.users.find_one({"email": user_update.email, "user_id": {"$ne": user.user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="El email ya está en uso")
        update_data["email"] = user_update.email
    
    if user_update.role:
        update_data["role"] = user_update.role
    
    if update_data:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": update_data}
        )
    
    # Fetch updated user
    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "password_hash": 0})
    return User(**updated_user)

# ==================== GOOGLE DRIVE ROUTES ====================

@api_router.get("/drive/connect")
async def connect_drive(user: User = Depends(get_current_user)):
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google Drive no está configurado")
    
    try:
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [GOOGLE_DRIVE_REDIRECT_URI]
                }
            },
            scopes=['https://www.googleapis.com/auth/drive'],
            redirect_uri=GOOGLE_DRIVE_REDIRECT_URI
        )
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=user.user_id
        )
        
        return {"authorization_url": authorization_url}
    
    except Exception as e:
        logger.error(f"Failed to initiate OAuth: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al iniciar OAuth: {str(e)}")

@api_router.get("/drive/callback")
async def drive_callback(code: str = Query(...), state: str = Query(...)):
    try:
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [GOOGLE_DRIVE_REDIRECT_URI]
                }
            },
            scopes=None,
            redirect_uri=GOOGLE_DRIVE_REDIRECT_URI
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        required_scopes = {"https://www.googleapis.com/auth/drive"}
        granted_scopes = set(credentials.scopes or [])
        if not required_scopes.issubset(granted_scopes):
            missing = required_scopes - granted_scopes
            raise HTTPException(status_code=400, detail=f"Faltan permisos de Drive: {', '.join(missing)}")
        
        await db.drive_credentials.update_one(
            {"user_id": state},
            {"$set": {
                "user_id": state,
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_uri": credentials.token_uri,
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "scopes": credentials.scopes,
                "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        logger.info(f"Drive credentials stored for user {state}")
        
        return RedirectResponse(url=f"{FRONTEND_URL}?drive_connected=true")
    
    except Exception as e:
        logger.error(f"OAuth callback failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error en OAuth: {str(e)}")

@api_router.get("/drive/status")
async def get_drive_status(user: User = Depends(get_current_user)):
    creds = await db.drive_credentials.find_one({"user_id": user.user_id})
    return {"connected": creds is not None}

# ==================== INCLUDE ROUTER ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()