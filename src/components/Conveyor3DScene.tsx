import React, { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { SensorData, CombinedPrediction, Severity } from '../types';

interface Conveyor3DSceneProps {
  sensorData: SensorData;
  prediction: CombinedPrediction;
  motorSeverity: Severity;
  drivePulleySeverity: Severity;
  joint1Severity: Severity;
  joint2Severity: Severity;
  tensionerSeverity: Severity;
  recentlyChanged: Record<string, boolean>;
  showFlowParticles: boolean;
  onSelectComponent: (id: string) => void;
  activeHighlight: string | null;
  cameraDefectType?: string;
  cameraDefectConfidence?: number;
  cameraSnapshotUrl?: string;
}

// Convert severity to Three.js color
function getSeverityColor(sev: Severity): string {
  switch (sev) {
    case 'critical':
      return '#ef4444';
    case 'warning':
      return '#f59e0b';
    case 'healthy':
    default:
      return '#10b981';
  }
}

// Spillage Debris falling off the edge at Joint 1 / transfer point when Material Spillage is detected
const SpillageDebrisParticles: React.FC<{ active: boolean }> = ({ active }) => {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const count = 28;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: -1.8 + (Math.random() - 0.5) * 1.8,
      y: 0.85 + Math.random() * 0.1,
      z: 0.95 + Math.random() * 0.35,
      vy: -0.035 - Math.random() * 0.04,
      vx: (Math.random() - 0.5) * 0.015,
      vz: 0.018 + Math.random() * 0.025,
      scale: 0.045 + Math.random() * 0.05,
      rot: Math.random() * Math.PI,
    }));
  }, []);

  useFrame(() => {
    if (!meshRef.current || !active) return;
    particles.forEach((p, i) => {
      p.y += p.vy;
      p.x += p.vx;
      p.z += p.vz;
      p.rot += 0.04;
      if (p.y < -1.0) {
        p.y = 0.85 + Math.random() * 0.1;
        p.x = -1.8 + (Math.random() - 0.5) * 1.8;
        p.z = 0.95 + Math.random() * 0.2;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(p.scale, p.scale, p.scale);
      dummy.rotation.set(p.rot, p.rot, 0);
      dummy.updateMatrix();
      meshRef.current?.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#ea580c"
        roughness={0.9}
        emissive="#c2410c"
        emissiveIntensity={0.8}
      />
    </instancedMesh>
  );
};

// Component representing the moving belt with textured chevron grooves and joints
const AnimatedBelt: React.FC<{
  beltSpeed: number;
  joint1Severity: Severity;
  joint2Severity: Severity;
  recentlyChanged: Record<string, boolean>;
  onSelectComponent: (id: string) => void;
  activeHighlight: string | null;
  cameraDefectType?: string;
  cameraDefectConfidence?: number;
}> = ({
  beltSpeed,
  joint1Severity,
  joint2Severity,
  recentlyChanged,
  onSelectComponent,
  activeHighlight,
  cameraDefectType,
  cameraDefectConfidence,
}) => {
  const beltTexture = useMemo(() => {
    // Generate a procedural canvas texture for conveyor belt surface with ribbing
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Dark rubber base
      ctx.fillStyle = '#1c2128';
      ctx.fillRect(0, 0, 256, 256);

      // Belt surface texture grooves / tread pattern
      ctx.strokeStyle = '#2d333b';
      ctx.lineWidth = 4;
      for (let y = 0; y < 256; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(256, y);
        ctx.stroke();
      }

      // Reinforcing steel cord lines along length
      ctx.strokeStyle = '#22272e';
      ctx.lineWidth = 1;
      for (let x = 8; x < 256; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 256);
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 1);
    return texture;
  }, []);

  const topStrandRef = useRef<THREE.Mesh>(null);
  const bottomStrandRef = useRef<THREE.Mesh>(null);
  const joint1Ref = useRef<THREE.Mesh>(null);
  const joint2Ref = useRef<THREE.Mesh>(null);

  // Joint loop travel position state (0 to 1 along conveyor loop)
  const joint1PosRef = useRef<number>(0.28);
  const joint2PosRef = useRef<number>(0.74);

  useFrame((_, delta) => {
    // Animate belt texture UV offset proportional to speed
    if (beltSpeed > 0) {
      const speedFactor = beltSpeed * 0.18 * delta;
      beltTexture.offset.x = (beltTexture.offset.x + speedFactor) % 1;

      // Animate joints along loop
      joint1PosRef.current = (joint1PosRef.current + speedFactor * 0.2) % 1;
      joint2PosRef.current = (joint2PosRef.current + speedFactor * 0.2) % 1;

      // Map loop position (0..1) to physical coordinates:
      // Length = 12, Height difference = 1.0 (slight industrial conveyor incline)
      const updateJointMesh = (mesh: THREE.Mesh | null, posVal: number) => {
        if (!mesh) return;
        if (posVal < 0.5) {
          // Top strand: moving from right (+6) to left (-6)
          const t = posVal / 0.5;
          const x = 6 - t * 12;
          const y = 0.52 + (1 - t) * 0.6; // slight incline
          mesh.position.set(x, y, 0);
        } else {
          // Bottom return strand: moving from left (-6) to right (+6)
          const t = (posVal - 0.5) / 0.5;
          const x = -6 + t * 12;
          const y = -0.52 + t * 0.6;
          mesh.position.set(x, y, 0);
        }
      };

      updateJointMesh(joint1Ref.current, joint1PosRef.current);
      updateJointMesh(joint2Ref.current, joint2PosRef.current);
    }
  });

  const isCameraDefectOnJ1 = Boolean(cameraDefectType && cameraDefectType !== 'Normal');
  const j1Color =
    cameraDefectType === 'Material Spillage'
      ? '#f97316'
      : cameraDefectType === 'Crack/Tear'
      ? '#ef4444'
      : cameraDefectType === 'Misalignment/Edge Wear'
      ? '#f59e0b'
      : getSeverityColor(joint1Severity);

  const j2Color = getSeverityColor(joint2Severity);

  // Emissive pulse when recently changed, defect detected, or in critical status
  const j1Pulse = recentlyChanged.joint_1
    ? 2.5
    : isCameraDefectOnJ1
    ? 2.2
    : joint1Severity === 'critical'
    ? 1.8
    : 0.8;
  const j2Pulse = recentlyChanged.joint_2 ? 2.5 : joint2Severity === 'critical' ? 1.8 : 0.8;

  const [hoveredJ1, setHoveredJ1] = useState(false);
  const [hoveredJ2, setHoveredJ2] = useState(false);

  return (
    <group>
      {/* 3D Spillage Debris Particles near Joint 1 */}
      <SpillageDebrisParticles active={cameraDefectType === 'Material Spillage'} />

      {/* Top Conveyor Belt Strand (Transport surface) */}
      <mesh ref={topStrandRef} position={[0, 0.8, 0]} rotation={[0, 0, -0.05]}>
        <boxGeometry args={[12.2, 0.08, 1.8]} />
        <meshStandardMaterial
          map={beltTexture}
          roughness={0.8}
          metalness={0.1}
          color="#282f37"
        />
      </mesh>

      {/* Bottom Conveyor Belt Strand (Return strand) */}
      <mesh ref={bottomStrandRef} position={[0, -0.2, 0]} rotation={[0, 0, -0.05]}>
        <boxGeometry args={[12.2, 0.08, 1.8]} />
        <meshStandardMaterial
          map={beltTexture}
          roughness={0.85}
          metalness={0.1}
          color="#1e2329"
        />
      </mesh>

      {/* Left Pulley Wrap (Head drum contour) */}
      <mesh position={[-6.0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 1.82, 32, 1, true, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial map={beltTexture} roughness={0.8} color="#282f37" side={THREE.DoubleSide} />
      </mesh>

      {/* Right Pulley Wrap (Tail drum contour) */}
      <mesh position={[6.0, 0.3, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.55, 0.55, 1.82, 32, 1, true, -Math.PI / 2, Math.PI]} />
        <meshStandardMaterial map={beltTexture} roughness={0.8} color="#282f37" side={THREE.DoubleSide} />
      </mesh>

      {/* VULCANIZED JOINT #1 (Active Camera Synced Splice) */}
      <mesh
        ref={joint1Ref}
        position={[-1.8, 0.85, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectComponent('joint_1');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredJ1(true);
        }}
        onPointerOut={() => setHoveredJ1(false)}
      >
        <boxGeometry args={[0.45, 0.12, 1.86]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive={j1Color}
          emissiveIntensity={hoveredJ1 || activeHighlight === 'joint_1' ? 3.0 : j1Pulse}
          roughness={0.3}
          metalness={0.4}
        />
        {(hoveredJ1 || activeHighlight === 'joint_1' || joint1Severity !== 'healthy' || isCameraDefectOnJ1) && (
          <Html position={[0, 0.6, 0]} center distanceFactor={14}>
            <div
              className={`px-2.5 py-1 rounded-[4px] border text-white text-[11px] font-mono whitespace-nowrap pointer-events-none shadow-xl flex items-center gap-1.5 backdrop-blur-md ${
                cameraDefectType === 'Material Spillage'
                  ? 'bg-orange-950/90 border-orange-500 text-orange-200 animate-pulse'
                  : cameraDefectType === 'Crack/Tear'
                  ? 'bg-red-950/90 border-red-500 text-red-200 animate-pulse'
                  : cameraDefectType === 'Misalignment/Edge Wear'
                  ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                  : joint1Severity === 'critical'
                  ? 'bg-red-950/90 border-red-500 text-red-200'
                  : joint1Severity === 'warning'
                  ? 'bg-amber-950/90 border-amber-500 text-amber-200'
                  : 'bg-black/90 border-white/20'
              }`}
            >
              {cameraDefectType === 'Material Spillage' ? (
                <span>⚠️ Material Spillage ({cameraDefectConfidence || 84}%)</span>
              ) : cameraDefectType === 'Crack/Tear' ? (
                <span>🔴 Crack/Tear ({cameraDefectConfidence || 91}%)</span>
              ) : cameraDefectType === 'Misalignment/Edge Wear' ? (
                <span>⚠️ Edge Wear ({cameraDefectConfidence || 78}%)</span>
              ) : (
                <>
                  <span className="font-bold text-[var(--accent-primary)]">Joint Splice #1</span> ({joint1Severity.toUpperCase()})
                </>
              )}
            </div>
          </Html>
        )}
      </mesh>

      {/* VULCANIZED JOINT #2 (Hot Spliced ST-4500) */}
      <mesh
        ref={joint2Ref}
        position={[2.4, 0.72, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelectComponent('joint_2');
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredJ2(true);
        }}
        onPointerOut={() => setHoveredJ2(false)}
      >
        <boxGeometry args={[0.45, 0.12, 1.86]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive={j2Color}
          emissiveIntensity={hoveredJ2 || activeHighlight === 'joint_2' ? 3.0 : j2Pulse}
          roughness={0.3}
          metalness={0.4}
        />
        {(hoveredJ2 || activeHighlight === 'joint_2' || joint2Severity === 'critical') && (
          <Html position={[0, 0.6, 0]} center distanceFactor={14}>
            <div className="px-2 py-1 rounded-[4px] bg-black/90 border border-white/20 text-white text-[11px] font-mono whitespace-nowrap pointer-events-none shadow-lg">
              <span className="font-bold text-[var(--accent-primary)]">Joint Splice #2</span> ({joint2Severity.toUpperCase()})
            </div>
          </Html>
        )}
      </mesh>
    </group>
  );
};

// Moving Ore Pellets Cargo
const OreCargoParticles: React.FC<{ beltSpeed: number; visible: boolean }> = ({ beltSpeed, visible }) => {
  const particlesRef = useRef<THREE.InstancedMesh>(null);
  const count = 48;

  // Pre-generate random offsets
  const particleData = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      baseX: -5.5 + (i / count) * 11.0,
      zOffset: (Math.random() - 0.5) * 1.3,
      size: 0.08 + Math.random() * 0.07,
      rotY: Math.random() * Math.PI,
    }));
  }, [count]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!particlesRef.current || !visible) return;
    const speedFactor = (beltSpeed > 0 ? beltSpeed : 0) * 0.25 * delta;

    particleData.forEach((p, idx) => {
      // Flow from right (+5.8) to left (-5.8)
      p.baseX -= speedFactor;
      if (p.baseX < -5.8) {
        p.baseX = 5.8;
      }
      const inclineY = 0.86 - (p.baseX / 12) * 0.06;
      dummy.position.set(p.baseX, inclineY, p.zOffset);
      dummy.scale.set(p.size, p.size * 0.75, p.size);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.updateMatrix();
      particlesRef.current!.setMatrixAt(idx, dummy.matrix);
    });
    particlesRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!visible) return null;

  return (
    <instancedMesh ref={particlesRef} args={[undefined, undefined, count]}>
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#8b5cf6" roughness={0.9} />
    </instancedMesh>
  );
};

