
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Stars } from "@react-three/drei";
import { useRef } from "react";

function EnergyCore() {
  const core = useRef();
  const outerRing = useRef();
  const innerRing = useRef();

  useFrame((state, delta) => {
    if (core.current) {
      core.current.rotation.y += delta * 0.35;
      core.current.rotation.x += delta * 0.15;
    }

    if (outerRing.current) {
      outerRing.current.rotation.x += delta * 0.25;
      outerRing.current.rotation.y += delta * 0.35;
    }

    if (innerRing.current) {
      innerRing.current.rotation.y -= delta * 0.5;
    }
  });

  return (
    <Float speed={1.5} floatIntensity={0.25}>
      <mesh ref={core}>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial
          color="#18d9ff"
          emissive="#0077ff"
          emissiveIntensity={2}
          wireframe
        />
      </mesh>

      <mesh ref={outerRing}>
        <torusGeometry args={[1.5, 0.012, 12, 120]} />
        <meshBasicMaterial color="#18d9ff" />
      </mesh>

      <mesh ref={innerRing}>
        <torusGeometry args={[1.25, 0.018, 12, 120]} />
        <meshBasicMaterial color="#a855f7" />
      </mesh>

      <mesh>
        <sphereGeometry args={[0.65, 32, 32]} />
        <meshBasicMaterial
          color="#087cff"
          transparent
          opacity={0.12}
        />
      </mesh>
    </Float>
  );
}

export default function JarvisOrb() {
  return (
    <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
      <ambientLight intensity={0.6} />
      <pointLight position={[2, 2, 3]} intensity={2} color="#18d9ff" />

      <Stars
        radius={30}
        depth={20}
        count={500}
        factor={2}
        fade
      />

      <EnergyCore />
    </Canvas>
  );
}
