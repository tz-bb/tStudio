import pytest
from fastapi.testclient import TestClient
import sys
import os
import shutil
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

# --- Test Constants ---
TEST_CATEGORY = "test_suite_category"
TEST_CONFIG_RAW_NAME = "test_config_raw"
TEST_CONFIG_STD_NAME = "test_config_standard"
TEST_CONFIG_VAL_NAME = "test_config_value_only"
TEST_CATEGORY_DIR = os.path.join("configs", TEST_CATEGORY)
TEST_CONFIG_RAW_PATH = os.path.join(TEST_CATEGORY_DIR, "active", f"{TEST_CONFIG_RAW_NAME}.json")
TEST_CONFIG_STD_PATH = os.path.join(TEST_CATEGORY_DIR, "active", f"{TEST_CONFIG_STD_NAME}.json")
TEST_CONFIG_VAL_PATH = os.path.join(TEST_CATEGORY_DIR, "active", f"{TEST_CONFIG_VAL_NAME}.json")
TEST_BACKUP_DIR = os.path.join(TEST_CATEGORY_DIR, "backups")

# --- Test Fixtures ---
@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="function", autouse=True)
def setup_and_teardown_test_environment():
    if os.path.exists(TEST_CATEGORY_DIR):
        shutil.rmtree(TEST_CATEGORY_DIR)
    os.makedirs(os.path.dirname(TEST_CONFIG_RAW_PATH), exist_ok=True)
    os.makedirs(TEST_BACKUP_DIR, exist_ok=True)

    # Raw JSON config
    raw_data = {
        "group1": {
            "param1": 123
        },
        "top_level_param": "hello"
    }
    with open(TEST_CONFIG_RAW_PATH, 'w') as f:
        json.dump(raw_data, f)

    # Standard format config with metadata
    std_data = {
        "group1": {
            "param1": {
                "__value__": 456,
                "__metadata__": {"type": "number", "unit": "m"}
            }
        }
    }
    with open(TEST_CONFIG_STD_PATH, 'w') as f:
        json.dump(std_data, f)

    # Value-only config
    with open(TEST_CONFIG_VAL_PATH, 'w') as f:
        json.dump(999, f)

    yield

    if os.path.exists(TEST_CATEGORY_DIR):
        shutil.rmtree(TEST_CATEGORY_DIR)

# --- Config Level API Tests ---

def test_get_full_config_raw(client: TestClient):
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}")
    assert response.status_code == 200
    data = response.json()
    assert data['group1']['param1'] == 123
    assert data['top_level_param'] == "hello"

def test_get_full_config_value_only(client: TestClient):
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_VAL_NAME}")
    assert response.status_code == 200
    assert response.json() == 999

def test_overwrite_full_config(client: TestClient):
    new_content = {"a": 1, "b": {"c": "d"}}
    response = client.put(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}", json=new_content)
    assert response.status_code == 200
    assert response.json()["success"] is True

    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}")
    assert response.status_code == 200
    assert response.json() == new_content

# --- Parameter Level API Tests ---

def test_get_parameter_node_as_value(client: TestClient):
    path_list = ["group1", "param1"]
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", params={"path": path_list})
    assert response.status_code == 200
    assert response.json() == {"value": 123}

def test_get_parameter_node_as_group(client: TestClient):
    path_list = ["group1"]
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", params={"path": path_list})
    assert response.status_code == 200
    assert response.json() == {"param1": 123}

def test_get_parameter_node_value_field(client: TestClient):
    path_list = ["top_level_param"]
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", params={"path": path_list, "field": "value"})
    assert response.status_code == 200
    assert response.json() == {'value': 'hello'}

def test_get_parameter_node_metadata_raw(client: TestClient):
    path_list = ["group1", "param1"]
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", params={"path": path_list, "field": "metadata"})
    assert response.status_code == 200
    assert response.json() == {}

def test_get_parameter_node_metadata_std(client: TestClient):
    path_list = ["group1", "param1"]
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_STD_NAME}/param", params={"path": path_list, "field": "metadata"})
    assert response.status_code == 200
    data = response.json()
    assert data['type'] == 'number'
    assert data['unit'] == 'm'

def test_get_non_existent_node(client: TestClient):
    path_list = ["group1", "nonexistent"]
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", params={"path": path_list})
    assert response.status_code == 404

def test_add_parameter_to_group(client: TestClient):
    add_payload = {"parent_path": ["group1"], "param_type": "boolean", "name": "param2", "value": True}
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", json=add_payload)
    assert response.status_code == 200, response.text

def test_update_parameter_value(client: TestClient):
    update_payload = {"path": ["group1", "param1"], "value": 456}
    response = client.patch(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", json=update_payload)
    assert response.status_code == 200, response.text

    path_list = ["group1", "param1"]
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", params={"path": path_list, "field": "value"})
    assert response.json() == {"value": 456}

def test_delete_parameter(client: TestClient):
    path_to_delete = ["group1", "param1"]
    response = client.delete(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", params={"path": path_to_delete})
    assert response.status_code == 200, response.text

    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", params={"path": path_to_delete})
    assert response.status_code == 404

# --- Edit Session, Backup, Restore Tests ---

def test_confirmable_edit_session_flow(client: TestClient):
    path_list = ["group1", "param1"]
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", params={"path": path_list, "field": "value"})
    original_value = response.json()["value"]
    changed_value = original_value + 50
    overwritten_content = {"final": "state"}

    # 1. Start edit session
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/edit/start")
    assert response.status_code == 200, response.text

    # 2. Make a change (PATCH)
    client.patch(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", json={"path": path_list, "value": changed_value})
    
    # 3. Make another change (PUT - overwrite)
    client.put(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}", json=overwritten_content)

    # 4. Revert changes
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/edit/revert")
    assert response.status_code == 200, response.text

    # 5. Verify reverted to original state
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", params={"path": path_list, "field": "value"})
    assert response.json()["value"] == original_value

    # 6. Start a new session, make a change, and end it
    client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/edit/start")
    client.patch(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", json={"path": path_list, "value": changed_value})
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/edit/end")
    assert response.status_code == 200, response.text

    # 7. Verify the change is permanent
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/param", params={"path": path_list, "field": "value"})
    assert response.json()["value"] == changed_value

    # 8. Check that auto backup was cleaned up
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_RAW_NAME}/edit/revert")
    assert response.status_code == 404

# --- Type API Tests (Keep as is) ---

def test_get_param_types(client: TestClient):
    """测试获取所有参数类型。"""
    response = client.get("/api/params/types")
    assert response.status_code == 200
    data = response.json()
    assert "string" in data
    assert "number" in data

def test_get_specific_param_type_template(client: TestClient):
    """测试获取特定参数类型的模板。"""
    response = client.get("/api/params/types/number")
    assert response.status_code == 200
    data = response.json()
    assert data['__value__'] == 0
    assert data['__metadata__']['type'] == 'number'

def test_get_non_existent_param_type(client: TestClient):
    """测试获取不存在的参数类型。"""
    response = client.get("/api/params/types/non_existent_type")
    assert response.status_code == 404