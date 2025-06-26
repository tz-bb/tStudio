import pytest
from fastapi.testclient import TestClient

# 导入你的FastAPI应用实例
# 我们需要调整一下路径，以便能够从tests目录导入backend中的app
import sys
import os

# 将 'backend' 目录添加到Python的模块搜索路径中
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from main import app

# 使用pytest的fixture来创建一个可复用的AsyncClient实例
# 注意这里的改动，我们不再使用 async def
@pytest.fixture(scope="module")
def client():
    # 使用 FastAPI 的 TestClient
    with TestClient(app) as c:
        yield c

# 测试用例也不再需要是异步的
def test_get_available_adapters(client: TestClient):
    """测试 /api/adapters 接口是否能成功返回数据"""
    # 模拟发送一个GET请求到 /api/adapters
    response = client.get("/api/adapters")

    # 断言：检查响应是否符合预期
    assert response.status_code == 200  # 检查HTTP状态码是否为200 (OK)

    data = response.json()  # 将响应体解析为JSON
    assert "adapters" in data  # 检查返回的JSON中是否包含 'adapters' 键
    assert "adapter_configs" in data  # 检查返回的JSON中是否包含 'adapter_configs' 键

    # 您还可以做更详细的检查，比如检查adapters列表是否不为空
    assert isinstance(data["adapters"], list)
    print("\nTest 'test_get_available_adapters' passed!")
    print(f"Response: {data}")