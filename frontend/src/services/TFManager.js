import * as THREE from 'three';

export class TFManager {
  constructor() {
    this.frames = new Map(); // frame_id -> TFFrame
    this.frameHierarchy = new Map(); // child_frame -> parent_frame
    this.sceneObjects = new Map(); // frame_id -> THREE.Group
  }

  // 更新TF数据
  updateTF(tfData) {
    tfData.transforms.forEach(transform => {
      const { header, child_frame_id, transform: tf } = transform;
      
      this.frames.set(child_frame_id, {
        parent_frame: header.frame_id,
        translation: tf.translation,
        rotation: tf.rotation,
        timestamp: header.stamp
      });
      
      this.frameHierarchy.set(child_frame_id, header.frame_id);
    });
    
    this.updateSceneGraph();
  }

  // 获取从source到target的变换
  getTransform(sourceFrame, targetFrame, timestamp) {
    // 实现TF查找算法
    return this.computeTransformChain(sourceFrame, targetFrame);
  }

  // 更新Three.js场景图
  updateSceneGraph() {
    this.frames.forEach((tfFrame, frameId) => {
      let sceneObject = this.sceneObjects.get(frameId);
      if (!sceneObject) {
        sceneObject = new THREE.Group();
        sceneObject.name = frameId;
        this.sceneObjects.set(frameId, sceneObject);
      }

      // 设置位置和旋转
      const { translation, rotation } = tfFrame;
      sceneObject.position.set(translation.x, translation.y, translation.z);
      sceneObject.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

      // 建立父子关系
      const parentFrame = tfFrame.parent_frame;
      if (parentFrame && this.sceneObjects.has(parentFrame)) {
        const parentObject = this.sceneObjects.get(parentFrame);
        if (sceneObject.parent !== parentObject) {
          parentObject.add(sceneObject);
        }
      }
    });
  }

  // 获取frame对应的场景对象
  getFrameObject(frameId) {
    return this.sceneObjects.get(frameId);
  }

  // 创建新的frame对象
  createFrameObject(frameId) {
    if (!this.sceneObjects.has(frameId)) {
      const obj = new THREE.Group();
      obj.name = frameId;
      this.sceneObjects.set(frameId, obj);
      return obj;
    }
    return this.sceneObjects.get(frameId);
  }
}

// 全局TF管理器实例
export const tfManager = new TFManager();