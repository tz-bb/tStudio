from typing import Dict, Any, List, Union
from pydantic import BaseModel, Field

# --- 1. 定义参数的基本结构 ---

class Parameter(BaseModel):
    """参数实例的基础模型"""
    value: Any
    type: str
    metadata: Dict[str, Any] = Field(default_factory=dict)

# --- 2. 定义类型模板 ---

class TypeDefinition(BaseModel):
    """参数类型的定义模板"""
    default_value: Any
    metadata_template: Dict[str, Any] = Field(default_factory=dict)

# --- 3. 类型注册表 (使用新的结构) ---

PARAMETER_TYPE_DEFINITIONS: Dict[str, TypeDefinition] = {
    "string": TypeDefinition(
        default_value="",
        metadata_template={"type": "string", "description": "A string value.", "ui_hint": "textfield"}
    ),
    "number": TypeDefinition(
        default_value=0,
        metadata_template={"type": "number", "description": "A numerical value.", "range": [None, None], "ui_hint": "slider"}
    ),
    "boolean": TypeDefinition(
        default_value=False,
        metadata_template={"type": "boolean", "description": "A boolean value.", "ui_hint": "switch"}
    ),
    "color_hex": TypeDefinition(
        default_value="#FFFFFF",
        metadata_template={"type": "string", "description": "A color value in hexadecimal format.", "ui_hint": "color_picker"}
    ),
    "dict": TypeDefinition(
        default_value={},
        metadata_template={"type": "object", "description": "A dictionary of key-value pairs.", "ui_hint": "dict_editor"}
    ),
    "list": TypeDefinition(
        default_value=[],
        metadata_template={"type": "array", "description": "A list of items.", "ui_hint": "list_editor"}
    )
}

# --- 4. 参数创建工具函数 ---

def create_parameter(param_type: str, value: Any = None) -> Parameter:
    """根据类型创建一个新的参数实例"""
    definition = PARAMETER_TYPE_DEFINITIONS.get(param_type)
    if not definition:
        raise ValueError(f"Unknown parameter type: {param_type}")
    
    # 如果没有提供初始值，则使用类型的默认值
    initial_value = value if value is not None else definition.default_value
    
    return Parameter(
        value=initial_value,
        type=param_type,
        metadata=definition.metadata_template.copy()
    )

def get_type_definitions() -> Dict[str, Dict[str, Any]]:
    """获取所有类型定义的字典"""
    return {name: definition.model_dump() for name, definition in PARAMETER_TYPE_DEFINITIONS.items()}