// Head Drive Pulley (with ceramic lagging and rotating shaft)
const HeadDrivePulley: React.FC<{
  severity: Severity;
  beltSpeed: number;
  recentlyChanged: boolean;
  onSelect: () => void;
  activeHighlight: boolean;
}> = ({ severity, beltSpeed, recentlyChanged, onSelect, activeHighlight }) => {
  const drumRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const color = getSeverityColor(severity);
  const emissivePulse = recentlyChanged ? 2.5 : severity === 'critical' ? 1.8 : 0.6;

  useFrame((_, delta) => {
    if (drumRef.current && beltSpeed > 0) {
      drumRef.current.rotation.z -= beltSpeed * 0.8 * delta;
    }
  });

  return (
    <group position={[-6.0, 0.3, 0]}>
      {/* Interactive Drum Assembly */}
      <group
        ref={drumRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        {/* Main Drive Cylinder Drum (1,200mm Dia) */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 1.8, 32]} />
          <meshStandardMaterial
            color="#334155"
            emissive={color}
            emissiveIntensity={hovered || activeHighlight ? 2.4 : emissivePulse}
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>

        {/* Central Drive Shaft */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 2.6, 24]} />
          <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.9} />
        </mesh>

        {/* End Lagging Rims */}
        <mesh position={[0, 0, 0.92]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.54, 0.54, 0.06, 32]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
        <mesh position={[0, 0, -0.92]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.54, 0.54, 0.06, 32]} />
          <meshStandardMaterial color="#1e293b" metalness={0.8} />
        </mesh>
      </group>

      {/* Pillow Block Bearing Assemblies on Both Sides */}
      <mesh position={[0, 0, 1.15]}>
        <boxGeometry args={[0.4, 0.45, 0.25]} />
        <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0, -1.15]}>
        <boxGeometry args={[0.4, 0.45, 0.25]} />
        <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.5} />
      </mesh>

      {(hovered || activeHighlight || severity === 'critical') && (
        <Html position={[0, 0.9, 0]} center distanceFactor={14}>
          <div className="px-2 py-1 rounded-[4px] bg-black/90 border border-white/20 text-white text-[11px] font-mono whitespace-nowrap pointer-events-none shadow-lg">
            <span className="font-bold text-[var(--accent-primary)]">Head Drive Pulley</span> ({severity.toUpperCase()})
          </div>
        </Html>
      )}
    </group>
  );
};

