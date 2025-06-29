import * as THREE from 'three'; // THREE 将被移除，但我们先保留它以便计算

export class TFManager {
  constructor() {
    this.frames = new Map(); // frame_id -> { parent: string, transform: { translation: vec, rotation: quat }, timestamp: time }
    this.frameHierarchy = new Map(); // child_frame -> parent_frame
    this.childrenMap = new Map(); // parent_frame -> [child_frame]
    this.listeners = new Map(); // event_name -> [callback]
  }

  // 添加事件监听
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, []);
    }
    this.listeners.get(eventName).push(callback);
  }

  // 移除事件监听
  off(eventName, callback) {
    if (this.listeners.has(eventName)) {
      const filteredListeners = this.listeners.get(eventName).filter(l => l !== callback);
      this.listeners.set(eventName, filteredListeners);
    }
  }

  // 触发事件
  emit(eventName, data) {
    if (this.listeners.has(eventName)) {
      this.listeners.get(eventName).forEach(callback => callback(data));
    }
  }

  // 更新TF数据
  updateTF(tfData) {
    tfData.transforms.forEach(transform => {
      const { header, child_frame_id, transform: tf } = transform;
      const parentFrameId = header.frame_id;

      // 确保父节点也存在于frames中
      if (parentFrameId && !this.frames.has(parentFrameId)) {
        this.frames.set(parentFrameId, {
          parent: null, // 显式表示没有父节点
          transform: {
            translation: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Quaternion(0, 0, 0, 1),
          },
          timestamp: header.stamp
        });
      }
      
      this.frames.set(child_frame_id, {
        parent: parentFrameId,
        transform: {
          translation: new THREE.Vector3(tf.translation.x, tf.translation.y, tf.translation.z),
          rotation: new THREE.Quaternion(tf.rotation.x, tf.rotation.y, tf.rotation.z, tf.rotation.w),
        },
        timestamp: header.stamp
      });
      
      // 更新父子关系
      const oldParent = this.frameHierarchy.get(child_frame_id);
      if (oldParent && oldParent !== parentFrameId) {
        // 如果父节点改变，从旧的父节点子列表中移除
        const childrenOfOldParent = this.childrenMap.get(oldParent);
        if (childrenOfOldParent) {
          const index = childrenOfOldParent.indexOf(child_frame_id);
          if (index > -1) {
            childrenOfOldParent.splice(index, 1);
          }
        }
      }

      this.frameHierarchy.set(child_frame_id, parentFrameId);

      // 更新新的父节点的子列表
      if (!this.childrenMap.has(parentFrameId)) {
        this.childrenMap.set(parentFrameId, []);
      }
      const children = this.childrenMap.get(parentFrameId);
      if (!children.includes(child_frame_id)) {
        children.push(child_frame_id);
      }
    });

    this.emit('update'); // 数据更新后触发事件
  }

  // 获取子节点
  getChildren(frameId) {
    return this.childrenMap.get(frameId) || [];
  }

  // 获取从 sourceFrame 到 targetFrame 的变换
  getTransform(targetFrame, sourceFrame) {
    // 新增：如果源和目标坐标系相同，返回单位变换
    if (targetFrame === sourceFrame) {
      return {
        translation: new THREE.Vector3(0, 0, 0),
        rotation: new THREE.Quaternion(0, 0, 0, 1),
      };
    }

    const rootFrame = this.getRootFrame();
    // 检查非根坐标系是否存在
    if (
      (targetFrame !== rootFrame && !this.frames.has(targetFrame)) ||
      (sourceFrame !== rootFrame && !this.frames.has(sourceFrame))
    ) {
      return null; // 如果任一非根坐标系不存在，则无法计算
    }

    // 路径查找
    const pathToSource = this._findPathToRoot(sourceFrame);
    const pathToTarget = this._findPathToRoot(targetFrame);

    if (!pathToSource.length || !pathToTarget.length) {
        return null; // 无法追溯到根节点
    }

    // 查找共同祖先
    let i = pathToSource.length - 1;
    let j = pathToTarget.length - 1;
    while (i >= 0 && j >= 0 && pathToSource[i] === pathToTarget[j]) {
      i--;
      j--;
    }
    const commonAncestor = pathToSource[i + 1];

    // 计算从 source 到共同祖先的变换
    let transform = new THREE.Matrix4(); // 单位矩阵
    for (let k = 0; k <= i; k++) {
      const frameData = this.frames.get(pathToSource[k]);
      const frameTransform = new THREE.Matrix4().compose(
        frameData.transform.translation,
        frameData.transform.rotation,
        new THREE.Vector3(1, 1, 1)
      );
      transform.premultiply(frameTransform);
    }

    // 计算从 target 到共同祖先的变换，然后取逆
    let targetToAncestor = new THREE.Matrix4();
    for (let k = 0; k <= j; k++) {
      const frameData = this.frames.get(pathToTarget[k]);
      const frameTransform = new THREE.Matrix4().compose(
        frameData.transform.translation,
        frameData.transform.rotation,
        new THREE.Vector3(1, 1, 1)
      );
      targetToAncestor.premultiply(frameTransform);
    }

    const ancestorToTarget = new THREE.Matrix4().copy(targetToAncestor).invert();

    // 合并变换: source -> ancestor -> target
    transform.multiply(ancestorToTarget);

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    transform.decompose(position, quaternion, scale);

    return { position, quaternion };
  }

  _findPathToRoot(frameId) {
    const path = [];
    let currentFrame = frameId;
    while (currentFrame && this.frames.has(currentFrame)) {
      path.push(currentFrame);
      currentFrame = this.frames.get(currentFrame).parent;
    }
    // 如果能找到根，最后一个parent应该是undefined，但根节点本身在frames里
    if(currentFrame) path.push(currentFrame); // 添加根节点
    return path;
  }

  // 为TFVisualizer提供数据
  getAllFramesAsArray() {
    return Array.from(this.frames.keys());
  }

  /**
   * 获取TF树的根坐标系。
   * 理想情况下只有一个根，但如果存在多个或没有，则返回一个默认值。
   * @returns {string} 根坐标系的ID。
   */
  getRootFrame() {
    const roots = new Set(this.frames.keys());
    for (const child of this.frameHierarchy.keys()) {
      roots.delete(child);
    }

    if (roots.size === 1) {
      return roots.values().next().value;
    }

    // 如果有多个根或没有根，返回一个默认的固定参考系
    // TODO: 这个默认值应该可以配置
    return 'world'; 
  }

  /**
   * 计算从一个源坐标系到目标坐标系的变换。
   */
}

// 全局TF管理器实例
export const tfManager = new TFManager();