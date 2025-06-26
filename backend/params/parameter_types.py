from typing import Dict, Any

# 参数类型注册表
# 定义了每种参数类型的默认值和元数据模板
PARAMETER_TYPE_DEFINITIONS: Dict[str, Dict[str, Any]] = {
    "string": {
        "__default_value__": "",
        "__metadata__": {
            "type": "string",
            "description": "A string value.",
            "ui_hint": "textfield"
        }
    },
    "number": {
        "__default_value__": 0,
        "__metadata__": {
            "type": "number",
            "description": "A numerical value.",
            "range": [None, None], # [min, max]
            "unit": "",
            "ui_hint": "slider"
        }
    },
    "boolean": {
        "__default_value__": False,
        "__metadata__": {
            "type": "boolean",
            "description": "A boolean value.",
            "ui_hint": "switch"
        }
    },
    "color_hex": {
        "__default_value__": "#FFFFFF",
        "__metadata__": {
            "type": "string",
            "description": "A color value in hexadecimal format.",
            "ui_hint": "color_picker"
        }
    },
    "vector2d": {
        "__default_value__": {"x": 0, "y": 0},
        "__metadata__": {
            "type": "object",
            "description": "A 2D vector.",
            "ui_hint": "vector2d_editor"
        }
    },
    "vector3d": {
        "__default_value__": {"x": 0, "y": 0, "z": 0},
        "__metadata__": {
            "type": "object",
            "description": "A 3D vector.",
            "ui_hint": "vector3d_editor"
        }
    }
    # 未来可以继续在这里添加更多自定义类型
}

def get_template_for_type(param_type: str) -> Dict[str, Any]:
    """根据类型获取参数模板"""
    definition = PARAMETER_TYPE_DEFINITIONS.get(param_type)
    if not definition:
        return None
    
    return {
        "__value__": definition["__default_value__"],
        "__metadata__": definition["__metadata__"]
    }