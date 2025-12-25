import type { CSSProperties } from "react";
import type { NPC as NPCType } from "../types";
import { getNPCSpriteUrl } from "../utils/imageUtils";
import { SpriteSheet } from "./SpriteSheet";

interface NPCProps {
  npc: NPCType;
  position: { x: number; y: number };
  isWalking: boolean;
}

export function NPCComponent({ npc, position, isWalking }: NPCProps) {
  const spriteUrl = getNPCSpriteUrl(npc.rarity, npc.profession);
  const frameWidth = 128;
  const frameHeight = 128;

  const containerStyle: CSSProperties = {
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: `${frameWidth}px`,
    height: `${frameHeight}px`,
    transform: "scale(0.5)",
    transformOrigin: "top left",
  };

  return (
    <div
      className="absolute pointer-events-auto"
      style={containerStyle}
    >
      <SpriteSheet
        src={spriteUrl}
        frameWidth={frameWidth}
        frameHeight={frameHeight}
        fps={12}
        playing={isWalking}
      />
    </div>
  );
}


