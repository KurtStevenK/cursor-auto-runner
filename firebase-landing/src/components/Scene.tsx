import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

function PulseRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 0.6) * 0.04;
    ref.current.scale.setScalar(s);
    ref.current.rotation.z = t * 0.08;
  });
  return (
    <mesh ref={ref} rotation={[Math.PI / 2.2, 0, 0]}>
      <torusGeometry args={[2.8, 0.02, 16, 128]} />
      <meshBasicMaterial color="#5effc8" transparent opacity={0.35} />
    </mesh>
  );
}

function ParticleField() {
  const count = 1200;
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 28;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 16;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return arr;
  }, []);

  useFrame(({ clock, pointer }) => {
    if (!ref.current) return;
    ref.current.rotation.y = clock.getElapsedTime() * 0.03 + pointer.x * 0.15;
    ref.current.rotation.x = pointer.y * 0.08;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#8b7bff"
        transparent
        opacity={0.85}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

function SceneContent() {
  return (
    <>
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 8, 22]} />
      <ambientLight intensity={0.35} />
      <pointLight position={[4, 3, 2]} intensity={1.2} color="#5effc8" />
      <pointLight position={[-5, -2, 1]} intensity={0.6} color="#8b7bff" />
      <Stars radius={40} depth={30} count={2500} factor={3} fade speed={0.4} />
      <ParticleField />
      <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.6}>
        <PulseRing />
      </Float>
    </>
  );
}

export function Scene() {
  return (
    <div className="scene-root" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 7], fov: 55 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <SceneContent />
      </Canvas>
    </div>
  );
}
