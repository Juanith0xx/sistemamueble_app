import requests
import sys
from datetime import datetime
import json
from typing import Dict, List, Optional

class GanttAPITester:
    def __init__(self, base_url="https://workflow-production.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.tokens = {}  # Store tokens for different users
        self.current_user = None
        self.test_data = {}  # Store created resources for cleanup/reference
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def log_test(self, name: str, passed: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            self.failed_tests.append({"name": name, "details": details})
            print(f"❌ {name}: FAILED {details}")

    def make_request(self, method: str, endpoint: str, data=None, auth_user=None, expected_status=200) -> tuple:
        """Make HTTP request with proper authentication"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        # Use specified user token or current user token
        user_for_auth = auth_user or self.current_user
        if user_for_auth and user_for_auth in self.tokens:
            headers['Authorization'] = f'Bearer {self.tokens[user_for_auth]}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers)
            else:
                return False, {"error": f"Unsupported method: {method}"}

            success = response.status_code == expected_status
            
            try:
                response_data = response.json() if response.content else {}
            except:
                response_data = {"text": response.text, "status": response.status_code}

            return success, response_data
            
        except requests.exceptions.RequestException as e:
            return False, {"error": str(e)}

    def test_auth_login(self, email: str, password: str, role_name: str):
        """Test user login and store token"""
        success, response = self.make_request("POST", "auth/login", 
                                             {"email": email, "password": password})
        
        if success and 'access_token' in response:
            self.tokens[role_name] = response['access_token']
            user_data = response.get('user', {})
            self.log_test(f"Login {role_name}", True, 
                         f"User: {user_data.get('name', 'Unknown')}, Role: {user_data.get('role', 'Unknown')}")
            return True
        else:
            self.log_test(f"Login {role_name}", False, 
                         f"Status: {response.get('status', 'Unknown')}, Error: {response}")
            return False

    def test_auth_me(self, role_name: str):
        """Test get current user info"""
        success, response = self.make_request("GET", "auth/me", auth_user=role_name)
        
        if success and 'user_id' in response:
            self.log_test(f"Auth/me {role_name}", True, f"User ID: {response['user_id'][:8]}...")
            return True
        else:
            self.log_test(f"Auth/me {role_name}", False, str(response))
            return False

    def test_create_project(self, role_name: str = "designer"):
        """Test project creation (only designers should be able to)"""
        project_data = {
            "name": f"Test Project {datetime.now().strftime('%H%M%S')}",
            "description": "Test project for API validation",
            "client_name": "Test Client Co.",
            "design_estimated_days": 5
        }
        
        # Try with expected success status 200 for designers, 403 for others
        expected_status = 200 if role_name == "designer" else 403
        success, response = self.make_request("POST", "projects", project_data, 
                                            auth_user=role_name, expected_status=expected_status)
        
        if role_name == "designer":
            if success and 'project_id' in response:
                self.test_data['project_id'] = response['project_id']
                self.log_test(f"Create Project ({role_name})", True, f"ID: {response['project_id'][:8]}...")
                return True
            else:
                self.log_test(f"Create Project ({role_name})", False, str(response))
                return False
        else:
            # For non-designers, we expect failure
            if not success:
                self.log_test(f"Create Project ({role_name})", True, "Correctly blocked non-designer")
                return True
            else:
                self.log_test(f"Create Project ({role_name})", False, "Non-designer was able to create project!")
                return False

    def test_list_projects(self, role_name: str):
        """Test listing projects"""
        success, response = self.make_request("GET", "projects", auth_user=role_name)
        
        if success and isinstance(response, list):
            project_count = len(response)
            self.log_test(f"List Projects ({role_name})", True, f"Found {project_count} projects")
            return True
        else:
            self.log_test(f"List Projects ({role_name})", False, str(response))
            return False

    def test_get_project_detail(self, role_name: str):
        """Test getting project details"""
        if 'project_id' not in self.test_data:
            self.log_test(f"Get Project Detail ({role_name})", False, "No test project available")
            return False
            
        project_id = self.test_data['project_id']
        success, response = self.make_request("GET", f"projects/{project_id}", auth_user=role_name)
        
        if success and 'project_id' in response:
            self.log_test(f"Get Project Detail ({role_name})", True, f"Status: {response.get('status', 'Unknown')}")
            return True
        else:
            self.log_test(f"Get Project Detail ({role_name})", False, str(response))
            return False

    def test_advance_project_stage(self, role_name: str):
        """Test advancing project stage (role-dependent)"""
        if 'project_id' not in self.test_data:
            self.log_test(f"Advance Stage ({role_name})", False, "No test project available")
            return False
            
        project_id = self.test_data['project_id']
        success, response = self.make_request("POST", f"projects/{project_id}/advance-stage", 
                                            {"estimated_days": 3}, auth_user=role_name)
        
        # Designer should be able to advance from design stage
        if role_name == "designer" and success:
            self.log_test(f"Advance Stage ({role_name})", True, "Design stage advanced")
            return True
        elif role_name != "designer" and not success:
            self.log_test(f"Advance Stage ({role_name})", True, "Correctly blocked unauthorized user")
            return True
        else:
            self.log_test(f"Advance Stage ({role_name})", False, str(response))
            return False

    def test_gantt_data(self, role_name: str):
        """Test Gantt chart data endpoint"""
        success, response = self.make_request("GET", "gantt/data", auth_user=role_name)
        
        if success and isinstance(response, list):
            task_count = len(response)
            self.log_test(f"Gantt Data ({role_name})", True, f"Found {task_count} tasks")
            return True
        else:
            self.log_test(f"Gantt Data ({role_name})", False, str(response))
            return False

    def test_notifications(self, role_name: str):
        """Test notifications endpoint"""
        success, response = self.make_request("GET", "notifications", auth_user=role_name)
        
        if success and isinstance(response, list):
            notif_count = len(response)
            self.log_test(f"Notifications ({role_name})", True, f"Found {notif_count} notifications")
            return True
        else:
            self.log_test(f"Notifications ({role_name})", False, str(response))
            return False

    def test_admin_kpis(self, role_name: str):
        """Test KPIs endpoint (superadmin only)"""
        success, response = self.make_request("GET", "dashboard/kpis", auth_user=role_name, 
                                            expected_status=200 if role_name == "admin" else 403)
        
        if role_name == "admin" and success and 'total_projects' in response:
            self.log_test(f"Admin KPIs ({role_name})", True, 
                         f"Total: {response.get('total_projects', 0)}, Active: {response.get('active_projects', 0)}")
            return True
        elif role_name != "admin" and not success:
            self.log_test(f"Admin KPIs ({role_name})", True, "Correctly blocked non-admin")
            return True
        else:
            self.log_test(f"Admin KPIs ({role_name})", False, str(response))
            return False

    def test_purchase_orders(self, role_name: str):
        """Test purchase orders endpoint"""
        success, response = self.make_request("GET", "purchase-orders", auth_user=role_name)
        
        if success and isinstance(response, list):
            po_count = len(response)
            self.log_test(f"Purchase Orders ({role_name})", True, f"Found {po_count} orders")
            return True
        else:
            self.log_test(f"Purchase Orders ({role_name})", False, str(response))
            return False

    def test_create_purchase_order(self, role_name: str):
        """Test creating purchase order (purchasing role only)"""
        if 'project_id' not in self.test_data:
            self.log_test(f"Create PO ({role_name})", False, "No test project available")
            return False
            
        po_data = {
            "project_id": self.test_data['project_id'],
            "supplier": "Test Supplier Inc.",
            "items": [
                {"description": "Test Material", "quantity": 10, "unit_price": 25.50}
            ],
            "notes": "Test purchase order"
        }
        
        expected_status = 201 if role_name == "purchasing" else 403
        success, response = self.make_request("POST", "purchase-orders", po_data, 
                                            auth_user=role_name, expected_status=expected_status)
        
        if role_name == "purchasing" and success and 'po_id' in response:
            self.log_test(f"Create PO ({role_name})", True, f"PO ID: {response['po_id'][:8]}...")
            return True
        elif role_name != "purchasing" and not success:
            self.log_test(f"Create PO ({role_name})", True, "Correctly blocked non-purchasing user")
            return True
        else:
            self.log_test(f"Create PO ({role_name})", False, str(response))
            return False

def main():
    print("=" * 60)
    print("🏭 GANTT PRO API TESTING")
    print("=" * 60)
    
    tester = GanttAPITester()
    
    # Test credentials from the requirements
    test_users = {
        "admin": {"email": "admin@ganttpro.com", "password": "admin123"},
        "designer": {"email": "diseñador@ganttpro.com", "password": "test123"},
        "manufacturing": {"email": "jefe@ganttpro.com", "password": "test123"},
        "purchasing": {"email": "compras@ganttpro.com", "password": "test123"},
        "warehouse": {"email": "bodega@ganttpro.com", "password": "test123"}
    }
    
    print("\n🔐 AUTHENTICATION TESTS")
    print("-" * 40)
    
    # Test login for all users
    login_success_count = 0
    for role, creds in test_users.items():
        if tester.test_auth_login(creds["email"], creds["password"], role):
            login_success_count += 1
    
    if login_success_count == 0:
        print("❌ No successful logins - stopping tests")
        return 1
    
    # Test auth/me for logged in users
    for role in tester.tokens.keys():
        tester.test_auth_me(role)
    
    print("\n📋 PROJECT MANAGEMENT TESTS")
    print("-" * 40)
    
    # Set designer as current user for project creation
    tester.current_user = "designer"
    
    # Test project creation (should only work for designer)
    for role in ["designer", "manufacturing", "purchasing"]:
        tester.test_create_project(role)
    
    # Test project listing and details
    for role in tester.tokens.keys():
        tester.test_list_projects(role)
        tester.test_get_project_detail(role)
    
    # Test stage advancement
    tester.test_advance_project_stage("designer")
    tester.test_advance_project_stage("manufacturing")
    
    print("\n📊 DASHBOARD & ANALYTICS TESTS")
    print("-" * 40)
    
    # Test Gantt data
    for role in tester.tokens.keys():
        tester.test_gantt_data(role)
    
    # Test notifications
    for role in tester.tokens.keys():
        tester.test_notifications(role)
    
    # Test admin KPIs (should only work for superadmin)
    for role in ["admin", "designer", "purchasing"]:
        if role in tester.tokens:
            tester.test_admin_kpis(role)
    
    print("\n🛒 PURCHASE ORDERS TESTS")
    print("-" * 40)
    
    # Test purchase orders listing
    for role in tester.tokens.keys():
        tester.test_purchase_orders(role)
    
    # Test PO creation (should only work for purchasing role)
    for role in ["purchasing", "designer", "warehouse"]:
        if role in tester.tokens:
            tester.test_create_purchase_order(role)
    
    # Results Summary
    print("\n" + "=" * 60)
    print("📈 TEST SUMMARY")
    print("=" * 60)
    print(f"✅ Tests Passed: {tester.tests_passed}")
    print(f"❌ Tests Failed: {len(tester.failed_tests)}")
    print(f"📊 Total Tests: {tester.tests_run}")
    print(f"🎯 Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if tester.failed_tests:
        print(f"\n❌ FAILED TESTS:")
        for failed in tester.failed_tests:
            print(f"   • {failed['name']}: {failed['details']}")
    
    return 0 if len(tester.failed_tests) == 0 else 1

if __name__ == "__main__":
    sys.exit(main())