// 450 kW Induction Motor & Heavy Duty Gearbox
const DriveMotor: React.FC<{
  severity: Severity;
  beltSpeed: number;
  recentlyChanged: boolean;
  onSelect: () => void;
  activeHighlight: boolean;
}> = ({ severity, beltSpeed, recentlyChanged, onSelect, activeHighlight }) => {
  const [hovered, setHovered] = useState(false);
  const color = getSeverityColor(severity);
  const emissivePulse = recentlyChanged ? 2.5 : severity === 'critical' ? 1.8 : 0.6;

  return (
    <group
      position={[-6.0, 0.3, 1.9]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Motor Main Casing (Cylinder with Cooling Ribs) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.42, 0.42, 0.9, 24]} />
        <meshStandardMaterial
          color="#1e293b"
          emissive={color}
          emissiveIntensity={hovered || activeHighlight ? 2.4 : emissivePulse}
          roughness={0.5}
          metalness={0.7}
        />
      </mesh>

      {/* Terminal Junction Box */}
      <mesh position={[0, 0.46, 0]}>
        <boxGeometry args={[0.26, 0.16, 0.28]} />
        <meshStandardMaterial color="#334155" roughness={0.6} />
      </mesh>

      {/* Reducer Gearbox Enclosure */}
      <mesh position={[0.4, -0.05, -0.55]}>
        <boxGeometry args={[0.65, 0.7, 0.55]} />
        <meshStandardMaterial
          color="#0f172a"
          emissive={color}
          emissiveIntensity={hovered || activeHighlight ? 1.6 : emissivePulse * 0.7}
          roughness={0.4}
          metalness={0.8}
        />
      </mesh>

      {/* Motor Fan Shroud (Rear) */}
      <mesh position={[0, 0, 0.52]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.14, 24]} />
        <meshStandardMaterial color="#0f172a" roughness={0.7} />
      </mesh>

      {/* Mounting Bedplate */}
      <mesh position={[0.2, -0.42, -0.2]}>
        <boxGeometry args={[1.2, 0.12, 1.5]} />
        <meshStandardMaterial color="#334155" metalness={0.5} />
      </mesh>

      {(hovered || activeHighlight || severity === 'critical') && (
        <Html position={[0, 0.9, 0]} center distanceFactor={14}>
          <div className="px-2 py-1 rounded-[4px] bg-black/90 border border-white/20 text-white text-[11px] font-mono whitespace-nowrap pointer-events-none shadow-lg">
            <span className="font-bold text-[var(--accent-primary)]">Drive Motor M-01</span> ({severity.toUpperCase()})
          </div>
        </Html>
      )}
    </group>
  );
};

