from __future__ import annotations
import copy
from typing import Any, Dict, Optional, List, Union

# 保持现有的类型定义，它们在新节点创建时依然有用
PARAMETER_TYPE_DEFINITIONS = {
    "string": {"default": "", "metadata": {}},
    "number": {"default": 0, "metadata": {"min": -1e9, "max": 1e9, "step": 0.1}},
    "boolean": {"default": False, "metadata": {}},
    "color": {"default": "#00000000", "metadata": {}},
    "vector2": {"default": [0.0, 0.0], "metadata": {}},
    "vector3": {"default": [0.0, 0.0, 0.0], "metadata": {}},
    "enumerate": {"default": "option1", "metadata": {"options": ["option1", "option2", "option3"]}}
}

class ParamNode:
    """A unified node in the parameter tree. It can represent both a group and a value."""
    def __init__(self, name: str, parent: Optional[ParamNode] = None, value: Any = None, metadata: Optional[Dict] = None):
        self.name = name
        self.parent = parent
        self.children: Dict[str, ParamNode] = {}
        self._value = value
        self.metadata = metadata if metadata is not None else {}

    @property
    def path_list(self) -> List[str]:
        """Returns the full path of the node from the root as a list of keys."""
        if self.parent and self.parent.name != "__root__":
            return self.parent.path_list + [self.name]
        return [self.name]

    @property
    def is_value_node(self) -> bool:
        """A node is a value node if it has an explicit value."""
        return self._value is not None

    @property
    def value(self) -> Any:
        """Gets the value."""
        return self._value

    @value.setter
    def value(self, new_value: Any):
        """Sets the value."""
        self._value = new_value

    @property
    def metadata(self) -> Dict:
        """Gets the metadata."""
        return self._metadata

    @metadata.setter
    def metadata(self, new_metadata: Dict):
        """Sets the metadata."""
        self._metadata = new_metadata

    def add_child(self, child_node: ParamNode):
        """Adds a child node."""
        if child_node.name in self.children:
            raise ValueError(f"Child with name '{child_node.name}' already exists in '{self.name}'")
        child_node.parent = self
        self.children[child_node.name] = child_node

    def remove_child(self, child_name: str):
        """Removes a child node by name."""
        if child_name in self.children:
            del self.children[child_name]
        else:
            raise KeyError(f"No child with name '{child_name}' in '{self.name}'")

    def get_child(self, path: Union[str, List[str]]) -> Optional[ParamNode]:
        """Retrieves a descendant node using a dot-separated path or a list of keys."""
        if isinstance(path, str):
            path_list = path.split('.') if path else []
        else:
            path_list = path

        if not path_list:
            return self
        
        current_node = self
        for key in path_list:
            if current_node and key in current_node.children:
                current_node = current_node.children[key]
            else:
                return None
        return current_node

    def to_dict(self) -> Any:
        """Converts the node and its descendants back to a dictionary format with metadata."""
        # If it's a simple value node with no children or metadata, return the raw value.
        if self.is_value_node and not self.children and not self.metadata:
            return self.value

        data = {}
        if self.is_value_node:
            data['__value__'] = self.value
        if self.metadata:
            data['__metadata__'] = self.metadata
        
        for child_name, child_node in self.children.items():
            data[child_name] = child_node.to_dict()
            
        # If the node was just a value with metadata, the dict is already complete.
        # If it was a group, the children are added. If empty, it's an empty group.
        return data

    def to_clean_dict(self) -> Any:
        """Converts the node and its descendants to a clean dictionary, omitting internal fields."""
        if self.is_value_node and not self.children:
            return self.value

        data = {}
        if self.is_value_node:
            # This case handles nodes that are both a value and a group.
            # We can decide on a special key, e.g., `__self__`, or omit it.
            # For now, let's assume such mixed nodes are not standard.
            pass

        for child_name, child_node in self.children.items():
            data[child_name] = child_node.to_clean_dict()

        return data

    def __repr__(self) -> str:
        return f"ParamNode(name='{self.name}', value={self._value}, children={list(self.children.keys())})"

def build_param_tree(data: Any, name: str = "__root__", parent: Optional[ParamNode] = None) -> ParamNode:
    """Recursively builds a ParamNode tree from a dictionary or a raw value."""
    if not isinstance(data, dict):
        # If the data itself is a raw value, create a single value node.
        return ParamNode(name=name, parent=parent, value=data)

    value = data.get('__value__')
    metadata = data.get('__metadata__')
    is_value_node = '__value__' in data

    node = ParamNode(name=name, parent=parent, value=value if is_value_node else None, metadata=metadata)
    
    for key, val in data.items():
        if key.startswith('__'):
            continue
        # The child's value is the raw `val`, which could be a dict or a primitive.
        child_node = build_param_tree(val, name=key, parent=node)
        node.add_child(child_node)
            
    return node

def create_parameter(param_type: str, name: str, value: Any = "__SENTINEL__", metadata_override: Optional[Dict] = None) -> ParamNode:
    """Creates a new ParamNode with default metadata for a given type."""
    if param_type not in PARAMETER_TYPE_DEFINITIONS:
        raise ValueError(f"Unknown parameter type: {param_type}")
    
    type_def = PARAMETER_TYPE_DEFINITIONS[param_type]
    
    final_value = value if value != "__SENTINEL__" else type_def['default']
    
    metadata = type_def['metadata'].copy()
    if metadata_override:
        metadata.update(metadata_override)
    metadata['type'] = param_type
    
    return ParamNode(name=name, value=final_value, metadata=metadata)

def get_type_definitions() -> Dict[str, Any]:
    """Returns the dictionary of all registered type definitions."""
    return PARAMETER_TYPE_DEFINITIONS