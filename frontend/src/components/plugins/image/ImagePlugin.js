import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VisualizationPlugin } from '../base/VisualizationPlugin';
import TFWrapper from '../base/TFWrapper'; // 导入 TFWrapper

function decodeRosBridgeData(encodedString){
    const decodedString = atob(encodedString);
    const uint8Array = new Uint8Array(decodedString.length);
    for (let i = 0; i < decodedString.length; i++) {
        uint8Array[i] = decodedString.charCodeAt(i);
    }
    return uint8Array;
}
// 图像显示组件
function ImageDisplay({ data, position = [0, 0, 0], scale = 1.0 }) {
    const meshRef = useRef();
    const [texture, setTexture] = useState(null);

    // 处理图像数据并创建纹理
    const processImageData = useMemo(() => {
        if (!data || !data.data) return null;
        try {
            // 根据encoding类型处理图像数据
            const { width, height, encoding, data: imageData } = data;
            let canvas, ctx, imageDataArray, rawDataArray;
            // 创建canvas用于图像处理
            canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            ctx = canvas.getContext('2d');
            
            if (typeof imageData === 'string') {
                const decodedArray = decodeRosBridgeData(imageData);
                rawDataArray = new Uint8ClampedArray(decodedArray);
            } else {
                rawDataArray = new Uint8ClampedArray(imageData);
            }
            const bytesPerPixel =  rawDataArray.length / (width * height)

            // 根据不同的编码格式处理数据
            switch (encoding) {
                case 'rgb8':
                    if (4 === bytesPerPixel) {
                        // special for RealSense, RGBD format
                        imageDataArray = new Uint8ClampedArray(rawDataArray.length);
                        for(let i = 0; i < width * height; i++) {
                            imageDataArray[i * 4 + 0] = (rawDataArray[i*4+0]&0x3f) << 2 | (rawDataArray[i*4+1]&0x30) >> 4;
                            imageDataArray[i * 4 + 1] = (rawDataArray[i*4+1]&0x0f) << 4 | (rawDataArray[i*4+2]&0x3c) >> 2;
                            imageDataArray[i * 4 + 2] = (rawDataArray[i*4+2]&0x03) << 6 | (rawDataArray[i*4+3]&0x3f);
                            imageDataArray[i * 4 + 3] = 255;
                        }
                    } else if (3 === bytesPerPixel) {
                        imageDataArray = new Uint8ClampedArray(width * height * 4);
                        for (let i = 0; i < width * height; i++) {
                            imageDataArray[i * 4] =rawDataArray[i * 3];     // R
                            imageDataArray[i * 4 + 1] =rawDataArray[i * 3 + 1]; // G
                            imageDataArray[i * 4 + 2] =rawDataArray[i * 3 + 2]; // B
                            imageDataArray[i * 4 + 3] = 255;             // A
                        }
                    } else {
                        console.warn(`Unsupported image data length for RGB8: ${imageData.length}`);
                        return null;
                    }
                    break;
                default:
                    console.warn(`Unsupported image encoding: ${encoding}`);
                    return null;
            }

            // 创建ImageData并绘制到canvas
            const imgData = new ImageData(imageDataArray, width, height);
            ctx.putImageData(imgData, 0, 0);

            // 创建THREE.js纹理
            const canvasTexture = new THREE.CanvasTexture(canvas);
            canvasTexture.flipY = true; // ROS图像通常不需要翻转Y轴
            canvasTexture.needsUpdate = true;

            return canvasTexture;
        } catch (error) {
            console.error('Error processing image data:', error);
            return null;
        }
    }, [data]);

    useEffect(() => {
        if (processImageData) {
            setTexture(processImageData);
        }

        // 清理纹理资源
        return () => {
            if (texture) {
                texture.dispose();
            }
        };
    }, [processImageData]);

    if (!texture || !data) return null;

    // 计算图像平面的尺寸比例
    const aspectRatio = data.width / data.height;
    const planeWidth = scale * aspectRatio;
    const planeHeight = scale;

    return (
        <group position={position}>
            {/* 图像显示平面 */}
            <mesh ref={meshRef}>
                <planeGeometry args={[planeWidth, planeHeight]} />
                <meshBasicMaterial map={texture} side={THREE.DoubleSide} />
            </mesh>

            {/* 图像边框 */}
            <lineSegments>
                <edgesGeometry args={[new THREE.PlaneGeometry(planeWidth, planeHeight)]} />
                <lineBasicMaterial color="#ffffff" linewidth={2} />
            </lineSegments>

            {/* 坐标系参考 (预留TF接口) */}
            <group scale={[0.1, 0.1, 0.1]}>
                {/* X轴 - 红色 */}
                <mesh position={[0.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                    <cylinderGeometry args={[0.02, 0.02, 1]} />
                    <meshStandardMaterial color="#ff0000" />
                </mesh>
                {/* Y轴 - 绿色 */}
                <mesh position={[0, 0.5, 0]}>
                    <cylinderGeometry args={[0.02, 0.02, 1]} />
                    <meshStandardMaterial color="#00ff00" />
                </mesh>
                {/* Z轴 - 蓝色 */}
                <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
                    <cylinderGeometry args={[0.02, 0.02, 1]} />
                    <meshStandardMaterial color="#0000ff" />
                </mesh>
            </group>
        </group>
    );
}

// 图像信息显示组件
function ImageInfo({ data, position = [0, -1, 0] }) {
    if (!data || !data.header) return null;

    const { header, width, height, encoding, step } = data;

    return (
        <group position={position}>
            {/* 这里可以添加文本显示组件来显示图像信息 */}
            {/* 暂时用console输出，后续可以添加3D文本组件 */}
        </group>
    );
}

// 主要的图像可视化组件
function ImageVisualization({ data, topic }) {
    // TODO: 预留TF变换接口
    // 当TF系统实现后，可以根据header.frame_id获取变换矩阵
    // const tfTransform = useTFTransform(data.header.frame_id, 'world');

    // 暂时使用固定位置，后续可以根据TF变换调整
    const position = [0, 0, 0];
    const rotation = [0, 0, 0];

    if (!data) return null;

    return (
        <group position={position} rotation={rotation}>
            {/* 图像显示 */}
            <ImageDisplay data={data} position={[0, 0, 0]} scale={2.0} />

            {/* 图像信息显示 */}
            <ImageInfo data={data} position={[0, -1.5, 0]} />

            {/* 话题名称标签 (可选) */}
            {/* <TextLabel text={topic} position={[0, 1.5, 0]} /> */}
        </group>
    );
}

// Image插件类
export class ImagePlugin extends VisualizationPlugin {
    constructor() {
        super('ImagePlugin', 5, '1.0.0');
    }

    canHandle(topic, type, data) {
        // 检查是否为sensor_msgs/Image类型
        return type === "sensor_msgs/Image"
    }

    render(topic, type, data, frameId, tfManager) {
        return (
            <TFWrapper frameId={frameId} tfManager={tfManager}>
                <ImageVisualization
                    key={`image-${topic}`}
                    data={data}
                    topic={topic}
                />
            </TFWrapper>
        );
    }
}

export default new ImagePlugin();