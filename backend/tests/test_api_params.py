import pytest
from fastapi.testclient import TestClient
import sys
import os
import json

# 将 'backend' 目录添加到Python的模块搜索路径中
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

# 定义一个可复用的TestClient fixture
@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

# --- 测试参数配置 --- #

def test_get_all_configs(client: TestClient):
    """测试获取所有参数配置"""
    response = client.get("/api/params/configs")
    assert response.status_code == 200
    data = response.json()
    assert "configs" in data
    assert isinstance(data["configs"], list)
    # 默认应该有一个 'default' 配置
    assert "default" in data["configs"]

def test_get_specific_config(client: TestClient):
    """测试获取指定的参数配置"""
    response = client.get("/api/params/configs/default")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)

def test_get_non_existent_config(client: TestClient):
    """测试获取一个不存在的配置，应该返回404"""
    response = client.get("/api/params/configs/non_existent_config")
    assert response.status_code == 404

# --- 测试单个参数操作 --- #

TEST_CONFIG_NAME = "test_suite_config"

@pytest.fixture(scope="module", autouse=True)
def setup_and_teardown_test_config(client: TestClient):
    """在测试开始前创建一个测试配置，在结束后删除它"""
    # Setup: 创建一个新的配置文件用于测试
    initial_data = {
        "name": TEST_CONFIG_NAME,
        "data": {
            "group1": {
                "param1": {"__value__": 123, "__metadata__": {"type": "number"}}
            }
        }
    }
    client.post("/api/params/configs", json=initial_data)
    
    yield # 这里是测试运行的地方
    
    # Teardown: 删除测试配置文件
    # 注意：实际项目中，删除操作可能需要一个专门的API端点
    # 这里我们假设没有删除配置文件的API，所以手动清理或在测试适配器中处理
    # 为简单起见，我们暂时不实现删除
    pass

def test_update_parameter(client: TestClient):
    """测试更新单个参数"""
    update_payload = {
        "path": "group1.param1",
        "value": 456
    }
    response = client.patch(f"/api/params/configs/{TEST_CONFIG_NAME}/params", json=update_payload)
    assert response.status_code == 200
    
    # 验证参数是否真的被更新
    response = client.get(f"/api/params/configs/{TEST_CONFIG_NAME}")
    data = response.json()
    assert data["group1"]["param1"]["__value__"] == 456

def test_add_parameter(client: TestClient):
    """测试添加一个新参数"""
    add_payload = {
        "path": "group1.param2",
        "type": "string" # 使用新的API格式
    }
    response = client.post(f"/api/params/configs/{TEST_CONFIG_NAME}/params", json=add_payload)
    assert response.status_code == 200

    # 验证参数是否真的被添加
    response = client.get(f"/api/params/configs/{TEST_CONFIG_NAME}")
    data = response.json()
    assert "param2" in data["group1"]
    assert data["group1"]["param2"]["__value__"] == ""

def test_delete_parameter(client: TestClient):
    """测试删除一个参数"""
    delete_payload = {"path": "group1.param1"}
    url = f"/api/params/configs/{TEST_CONFIG_NAME}/params"
    response = client.request("DELETE", url, json=delete_payload)
    assert response.status_code == 200

    # 验证参数是否真的被删除
    response = client.get(f"/api/params/configs/{TEST_CONFIG_NAME}")
    data = response.json()
    assert "param1" not in data["group1"]

# --- 测试备份与恢复 --- #

