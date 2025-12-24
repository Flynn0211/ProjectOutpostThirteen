import { useEffect, useState } from "react";
import { NPC as NPCType } from "../types";
import { getNPCSpriteUrl } from "../utils/imageUtils";

interface NPCProps {
  npc: NPCType;
  position: { x: number; y: number };
  isWalking: boolean;
}

export function NPCComponent({ npc, position, isWalking }: NPCProps) {
  const [frame, setFrame] = useState(0);
  const spriteUrl = getNPCSpriteUrl(npc.rarity, npc.profession);
  const animationType = isWalking ? "walk" : "idle";
  const frameWidth = 128;
  const frameHeight = 128;

  useEffect(() => {
    if (!isWalking) {
      setFrame(0);
      return;
    }

    const interval = setInterval(() => {
      setFrame((prev) => (prev + 1) % 4); // Assume 4 frames for walk animation
    }, 200); // Change frame every 200ms

    return () => clearInterval(interval);
  }, [isWalking]);

  return (
    <div
      className="absolute pointer-events-auto"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${frameWidth}px`,
        height: `${frameHeight}px`,
        transform: "scale(0.5)", // Scale down to fit in room
      }}
    >
      <div
        className="w-full h-full bg-contain bg-no-repeat"
        style={{
          backgroundImage: `url(${spriteUrl})`,
          backgroundPosition: `-${frame * frameWidth}px 0`,
        }}
      />
    </div>
  );
}

