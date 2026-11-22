import { WallpaperPresetId } from '../types';

export const CUSTOM_WALLPAPER_IMAGE_ID = 'custom_wallpaper';

export interface WallpaperPresetDef {
  id: Exclude<WallpaperPresetId, 'custom'>;
  label: string;
  background: string;
  backgroundSize?: string;
}

export const WALLPAPER_PRESETS: WallpaperPresetDef[] = [
  {
    id: 'none',
    label: 'Theme Default',
    background: 'linear-gradient(135deg, #060a14 0%, #111c33 50%, #0f172a 100%)',
  },
  {
    id: 'aurora',
    label: 'Arctic Aurora',
    background:
      'radial-gradient(85% 60% at 15% 15%, rgba(16, 185, 129, 0.42) 0%, transparent 60%), ' +
      'radial-gradient(75% 55% at 85% 20%, rgba(56, 189, 248, 0.44) 0%, transparent 58%), ' +
      'radial-gradient(70% 65% at 55% 88%, rgba(59, 130, 246, 0.36) 0%, transparent 65%), ' +
      'linear-gradient(160deg, #030712 0%, #07172b 52%, #041621 100%)',
  },
  {
    id: 'midnight-mesh',
    label: 'Midnight Cyber',
    background:
      'radial-gradient(70% 55% at 18% 12%, rgba(99, 102, 241, 0.46) 0%, transparent 58%), ' +
      'radial-gradient(65% 55% at 86% 24%, rgba(37, 99, 235, 0.48) 0%, transparent 60%), ' +
      'radial-gradient(60% 50% at 42% 92%, rgba(168, 85, 247, 0.34) 0%, transparent 62%), ' +
      'linear-gradient(145deg, #050816 0%, #0f102b 50%, #070d1f 100%)',
  },
  {
    id: 'emerald-matrix',
    label: 'Quant Emerald',
    background:
      'linear-gradient(rgba(16, 185, 129, 0.09) 1px, transparent 1px), ' +
      'linear-gradient(90deg, rgba(16, 185, 129, 0.09) 1px, transparent 1px), ' +
      'radial-gradient(75% 60% at 78% 18%, rgba(16, 185, 129, 0.36) 0%, transparent 60%), ' +
      'radial-gradient(60% 55% at 15% 85%, rgba(6, 182, 212, 0.28) 0%, transparent 62%), ' +
      'linear-gradient(180deg, #030d0c 0%, #061816 55%, #030a0c 100%)',
    backgroundSize: '42px 42px, 42px 42px, 100% 100%, 100% 100%, 100% 100%',
  },
  {
    id: 'sunset-horizon',
    label: 'Gold Horizon',
    background:
      'radial-gradient(80% 50% at 50% 8%, rgba(245, 158, 11, 0.4) 0%, transparent 58%), ' +
      'radial-gradient(65% 50% at 88% 36%, rgba(244, 63, 94, 0.34) 0%, transparent 60%), ' +
      'radial-gradient(70% 55% at 14% 84%, rgba(59, 130, 246, 0.32) 0%, transparent 62%), ' +
      'linear-gradient(170deg, #120b09 0%, #190e1c 50%, #070b18 100%)',
  },
  {
    id: 'obsidian-grid',
    label: 'Terminal Grid',
    background:
      'linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px), ' +
      'linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px), ' +
      'radial-gradient(65% 50% at 50% 0%, rgba(148, 163, 184, 0.22) 0%, transparent 65%), ' +
      'linear-gradient(180deg, #050608 0%, #0b0e14 100%)',
    backgroundSize: '36px 36px, 36px 36px, 100% 100%, 100% 100%',
  },
];

export function getWallpaperPreset(id: WallpaperPresetId): WallpaperPresetDef | undefined {
  if (id === 'custom') return undefined;
  return WALLPAPER_PRESETS.find((p) => p.id === id);
}