// Tail Return Pulley & Loading Chute Impact Bed
const TailPulley: React.FC<{
  beltSpeed: number;
  onSelect: () => void;
  activeHighlight: boolean;
}> = ({ beltSpeed, onSelect, activeHighlight }) => {
  const drumRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((_, delta) => {
    if (drumRef.current && beltSpeed > 0) {
      drumRef.current.rotation.z -= beltSpeed * 0.8 * delta;
    }
  });

  return (
    <group position={[6.0, 0.3, 0]}>
      <group
        ref={drumRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 1.8, 32]} />
          <meshStandardMaterial
            color="#334155"
            emissive="#10b981"
            emissiveIntensity={hovered || activeHighlight ? 2.0 : 0.4}
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 2.4, 24]} />
          <meshStandardMaterial color="#64748b" roughness={0.2} metalness={0.9} />
        </mesh>
      </group>

      {/* Chute Feed Funnel above Tail */}
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.9, 0.5, 1.1, 4, 1, false, Math.PI / 4]} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.4} wireframe={false} />
      </mesh>

      {(hovered || activeHighlight) && (
        <Html position={[0, 1.2, 0]} center distanceFactor={14}>
          <div className="px-2 py-1 rounded-[4px] bg-black/90 border border-white/20 text-white text-[11px] font-mono whitespace-nowrap pointer-events-none shadow-lg">
            <span className="font-bold text-[var(--accent-primary)]">Tail Return Pulley</span>
          </div>
        </Html>
      )}
    </group>
  );
};

