import * as THREE from 'three';

export class TFManager {
  constructor() {
    this.frames = new Map(); // frame_id -> { parent: string, transform: { translation: vec, rotation: quat }, timestamp: time }
    this.frameHierarchy = new Map(); // child_frame -> parent_frame
    this.childrenMap = new Map(); // parent_frame -> [child_frame]
    this.listeners = new Map(); // event_name -> [callback]
    this._basis = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    this.basisEnabled = false;
    this.depth = new Map();
    this.transformCache = new Map();
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
    if (eventName === 'update') {
      const root = this.getRootFrame();
      const focus = ['base_link', 'map', 'odom', 'world'].filter(fid => this.frames.has(fid));
      const dump = focus.map(fid => {
        const fr = this.frames.get(fid);
        const world = this.getTransform(fid, root);
        return {
          id: fid,
          parent: fr?.parent,
          local_t: fr?.transform?.translation,
          local_q: fr?.transform?.rotation,
          world_t: world?.position,
          world_q: world?.quaternion,
        };
      });
      console.log('[TFManager] focus dump', { root, count: this.frames.size, sample: dump });
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
          parent: null,
          transform: {
            translation: new THREE.Vector3(0, 0, 0),
            rotation: new THREE.Quaternion(0, 0, 0, 1),
          },
          timestamp: header.stamp
        });
      }

      // 应用坐标系基变换
      const tVec = new THREE.Vector3(tf.translation.x, tf.translation.y, tf.translation.z);
      const qRos = new THREE.Quaternion(tf.rotation.x, tf.rotation.y, tf.rotation.z, tf.rotation.w);
      let qThree;
      if (this.basisEnabled) {
        tVec.applyQuaternion(this._basis);
        const basis = this._basis.clone();
        const basisInv = this._basis.clone().invert();
        qThree = basis.multiply(qRos).multiply(basisInv);
      } else {
        qThree = qRos.clone();
      }

      this.frames.set(child_frame_id, {
        parent: parentFrameId,
        transform: {
          translation: tVec,
          rotation: qThree,
        },
        timestamp: header.stamp
      });

      // 更新父子关系
      const oldParent = this.frameHierarchy.get(child_frame_id);
      if (oldParent && oldParent !== parentFrameId) {
        const childrenOfOldParent = this.childrenMap.get(oldParent);
        if (childrenOfOldParent) {
          const index = childrenOfOldParent.indexOf(child_frame_id);
          if (index > -1) {
            childrenOfOldParent.splice(index, 1);
          }
        }
      }

      this.frameHierarchy.set(child_frame_id, parentFrameId);

      if (!this.childrenMap.has(parentFrameId)) {
        this.childrenMap.set(parentFrameId, []);
      }
      const children = this.childrenMap.get(parentFrameId);
      if (!children.includes(child_frame_id)) {
        children.push(child_frame_id);
      }
    });

    this._recomputeDepths();
    this.transformCache.clear();
    this.emit('update'); // 数据更新后触发事件
  }

  // 获取子节点
  getChildren(frameId) {
    return this.childrenMap.get(frameId) || [];
  }

  _recomputeDepths() {
    const roots = new Set(this.frames.keys());
    for (const child of this.frameHierarchy.keys()) {
      roots.delete(child);
    }
    const queue = [];
    for (const r of roots) {
      this.depth.set(r, 0);
      queue.push(r);
    }
    while (queue.length) {
      const p = queue.shift();
      const d = this.depth.get(p) || 0;
      const children = this.childrenMap.get(p) || [];
      for (const c of children) {
        this.depth.set(c, d + 1);
        queue.push(c);
      }
    }
  }

  // 获取从 sourceFrame 到 targetFrame 的变换
  getTransform(targetFrame, sourceFrame) {
    if (targetFrame === sourceFrame) {
      return {
        position: new THREE.Vector3(0, 0, 0),
        quaternion: new THREE.Quaternion(0, 0, 0, 1),
      };
    }

    const cacheKey = `${sourceFrame}->${targetFrame}`;
    if (this.transformCache.has(cacheKey)) {
      return this.transformCache.get(cacheKey);
    }

    const rootFrame = this.getRootFrame();
    if (
      (targetFrame !== rootFrame && !this.frames.has(targetFrame)) ||
      (sourceFrame !== rootFrame && !this.frames.has(sourceFrame))
    ) {
      return null;
    }

    const pathToSource = this._findPathToRoot(sourceFrame);
    const pathToTarget = this._findPathToRoot(targetFrame);
    if (!pathToSource.length || !pathToTarget.length) {
      return null;
    }

    let i = pathToSource.length - 1;
    let j = pathToTarget.length - 1;
    while (i >= 0 && j >= 0 && pathToSource[i] === pathToTarget[j]) {
      i--;
      j--;
    }

    let ancestorToSource = new THREE.Matrix4();
    for (let k = i; k >= 0; k--) {
      const childId = pathToSource[k];
      const frameData = this.frames.get(childId);
      if (!frameData) continue;
      const T_parent_to_child = new THREE.Matrix4().compose(
        frameData.transform.translation,
        frameData.transform.rotation,
        new THREE.Vector3(1, 1, 1)
      );
      ancestorToSource.multiply(T_parent_to_child);
    }

    let ancestorToTarget = new THREE.Matrix4();
    for (let k = j; k >= 0; k--) {
      const childId = pathToTarget[k];
      const frameData = this.frames.get(childId);
      if (!frameData) continue;
      const T_parent_to_child = new THREE.Matrix4().compose(
        frameData.transform.translation,
        frameData.transform.rotation,
        new THREE.Vector3(1, 1, 1)
      );
      ancestorToTarget.multiply(T_parent_to_child);
    }

    const sourceToTarget = new THREE.Matrix4()
      .copy(ancestorToTarget)
      .multiply(new THREE.Matrix4().copy(ancestorToSource).invert());

    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    sourceToTarget.decompose(position, quaternion, scale);

    const result = { position, quaternion };
    this.transformCache.set(cacheKey, result);
    return result;
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

  setBasisEnabled(enabled) {
    this.basisEnabled = !!enabled;
    this.transformCache.clear();
    this.emit('update');
  }

  /**
   * 计算从一个源坐标系到目标坐标系的变换。
   */
}

// 全局TF管理器实例
export const tfManager = new TFManager();
