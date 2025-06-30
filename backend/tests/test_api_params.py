import pytest
from fastapi.testclient import TestClient
import sys
import os
import shutil
import json

# 将 'backend' 目录添加到Python的模块搜索路径中
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

# --- 测试常量 ---
TEST_CATEGORY = "test_suite_category"
TEST_CONFIG_NAME = "test_config"
# 修正路径以包含 'active' 子目录
TEST_ACTIVE_DIR = os.path.join("configs", TEST_CATEGORY, "active")
TEST_CATEGORY_DIR = os.path.join("configs", TEST_CATEGORY)

# --- 测试 Fixtures ---
@pytest.fixture(scope="module")
def client():
    """创建一个可复用的TestClient实例。"""
    with TestClient(app) as c:
        yield c

@pytest.fixture(scope="module", autouse=True)
def setup_and_teardown_test_environment():
    """在模块测试开始前创建测试目录和配置，在结束后清理。"""
    # Setup: 创建测试目录，包括 active 子目录
    if os.path.exists(TEST_CATEGORY_DIR):
        shutil.rmtree(TEST_CATEGORY_DIR)
    os.makedirs(TEST_ACTIVE_DIR)

    # 创建一个初始配置文件
    initial_data = {
        "group1": {
            "param1": {"value": 123, "type": "number", "metadata": {"type": "number"}}
        }
    }
    # 在 active 目录中创建文件
    with open(os.path.join(TEST_ACTIVE_DIR, f"{TEST_CONFIG_NAME}.json"), 'w') as f:
        json.dump(initial_data, f)

    yield  # 测试运行

    # Teardown: 清理整个测试类别目录
    if os.path.exists(TEST_CATEGORY_DIR):
        shutil.rmtree(TEST_CATEGORY_DIR)

# --- 参数类型API测试 ---
def test_get_param_types(client: TestClient):
    """测试获取所有参数类型。"""
    response = client.get("/api/params/types")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
    assert "string" in data
    assert "number" in data
    assert "default_value" in data["string"]

def test_get_specific_param_type_template(client: TestClient):
    """测试获取特定参数类型的模板。"""
    response = client.get("/api/params/types/number")
    assert response.status_code == 200
    data = response.json()
    assert data["value"] == 0
    assert data["type"] == "number"

def test_get_non_existent_param_type(client: TestClient):
    """测试获取不存在的参数类型。"""
    response = client.get("/api/params/types/non_existent_type")
    assert response.status_code == 404

# --- 配置管理API测试 ---
def test_list_configs_by_category(client: TestClient):
    """测试按类别列出配置。"""
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}")
    assert response.status_code == 200
    data = response.json()
    assert data["category"] == TEST_CATEGORY
    assert TEST_CONFIG_NAME in data["configs"]

def test_get_specific_config(client: TestClient):
    """测试获取指定的参数配置。"""
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}")
    assert response.status_code == 200
    data = response.json()
    assert "group1" in data

def test_get_non_existent_config(client: TestClient):
    """测试获取不存在的配置。"""
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/non_existent_config")
    assert response.status_code == 404

# --- 单个参数操作测试 ---
def test_add_parameter(client: TestClient):
    """测试添加一个新参数。"""
    add_payload = {"path": "group1.param2", "type": "string"}
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/params", json=add_payload)
    assert response.status_code == 200, response.text

    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}")
    data = response.json()
    assert "param2" in data["group1"]
    assert data["group1"]["param2"]["value"] == ""

def test_update_parameter(client: TestClient):
    """测试更新单个参数。"""
    update_payload = {"path": "group1.param1", "value": 456}
    response = client.patch(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/params", json=update_payload)
    assert response.status_code == 200, response.text

    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}")
    data = response.json()
    assert data["group1"]["param1"]["value"] == 456

def test_delete_parameter(client: TestClient):
    """测试删除一个参数。"""
    # 先添加一个确保它存在
    client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/params", json={"path": "group1.to_delete", "type": "string"})

    delete_payload = {"path": "group1.to_delete"}
    response = client.request("DELETE", f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/params", json=delete_payload)
    assert response.status_code == 200, response.text

    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}")
    data = response.json()
    assert "to_delete" not in data["group1"]

# --- 备份与恢复测试 ---
def test_backup_and_restore(client: TestClient):
    """测试备份和恢复流程。"""
    param_path = "group1.param1"
    # 获取当前值以确保测试独立性
    resp = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}")
    original_value = resp.json()["group1"]["param1"]["value"]
    changed_value = original_value + 100

    # 1. 创建备份
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/backups")
    assert response.status_code == 200, response.text
    backup_filename = response.json()["backup_name"]

    # 2. 修改值
    client.patch(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/params", json={"path": param_path, "value": changed_value})

    # 3. 恢复
    restore_payload = {"backup_filename": backup_filename}
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/restore", json=restore_payload)
    assert response.status_code == 200, response.text

    # 4. 验证
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}")
    data = response.json()
    assert data["group1"]["param1"]["value"] == original_value

# --- 边缘情况测试 ---
def test_update_non_existent_parameter(client: TestClient):
    """测试更新不存在的参数。"""
    update_payload = {"path": "group_non_exist.param_non_exist", "value": 999}
    response = client.patch(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/params", json=update_payload)
    assert response.status_code == 400

# --- 可确认的编辑测试 ---
def test_confirmable_edit_flow(client: TestClient):
    """测试自动备份和恢复流程。"""
    param_path = "group1.param1"
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}")
    original_value = response.json()["group1"]["param1"]["value"]
    changed_value = original_value + 50

    # 1. 开始编辑
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/confirm-start")
    assert response.status_code == 200, response.text

    # 2. 修改
    client.patch(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/params", json={"path": param_path, "value": changed_value})

    # 3. 撤销
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/confirm-revert")
    assert response.status_code == 200, response.text

    # 4. 验证
    response = client.get(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}")
    assert response.json()["group1"]["param1"]["value"] == original_value

    # 5. 结束编辑会话，清理自动备份
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/confirm-end")
    assert response.status_code == 200, response.text


def test_revert_without_auto_backup(client: TestClient):
    """在没有自动备份的情况下尝试恢复。"""
    # 在一个干净的状态下，没有自动备份存在
    response = client.post(f"/api/params/configs/{TEST_CATEGORY}/{TEST_CONFIG_NAME}/confirm-revert")
    assert response.status_code == 400