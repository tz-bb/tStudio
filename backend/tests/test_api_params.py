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