// Gravity Take-Up Tensioner Tower & Counterweight
const TensionerTower: React.FC<{
  severity: Severity;
  looseness: number;
  recentlyChanged: boolean;
  onSelect: () => void;
  activeHighlight: boolean;
}> = ({ severity, looseness, recentlyChanged, onSelect, activeHighlight }) => {
  const [hovered, setHovered] = useState(false);
  const color = getSeverityColor(severity);
  const emissivePulse = recentlyChanged ? 2.5 : severity === 'critical' ? 1.8 : 0.6;

  // Vertical position responds to belt looseness (sag index)
  const carriageY = -0.7 - looseness * 0.8;

  return (
    <group
      position={[-0.5, 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {/* Vertical Tower Steel Guide Columns */}
      <mesh position={[0, -0.8, 1.0]}>
        <boxGeometry args={[0.14, 2.8, 0.14]} />
        <meshStandardMaterial color="#334155" metalness={0.7} />
      </mesh>
      <mesh position={[0, -0.8, -1.0]}>
        <boxGeometry args={[0.14, 2.8, 0.14]} />
        <meshStandardMaterial color="#334155" metalness={0.7} />
      </mesh>

      {/* Top Sheave Crossbeam */}
      <mesh position={[0, 0.55, 0]}>
        <boxGeometry args={[0.2, 0.15, 2.2]} />
        <meshStandardMaterial color="#475569" metalness={0.6} />
      </mesh>

      {/* Floating Tensioner Carriage & 18T Counterweight Block */}
      <group position={[0, carriageY, 0]}>
        {/* Take-up Bend Pulley Cylinder */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 1.84, 24]} />
          <meshStandardMaterial
            color="#1e293b"
            emissive={color}
            emissiveIntensity={hovered || activeHighlight ? 2.4 : emissivePulse}
            roughness={0.5}
            metalness={0.7}
          />
        </mesh>

        {/* Counterweight Concrete Block */}
        <mesh position={[0, -0.6, 0]}>
          <boxGeometry args={[0.6, 0.65, 1.6]} />
          <meshStandardMaterial
            color="#272f3d"
            emissive={color}
            emissiveIntensity={hovered || activeHighlight ? 1.8 : emissivePulse * 0.5}
            roughness={0.9}
          />
        </mesh>
      </group>

      {(hovered || activeHighlight || severity === 'critical') && (
        <Html position={[0, -1.8, 0]} center distanceFactor={14}>
          <div className="px-2 py-1 rounded-[4px] bg-black/90 border border-white/20 text-white text-[11px] font-mono whitespace-nowrap pointer-events-none shadow-lg">
            <span className="font-bold text-[var(--accent-primary)]">Take-Up Tower</span> ({severity.toUpperCase()})
          </div>
        </Html>
      )}
    </group>
  );
};

// Structural Industrial Truss Frame & Carrying Idler Sets
const ConveyorFrameAndIdlers: React.FC = () => {
  // Generate 8 sets of 3-roll troughing idlers along conveyor length
  const idlerPositions = useMemo(() => {
    return [-4.5, -3.0, -1.5, 0.8, 2.2, 3.6, 4.8];
  }, []);

  return (
    <group>
      {/* Longitudinal Main Steel Stringer Beams (Left and Right) */}
      <mesh position={[0, 0.3, 0.98]}>
        <boxGeometry args={[12.6, 0.2, 0.1]} />
        <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.3, -0.98]}>
        <boxGeometry args={[12.6, 0.2, 0.1]} />
        <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.6} />
      </mesh>

      {/* Structural Support Pylons (Floor legs) */}
      {[-5.0, -1.8, 1.8, 5.0].map((x) => (
        <group key={x} position={[x, -0.8, 0]}>
          <mesh position={[0, 0, 0.95]}>
            <boxGeometry args={[0.16, 1.8, 0.16]} />
            <meshStandardMaterial color="#334155" metalness={0.6} />
          </mesh>
          <mesh position={[0, 0, -0.95]}>
            <boxGeometry args={[0.16, 1.8, 0.16]} />
            <meshStandardMaterial color="#334155" metalness={0.6} />
          </mesh>
          <mesh position={[0, -0.4, 0]}>
            <boxGeometry args={[0.12, 0.12, 2.0]} />
            <meshStandardMaterial color="#334155" metalness={0.6} />
          </mesh>
        </group>
      ))}

      {/* Carrying Idler Sets along top belt strand */}
      {idlerPositions.map((x) => (
        <group key={x} position={[x, 0.55, 0]}>
          {/* Center horizontal roller */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.8, 16]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} />
          </mesh>
          {/* Left inclined wing roller (35° trough angle) */}
          <mesh position={[0, 0.12, 0.58]} rotation={[Math.PI / 2, 0, 0.6]}>
            <cylinderGeometry args={[0.08, 0.08, 0.5, 16]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} />
          </mesh>
          {/* Right inclined wing roller (35° trough angle) */}
          <mesh position={[0, 0.12, -0.58]} rotation={[Math.PI / 2, 0, -0.6]}>
            <cylinderGeometry args={[0.08, 0.08, 0.5, 16]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Return idler flat rolls on underside */}
      {[-4.0, -1.0, 2.0, 4.5].map((x) => (
        <mesh key={`ret-${x}`} position={[x, -0.32, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.08, 0.08, 1.8, 16]} />
          <meshStandardMaterial color="#475569" metalness={0.7} />
        </mesh>
      ))}
    </group>
  );
};