def test_backup_and_restore(client: TestClient):
    """测试创建备份、列出备份和从备份恢复的完整流程"""
    # 步骤1: 更改一个值，以便我们能验证恢复是否成功
    original_value = 123
    changed_value = 999
    param_path = "group1.param1"

    # 先确保初始值是正确的
    response = client.get(f"/api/params/configs/{TEST_CONFIG_NAME}")
    data = response.json()
    # 注意：因为之前的测试删除了param1，我们可能需要重新添加它或修改fixture
    # 为了简单起见，我们假设param1在setup时被创建，并且值为123
    # 如果测试顺序导致它不存在，我们需要调整测试逻辑
    # 暂时我们假设它存在
    if 'param1' not in data.get('group1', {}):
        client.post(f"/api/params/configs/{TEST_CONFIG_NAME}/params", json={"path": param_path, "type": "number"})
        client.patch(f"/api/params/configs/{TEST_CONFIG_NAME}/params", json={"path": param_path, "value": original_value})

    # 步骤2: 创建一个手动备份
    response = client.post(f"/api/params/configs/{TEST_CONFIG_NAME}/backups")
    assert response.status_code == 200
    backup_data = response.json()
    assert backup_data["success"]
    backup_filename = backup_data["backup_name"]

    # 步骤3: 列出备份，并确认我们刚创建的备份在列表中
    response = client.get(f"/api/params/configs/{TEST_CONFIG_NAME}/backups")
    assert response.status_code == 200
    backups_list = response.json()["backups"]
    assert backup_filename in backups_list

    # 步骤4: 修改参数的值
    update_payload = {"path": param_path, "value": changed_value}
    client.patch(f"/api/params/configs/{TEST_CONFIG_NAME}/params", json=update_payload)

    # 验证值是否已更改
    response = client.get(f"/api/params/configs/{TEST_CONFIG_NAME}")
    data = response.json()
    assert data["group1"]["param1"]["__value__"] == changed_value

    # 步骤5: 从备份恢复
    restore_payload = {"backup_filename": backup_filename}
    response = client.post(f"/api/params/configs/{TEST_CONFIG_NAME}/restore", json=restore_payload)
    assert response.status_code == 200
    assert response.json()["success"]

    # 步骤6: 验证值是否已恢复到原始值
    response = client.get(f"/api/params/configs/{TEST_CONFIG_NAME}")
    data = response.json()
    assert data["group1"]["param1"]["__value__"] == original_value

# --- 测试失败和边缘情况 --- #

def test_update_non_existent_parameter(client: TestClient):
    """测试更新一个不存在的参数，应该失败"""
    update_payload = {"path": "group_non_exist.param_non_exist", "value": 999}
    response = client.patch(f"/api/params/configs/{TEST_CONFIG_NAME}/params", json=update_payload)
    assert response.status_code == 400

def test_delete_non_existent_parameter(client: TestClient):
    """测试删除一个不存在的参数，应该失败"""
    delete_payload = {"path": "group_non_exist.param_non_exist"}
    response = client.request("DELETE", f"/api/params/configs/{TEST_CONFIG_NAME}/params", json=delete_payload)
    assert response.status_code == 400

def test_restore_from_non_existent_backup(client: TestClient):
    """测试从一个不存在的备份恢复，应该失败"""
    restore_payload = {"backup_filename": "non_existent_backup.json"}
    response = client.post(f"/api/params/configs/{TEST_CONFIG_NAME}/restore", json=restore_payload)
    assert response.status_code == 400

# --- 测试可确认的编辑（自动备份/恢复） --- #

def test_confirmable_edit_flow(client: TestClient):
    """测试自动备份和恢复流程"""
    param_path = "group1.param1"
    
    # 动态获取当前值，而不是硬编码
    response = client.get(f"/api/params/configs/{TEST_CONFIG_NAME}")
    assert response.status_code == 200
    original_value = response.json()["group1"]["param1"]["__value__"]
    
    changed_value = original_value + 100 # 基于当前值进行修改

    # 步骤1: 开始一个可确认的编辑（创建自动备份）
    response = client.post(f"/api/params/configs/{TEST_CONFIG_NAME}/confirm-start")
    assert response.status_code == 200

    # 步骤2: 修改参数的值
    update_payload = {"path": param_path, "value": changed_value}
    client.patch(f"/api/params/configs/{TEST_CONFIG_NAME}/params", json=update_payload)
    response = client.get(f"/api/params/configs/{TEST_CONFIG_NAME}")
    assert response.json()["group1"]["param1"]["__value__"] == changed_value

    # 步骤3: 撤销修改（从自动备份恢复）
    response = client.post(f"/api/params/configs/{TEST_CONFIG_NAME}/confirm-revert")
    assert response.status_code == 200

    # 步骤4: 验证值是否已恢复
    response = client.get(f"/api/params/configs/{TEST_CONFIG_NAME}")
    assert response.json()["group1"]["param1"]["__value__"] == original_value

def test_revert_without_auto_backup(client: TestClient):
    """在没有自动备份的情况下尝试恢复，应该失败"""
    # 确保没有自动备份存在（这可能需要清理操作，或在一个干净的状态下运行）
    # 为简单起见，我们直接调用revert，并期望它失败
    response = client.post(f"/api/params/configs/{TEST_CONFIG_NAME}/confirm-revert")
    assert response.status_code == 400