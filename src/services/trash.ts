// recently deleted documents: kept for a while so a slip can be undone
import type { Project } from '../types';

export interface TrashedProject { project: Project; deletedAt: string }

export const TRASH_KEY = 'asterism_trash';
export const TRASH_DAYS = 30;
const DAY = 86_400_000;

// newest first; anything older than the keep period is dropped
export function pruneTrash(items: TrashedProject[], now = Date.now()): TrashedProject[] {
  return items
    .filter(t => now - new Date(t.deletedAt).getTime() < TRASH_DAYS * DAY)
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
}

export function addToTrash(items: TrashedProject[], project: Project, now = Date.now()): TrashedProject[] {
  return pruneTrash([{ project, deletedAt: new Date(now).toISOString() }, ...items.filter(t => t.project.id !== project.id)], now);
}

export const removeFromTrash = (items: TrashedProject[], id: string) => items.filter(t => t.project.id !== id);

export function daysLeft(item: TrashedProject, now = Date.now()): number {
  return Math.max(0, Math.ceil(TRASH_DAYS - (now - new Date(item.deletedAt).getTime()) / DAY));
}

export function loadTrash(now = Date.now()): TrashedProject[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(TRASH_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return pruneTrash(parsed.filter(t => t && t.project && typeof t.project.id === 'string' && typeof t.deletedAt === 'string'), now);
  } catch {
    return [];
  }
}

// false when the browser has no room, so the caller can say the delete cannot be undone
export function saveTrash(items: TrashedProject[]): boolean {
  try {
    localStorage.setItem(TRASH_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}