// Main 3D Scene Root
export const Conveyor3DScene: React.FC<Conveyor3DSceneProps> = ({
  sensorData,
  prediction,
  motorSeverity,
  drivePulleySeverity,
  joint1Severity,
  joint2Severity,
  tensionerSeverity,
  recentlyChanged,
  showFlowParticles,
  onSelectComponent,
  activeHighlight,
  cameraDefectType,
  cameraDefectConfidence,
}) => {
  const controlsRef = useRef<any>(null);

  return (
    <div className="w-full h-[520px] bg-[#0c1017] rounded-[10px] relative overflow-hidden select-none">
      <Canvas
        camera={{ position: [11, 7.5, 12], fov: 42 }}
        shadows={false}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        {/* OrbitControls for user interaction: rotate, zoom, pan */}
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={5}
          maxDistance={30}
          maxPolarAngle={Math.PI / 2 + 0.05} // don't go fully under the floor
          target={[0, 0, 0]}
        />

        {/* Studio Industrial Lighting */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[12, 16, 10]} intensity={1.3} />
        <directionalLight position={[-10, 8, -10]} intensity={0.5} />
        <pointLight position={[-6, 2, 2]} intensity={0.8} color="#93c5fd" />
        <pointLight position={[6, 2, -2]} intensity={0.6} color="#fdba74" />

        {/* 3D Scene Assembly */}
        <group position={[0, -0.2, 0]}>
          {/* Animated Belt Loop with Vulcanized Joint Markers */}
          <AnimatedBelt
            beltSpeed={sensorData.belt_speed}
            joint1Severity={joint1Severity}
            joint2Severity={joint2Severity}
            recentlyChanged={recentlyChanged}
            onSelectComponent={onSelectComponent}
            activeHighlight={activeHighlight}
            cameraDefectType={cameraDefectType}
            cameraDefectConfidence={cameraDefectConfidence}
          />

          {/* Dynamic Cargo Pellets */}
          <OreCargoParticles
            beltSpeed={sensorData.belt_speed}
            visible={showFlowParticles}
          />

          {/* Head Drive Pulley */}
          <HeadDrivePulley
            severity={drivePulleySeverity}
            beltSpeed={sensorData.belt_speed}
            recentlyChanged={!!recentlyChanged.drive_pulley}
            onSelect={() => onSelectComponent('drive_pulley')}
            activeHighlight={activeHighlight === 'drive_pulley'}
          />

          {/* Electric Drive Motor & Gearbox */}
          <DriveMotor
            severity={motorSeverity}
            beltSpeed={sensorData.belt_speed}
            recentlyChanged={!!recentlyChanged.motor}
            onSelect={() => onSelectComponent('motor')}
            activeHighlight={activeHighlight === 'motor'}
          />

          {/* Tail Return Pulley */}
          <TailPulley
            beltSpeed={sensorData.belt_speed}
            onSelect={() => onSelectComponent('tail_pulley')}
            activeHighlight={activeHighlight === 'tail_pulley'}
          />

          {/* Gravity Take-Up Tensioner Tower */}
          <TensionerTower
            severity={tensionerSeverity}
            looseness={sensorData.looseness}
            recentlyChanged={!!recentlyChanged.tensioner}
            onSelect={() => onSelectComponent('tensioner')}
            activeHighlight={activeHighlight === 'tensioner'}
          />

          {/* Frame & Idler Sets */}
          <ConveyorFrameAndIdlers />

          {/* Concrete Workshop Floor Plane with grid */}
          <mesh position={[0, -1.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[36, 24]} />
            <meshStandardMaterial color="#0e131b" roughness={0.9} metalness={0.1} />
          </mesh>
          <gridHelper args={[36, 36, '#1e293b', '#131b26']} position={[0, -1.71, 0]} />
        </group>
      </Canvas>

      {/* Interactive 3D HUD Controls Overlay */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[11px] font-mono text-[var(--text-tertiary)] bg-black/80 px-3 py-1.5 rounded-[6px] border border-white/10 backdrop-blur-sm pointer-events-none">
        <span>Left-click: Orbit</span>
        <span>•</span>
        <span>Right-click: Pan</span>
        <span>•</span>
        <span>Scroll: Zoom</span>
        <span>•</span>
        <span className="text-[var(--accent-primary)]">Click node to inspect</span>
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-2">
        <button
          onClick={() => {
            if (controlsRef.current) {
              controlsRef.current.reset();
            }
          }}
          className="btn-secondary h-[26px] px-2.5 text-[11px] font-mono"
        >
          Reset View
        </button>
      </div>
    </div>
  );
};
