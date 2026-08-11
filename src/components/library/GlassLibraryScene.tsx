// src/components/library/GlassLibraryScene.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { Book } from "./LibraryProvider";
import { makeCoverTexture, makePageTexture, makeSpineTexture } from "./bookTexture";

const GOLD = "#C49A3C";
const EMBER = "#D4742B";
const DEFAULT_COLOR = "#1A3D2A"; // olive deep fallback

export interface ShelfRow {
  label: string;
  labelAr: string;
  books: Book[];
}

function rand(seed: number) {
  const x = Math.sin(seed * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

interface Placed {
  book: Book;
  thickness: number;
  height: number;
  depth: number;
  tilt: number;
  x: number;
}

const SHELF_WIDTH = 8.6;
const SHELF_GAP = 2.35;
const SHELF_DEPTH = 1.6;

function placeRow(books: Book[]): Placed[] {
  const items = books.map((book, i) => ({
    book,
    thickness: 0.22 + rand(i + 5) * 0.1,
    height: 1.34 + rand(i + 17) * 0.36,
    depth: 0.88 + rand(i + 29) * 0.24,
    tilt: rand(i + 41) > 0.84 ? (rand(i + 53) - 0.5) * 0.17 : 0,
    x: 0,
  }));
  const inner = SHELF_WIDTH - 0.9;
  const total = items.reduce((t, p) => t + p.thickness, 0);
  const gap =
    items.length > 1
      ? Math.min(1.35, Math.max(0.04, (inner - total) / (items.length - 1)))
      : 0;
  const used = total + gap * Math.max(0, items.length - 1);
  let cursor = -used / 2;
  items.forEach((p) => {
    p.x = cursor + p.thickness / 2;
    cursor += p.thickness + gap;
  });
  return items;
}

function BookMesh({
  placed,
  onOpen,
}: {
  placed: Placed;
  onOpen: () => void;
}) {
  const { book, thickness, height, depth, tilt } = placed;
  const group = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // استخدام اللون من الكتاب أو لون افتراضي
  const bookColor = useMemo(() => {
    // إذا كان للكتاب حقل cover_url، يمكننا استخدام لون افتراضي
    // وإلا نستخدم لون التصنيف من دالة خارجية (غير متوفرة هنا، لذا سنستخدم olive الافتراضي)
    return DEFAULT_COLOR;
  }, [book]);

  const pageTex = useMemo(() => makePageTexture(), []);
  const spineTex = useMemo(() => makeSpineTexture(book.title, bookColor), [book, bookColor]);
  const coverTex = useMemo(
    () => makeCoverTexture(book.title, book.author || "", bookColor),
    [book, bookColor],
  );

  const materials = useMemo(() => {
    const paper = new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.98 });
    const cover = (map: THREE.Texture) =>
      new THREE.MeshPhysicalMaterial({
        map,
        roughness: 0.46,
        metalness: 0.08,
        clearcoat: 0.35,
        clearcoatRoughness: 0.5,
        sheen: 0.4,
        sheenRoughness: 0.8,
      });
    return [cover(coverTex), cover(coverTex), paper, paper, cover(spineTex), paper];
  }, [coverTex, spineTex, pageTex]);

  useEffect(() => {
    return () => {
      [pageTex, spineTex, coverTex].forEach((t) => t.dispose());
      materials.forEach((m) => m.dispose());
    };
  }, [materials, pageTex, spineTex, coverTex]);

  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    const k = Math.min(1, delta * 6);
    const targetRot = hovered ? -Math.PI / 2 : 0;
    g.rotation.y += (targetRot - g.rotation.y) * k;
    g.rotation.z += ((hovered ? 0 : tilt) - g.rotation.z) * k;
    const targetZ = hovered ? 0.95 : 0;
    g.position.z += (targetZ - g.position.z) * k;
    const targetY = height / 2 + (hovered ? 0.06 : 0);
    g.position.y += (targetY - g.position.y) * k;
  });

  materials.forEach((m) => {
    if ("emissive" in m) {
      (m as THREE.MeshStandardMaterial).emissive.set(hovered ? EMBER : "#000000");
      (m as THREE.MeshStandardMaterial).emissiveIntensity = hovered ? 0.14 : 0;
    }
  });

  return (
    <group
      ref={group}
      position={[placed.x, height / 2, 0]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "auto";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      <mesh castShadow material={materials}>
        <boxGeometry args={[thickness, height, depth]} />
      </mesh>

      {/* paper block, slightly inset */}
      <mesh position={[0, 0, -0.012]} scale={[0.94, 0.965, 0.985]}>
        <boxGeometry args={[thickness, height, depth]} />
        <meshStandardMaterial map={pageTex} roughness={1} />
      </mesh>

      {hovered && (
        <mesh scale={[1.14, 1.03, 1.05]}>
          <boxGeometry args={[thickness, height, depth]} />
          <meshBasicMaterial color={GOLD} transparent opacity={0.14} side={THREE.BackSide} />
        </mesh>
      )}

      {hovered && (
        <Html position={[0, height / 2 + 0.34, depth / 2]} center distanceFactor={9}>
          <div className="glass-panel pointer-events-none w-60 rounded-xl px-4 py-3 text-center">
            <p className="font-display text-xl leading-tight text-foreground">{book.title}</p>
            <p className="font-arabic mt-0.5 text-base text-gold">{book.author || ""}</p>
            <p className="mt-1 text-[10px] tracking-[0.2em] text-accent uppercase">
              {book.author || "Ruhulqudus"}
            </p>
            <p className="mt-1.5 line-clamp-3 text-[11px] leading-snug text-muted-foreground">
              {book.description || ""}
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}

function GlassShelf({
  row,
  y,
  onOpen,
}: {
  row: ShelfRow;
  y: number;
  onOpen: (b: Book) => void;
}) {
  const placed = useMemo(() => placeRow(row.books), [row]);
  const edges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(SHELF_WIDTH, 0.09, SHELF_DEPTH)),
    [],
  );

  return (
    <group position={[0, y, 0]}>
      {/* glass shelf plate */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={[SHELF_WIDTH, 0.09, SHELF_DEPTH]} />
        <meshPhysicalMaterial
          color="#FDFBF7"
          transparent
          opacity={0.2}
          roughness={0.1}
          metalness={0.1}
          transmission={0.55}
          thickness={0.4}
          ior={1.4}
        />
      </mesh>
      <lineSegments position={[0, -0.06, 0]} geometry={edges}>
        <lineBasicMaterial color={GOLD} transparent opacity={0.75} />
      </lineSegments>
      {/* brass front rail */}
      <mesh position={[0, 0.01, SHELF_DEPTH / 2 - 0.02]}>
        <boxGeometry args={[SHELF_WIDTH, 0.03, 0.03]} />
        <meshStandardMaterial color={GOLD} metalness={0.85} roughness={0.28} />
      </mesh>

      {/* nameplate */}
      <Html position={[-SHELF_WIDTH / 2 - 1.1, 0.75, 0.3]} center distanceFactor={9}>
        <div className="glass-panel w-40 rounded-xl px-3 py-2 text-center">
          <p className="font-display text-foreground text-xl leading-tight">{row.label}</p>
          <p className="font-arabic text-gold mt-0.5 text-base leading-tight">{row.labelAr}</p>
        </div>
      </Html>

      {placed.map((p) => (
        <BookMesh key={p.book.id} placed={p} onOpen={() => onOpen(p.book)} />
      ))}
    </group>
  );
}

function SlidingCase({
  rows,
  direction,
  onOpen,
}: {
  rows: ShelfRow[];
  direction: number;
  onOpen: (b: Book) => void;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    const g = group.current;
    if (!g) return;
    g.position.x += (0 - g.position.x) * Math.min(1, delta * 3.4);
  });
  return (
    <group ref={group} position={[direction * 18, 0, 0]}>
      {rows.map((row, i) => (
        <GlassShelf key={row.label + i} row={row} y={i * SHELF_GAP} onOpen={onOpen} />
      ))}
      {/* glass uprights */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[(s * SHELF_WIDTH) / 2, ((rows.length - 1) * SHELF_GAP) / 2, 0]}
        >
          <boxGeometry args={[0.07, (rows.length - 1) * SHELF_GAP + 2.4, SHELF_DEPTH]} />
          <meshPhysicalMaterial
            color="#FDFBF7"
            transparent
            opacity={0.16}
            roughness={0.1}
            metalness={0.1}
            transmission={0.5}
            thickness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

function Rig({ rows }: { rows: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const height = (rows - 1) * SHELF_GAP + 6.6;
    const cam = camera as THREE.PerspectiveCamera;
    const vFit = height / (2 * Math.tan((cam.fov * Math.PI) / 360));
    const hFit = (SHELF_WIDTH + 6.6) / (2 * Math.tan((cam.fov * Math.PI) / 360) * cam.aspect);
    const dist = Math.max(9, vFit, hFit);
    camera.position.set(0, ((rows - 1) * SHELF_GAP) / 2 + 1.15, dist);
    camera.updateProjectionMatrix();
  }, [camera, rows]);
  return null;
}

export default function GlassLibraryScene({
  rows,
  direction,
  theme,
  onOpen,
}: {
  rows: ShelfRow[];
  direction: number;
  theme: "light" | "dark";
  onOpen: (b: Book) => void;
}) {
  const centerY = ((rows.length - 1) * SHELF_GAP) / 2;
  const dark = theme === "dark";

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 42, position: [0, centerY, 16] }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[dark ? "#0E1A13" : "#FAF7F1"]} />
      <fog attach="fog" args={[dark ? "#0E1A13" : "#F1ECE2", 24, 52]} />
      <Rig rows={rows.length} />

      <ambientLight intensity={dark ? 0.85 : 1.15} color={dark ? "#EADFC8" : "#FFFBF3"} />
      <directionalLight
        position={[0, centerY + 8, 9]}
        intensity={dark ? 1.35 : 1.75}
        color="#FBEFD8"
        castShadow
      />
      <directionalLight position={[-7, centerY + 3, 6]} intensity={0.5} color="#FFF3E2" />
      <pointLight position={[-8, centerY, -5]} intensity={dark ? 34 : 14} color={EMBER} />
      <pointLight position={[8, centerY + 2, -5]} intensity={dark ? 28 : 12} color={GOLD} />
      <hemisphereLight intensity={dark ? 0.4 : 0.75} color="#FBEFD8" groundColor="#163021" />

      <SlidingCase rows={rows} direction={direction} onOpen={onOpen} />

      <OrbitControls
        enableDamping
        dampingFactor={0.04}
        rotateSpeed={0.3}
        zoomSpeed={0.5}
        panSpeed={0.4}
        minPolarAngle={Math.PI / 2 - 0.52}
        maxPolarAngle={Math.PI / 2 + 0.52}
        minAzimuthAngle={-0.6}
        maxAzimuthAngle={0.6}
        target={[0, centerY + 1.15, 0]}
      />
    </Canvas>
  );
}