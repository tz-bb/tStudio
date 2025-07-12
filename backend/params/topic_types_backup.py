from .parameter_types import create_parameter

# 定义不同Topic类型的可视化模板
# key是Topic类型，value是对应的参数结构
TOPIC_TYPE_TEMPLATES = {
    "default": {
        "display_type": create_parameter("string", "display_type", "marker").to_dict(),
        "marker_type": create_parameter("string", "marker_type", "cube").to_dict(),
        "color": create_parameter("color", "color", "#FF0000").to_dict(),
        "scale": create_parameter("vector3", "scale", [1.0, 1.0, 1.0]).to_dict(),
    },
    "sensor_msgs/Imu": {
        "display_type": create_parameter("string", "display_type", "model").to_dict(),
        "model_path": create_parameter("string", "model_path", "/imu.glb").to_dict(),
        "scale": create_parameter("vector3", "scale", [1.0, 1.0, 1.0]).to_dict(),
    },
    "sensor_msgs/LaserScan": {
        "display_type": create_parameter("string", "display_type", "point_cloud").to_dict(),
        "point_size": create_parameter("number", "point_size", 2.0).to_dict(),
        "color": create_parameter("color", "color", "#00FF00").to_dict(),
    },
    "tf2_msgs/TFMessage": {
        "show_names": create_parameter("boolean", "show_names", True).to_dict(),
        "show_axes": create_parameter("boolean", "show_axes", True).to_dict(),
        "show_arrows": create_parameter("boolean", "show_arrows", True).to_dict(),
        "marker_scale": create_parameter("number", "marker_scale", 1.0, metadata_override={"min": 0.1, "max": 10.0}).to_dict(),
        "marker_alpha": create_parameter("number", "marker_alpha", 0.5, metadata_override={"min": 0.1, "max": 1.0}).to_dict(),
    }
}

def get_topic_type_templates():
    """返回所有已定义的Topic可视化模板"""
    return TOPIC_TYPE_TEMPLATES

def get_template_by_type(topic_type: str):
    """根据Topic类型获取其模板"""
    return TOPIC_TYPE_TEMPLATES.get(topic_type)