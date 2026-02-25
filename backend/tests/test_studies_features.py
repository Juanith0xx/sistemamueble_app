"""
Test suite for Studies features:
1. Study approval endpoint 
2. PDF export endpoint
3. Role permissions for purchasing to edit purchasing/warehouse stages
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_USERS = {
    "admin": {"email": "admin@sistemamuebles.cl", "password": "test123"},
    "designer": {"email": "disenador@sistemamuebles.cl", "password": "test123"},
    "purchasing": {"email": "compras@sistemamuebles.cl", "password": "test123"},
    "warehouse": {"email": "bodega@sistemamuebles.cl", "password": "test123"},
}


class TestAuthentication:
    """Authentication tests to get tokens for other tests"""
    
    def test_login_admin(self, api_client):
        """Test admin login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["admin"])
        assert response.status_code == 200, f"Admin login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        print(f"Admin login successful - role: {data['user']['role']}")
    
    def test_login_designer(self, api_client):
        """Test designer login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["designer"])
        assert response.status_code == 200, f"Designer login failed: {response.text}"
        data = response.json()
        assert data['user']['role'] == 'designer'
        print(f"Designer login successful")
    
    def test_login_purchasing(self, api_client):
        """Test purchasing login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["purchasing"])
        assert response.status_code == 200, f"Purchasing login failed: {response.text}"
        data = response.json()
        assert data['user']['role'] == 'purchasing'
        print(f"Purchasing login successful")
    
    def test_login_warehouse(self, api_client):
        """Test warehouse login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["warehouse"])
        assert response.status_code == 200, f"Warehouse login failed: {response.text}"
        data = response.json()
        assert data['user']['role'] == 'warehouse'
        print(f"Warehouse login successful")


class TestStudyApproval:
    """Test study approval endpoint /api/studies/{study_id}/approve"""
    
    def test_create_and_approve_study_as_designer(self, designer_client):
        """Test creating a study and approving it"""
        # Create a study
        study_data = {
            "name": "TEST_Study_Approval",
            "description": "Test study for approval testing",
            "client_name": "Test Client"
        }
        create_response = designer_client.post(f"{BASE_URL}/api/studies", json=study_data)
        assert create_response.status_code == 200, f"Study creation failed: {create_response.text}"
        
        study = create_response.json()
        study_id = study["study_id"]
        print(f"Study created with ID: {study_id}")
        
        # Add design stage estimate (required for approval)
        estimate_response = designer_client.put(
            f"{BASE_URL}/api/studies/{study_id}/estimate/design",
            json={"estimated_days": 5, "notes": "Test design estimate"}
        )
        assert estimate_response.status_code == 200, f"Design estimate failed: {estimate_response.text}"
        print("Design estimate added successfully")
        
        # Approve the study
        approve_response = designer_client.post(f"{BASE_URL}/api/studies/{study_id}/approve")
        assert approve_response.status_code == 200, f"Approval failed: {approve_response.text}"
        
        data = approve_response.json()
        assert "project_id" in data, "Response should contain project_id"
        assert "message" in data, "Response should contain message"
        print(f"Study approved successfully - project_id: {data['project_id']}")
    
    def test_approve_study_without_design_estimate_fails(self, designer_client):
        """Test that approval without design estimate fails"""
        # Create study without estimates
        study_data = {
            "name": "TEST_Study_No_Estimate",
            "description": "Test study without estimates",
            "client_name": "Test Client"
        }
        create_response = designer_client.post(f"{BASE_URL}/api/studies", json=study_data)
        assert create_response.status_code == 200
        
        study_id = create_response.json()["study_id"]
        
        # Try to approve without estimate
        approve_response = designer_client.post(f"{BASE_URL}/api/studies/{study_id}/approve")
        assert approve_response.status_code == 400, "Should fail with 400 when no design estimate"
        print("Correctly rejected approval without design estimate")


class TestPDFExport:
    """Test PDF export endpoint /api/studies/{study_id}/pdf"""
    
    def test_pdf_export_returns_pdf(self, designer_client):
        """Test that PDF export returns a valid PDF"""
        # Create a study with estimates
        study_data = {
            "name": "TEST_PDF_Export_Study",
            "description": "Test study for PDF export",
            "client_name": "PDF Test Client"
        }
        create_response = designer_client.post(f"{BASE_URL}/api/studies", json=study_data)
        assert create_response.status_code == 200
        
        study_id = create_response.json()["study_id"]
        
        # Add design estimate to have content in PDF
        designer_client.put(
            f"{BASE_URL}/api/studies/{study_id}/estimate/design",
            json={"estimated_days": 10, "notes": "Design work"}
        )
        
        # Export PDF
        pdf_response = designer_client.get(f"{BASE_URL}/api/studies/{study_id}/pdf")
        assert pdf_response.status_code == 200, f"PDF export failed: {pdf_response.text}"
        
        # Check content type
        content_type = pdf_response.headers.get('content-type', '')
        assert 'application/pdf' in content_type, f"Expected PDF content type, got: {content_type}"
        
        # Check PDF header (PDF files start with %PDF-)
        content = pdf_response.content
        assert content[:4] == b'%PDF', f"Content doesn't start with PDF header, got: {content[:10]}"
        
        # Check reasonable file size
        assert len(content) > 1000, "PDF file seems too small"
        print(f"PDF exported successfully - size: {len(content)} bytes")
    
    def test_pdf_export_nonexistent_study_fails(self, designer_client):
        """Test that PDF export of nonexistent study returns 404"""
        response = designer_client.get(f"{BASE_URL}/api/studies/nonexistent-id/pdf")
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for nonexistent study")


class TestPurchasingRolePermissions:
    """Test that purchasing role can edit purchasing and warehouse stages"""
    
    def test_purchasing_can_edit_purchasing_stage(self, purchasing_client, designer_client):
        """Test purchasing user can edit purchasing stage estimates"""
        # First create a study as designer
        study_data = {
            "name": "TEST_Purchasing_Stage_Edit",
            "description": "Test study for purchasing permissions",
            "client_name": "Test Client"
        }
        create_response = designer_client.post(f"{BASE_URL}/api/studies", json=study_data)
        assert create_response.status_code == 200
        
        study_id = create_response.json()["study_id"]
        print(f"Study created for purchasing test: {study_id}")
        
        # Update purchasing stage as purchasing user
        estimate_response = purchasing_client.put(
            f"{BASE_URL}/api/studies/{study_id}/estimate/purchasing",
            json={"estimated_days": 7, "notes": "Purchasing estimate by purchasing role"}
        )
        assert estimate_response.status_code == 200, f"Purchasing stage update failed: {estimate_response.text}"
        
        # Verify the estimate was saved
        data = estimate_response.json()
        assert data["purchasing_stage"]["estimated_days"] == 7
        print("Purchasing user successfully edited purchasing stage")
    
    def test_purchasing_can_edit_warehouse_stage(self, purchasing_client, designer_client):
        """Test purchasing user can edit warehouse stage estimates"""
        # Create a study as designer
        study_data = {
            "name": "TEST_Warehouse_Stage_Edit",
            "description": "Test study for warehouse permissions",
            "client_name": "Test Client"
        }
        create_response = designer_client.post(f"{BASE_URL}/api/studies", json=study_data)
        assert create_response.status_code == 200
        
        study_id = create_response.json()["study_id"]
        
        # Update warehouse stage as purchasing user
        estimate_response = purchasing_client.put(
            f"{BASE_URL}/api/studies/{study_id}/estimate/warehouse",
            json={"estimated_days": 3, "notes": "Warehouse estimate by purchasing role"}
        )
        assert estimate_response.status_code == 200, f"Warehouse stage update failed: {estimate_response.text}"
        
        data = estimate_response.json()
        assert data["warehouse_stage"]["estimated_days"] == 3
        print("Purchasing user successfully edited warehouse stage")
    
    def test_purchasing_cannot_edit_design_stage(self, purchasing_client, designer_client):
        """Test purchasing user cannot edit design stage"""
        # Create a study as designer
        study_data = {
            "name": "TEST_Design_Stage_Forbidden",
            "description": "Test study for forbidden permissions",
            "client_name": "Test Client"
        }
        create_response = designer_client.post(f"{BASE_URL}/api/studies", json=study_data)
        assert create_response.status_code == 200
        
        study_id = create_response.json()["study_id"]
        
        # Try to update design stage as purchasing user
        estimate_response = purchasing_client.put(
            f"{BASE_URL}/api/studies/{study_id}/estimate/design",
            json={"estimated_days": 5, "notes": "Should not be allowed"}
        )
        assert estimate_response.status_code == 403, f"Expected 403, got {estimate_response.status_code}"
        print("Purchasing user correctly denied from editing design stage")


class TestWarehouseRolePermissions:
    """Test warehouse role permissions"""
    
    def test_warehouse_can_edit_warehouse_stage(self, warehouse_client, designer_client):
        """Test warehouse user can edit warehouse stage estimates"""
        # Create a study as designer
        study_data = {
            "name": "TEST_Warehouse_Role_Edit",
            "description": "Test study for warehouse role permissions",
            "client_name": "Test Client"
        }
        create_response = designer_client.post(f"{BASE_URL}/api/studies", json=study_data)
        assert create_response.status_code == 200
        
        study_id = create_response.json()["study_id"]
        
        # Update warehouse stage as warehouse user
        estimate_response = warehouse_client.put(
            f"{BASE_URL}/api/studies/{study_id}/estimate/warehouse",
            json={"estimated_days": 4, "notes": "Warehouse estimate by warehouse role"}
        )
        assert estimate_response.status_code == 200, f"Warehouse stage update failed: {estimate_response.text}"
        
        data = estimate_response.json()
        assert data["warehouse_stage"]["estimated_days"] == 4
        print("Warehouse user successfully edited warehouse stage")


# Fixtures
@pytest.fixture
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def designer_client(api_client):
    """Authenticated designer client"""
    response = api_client.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["designer"])
    if response.status_code == 200:
        token = response.json()["access_token"]
        api_client.headers.update({"Authorization": f"Bearer {token}"})
        return api_client
    pytest.skip("Designer authentication failed")


@pytest.fixture
def purchasing_client():
    """Authenticated purchasing client"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["purchasing"])
    if response.status_code == 200:
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    pytest.skip("Purchasing authentication failed")


@pytest.fixture
def warehouse_client():
    """Authenticated warehouse client"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    response = session.post(f"{BASE_URL}/api/auth/login", json=TEST_USERS["warehouse"])
    if response.status_code == 200:
        token = response.json()["access_token"]
        session.headers.update({"Authorization": f"Bearer {token}"})
        return session
    pytest.skip("Warehouse authentication failed")


@pytest.fixture(scope="session", autouse=True)
def cleanup_test_data():
    """Cleanup test data after all tests"""
    yield
    # Cleanup would go here if needed
    print("\nTest session completed")
