// ===== ROOM DEFINITIONS =====
// Each room is an empty shell with positions for furniture placement
// Furniture items are placed on a grid within each room

export type RoomId =
  | 'main-office'
  | 'station-command'
  | 'quantum-core'
  | 'orbital-greenhouse'
  | 'manager-office'
  | 'ceo-office'
  | 'meeting-room'
  | 'kitchen'
  | 'server-room'
  | 'lobby'
  | 'nap-room'
  | 'rooftop'
  | 'gym'
  | 'parking'

export interface Waypoint {
  id: string
  x: number  // percentage
  y: number
  connections: string[]  // ids of connected waypoints
}

export interface FurnitureItem {
  id: string
  type: string        // e.g. 'desk-dual', 'chair-aeron', 'plant-monstera'
  sprite: string      // sprite sheet + frame reference
  x: number           // percentage position within room (0-100)
  y: number
  zIndex?: number
  state?: string      // e.g. 'empty', 'occupied', 'brewing'
  interactive?: boolean
  label?: string
}

export type SpriteFacing = 'front-left' | 'front-right' | 'rear-left' | 'rear-right'

export interface RoomConnection {
  toRoom: RoomId
  position: { x: number; y: number }  // door/exit position in current room (%)
  label?: string
  exitFacing?: SpriteFacing   // agent direction when leaving through this door
  entryFacing?: SpriteFacing  // agent direction when arriving through this door
}

export interface AgentSpot {
  id: string
  type: 'desk' | 'meeting-seat' | 'lounge' | 'standing' | 'water' | 'coffee' | 'filing' | 'printer' | 'door'
  x: number
  y: number
  facing?: 'up' | 'down' | 'left' | 'right'
  spriteFacing?: SpriteFacing  // which direction the agent faces when at this spot
  zIndex?: number  // explicit z-index override (for agents behind desks)
}

export interface Room {
  id: RoomId
  name: string
  description: string
  background: {
    day: string       // path to empty room background
    night: string
  }
  width: number       // room dimensions in px (rendered)
  height: number
  furniture: FurnitureItem[]
  connections: RoomConnection[]
  agentSpots: AgentSpot[]       // where agents can sit/stand/work
  entryPoint: { x: number; y: number }  // where agents appear when entering
  walkableArea?: { x: number; y: number }[]  // polygon defining where agents can walk
  ambience?: string   // ambient sound loop
  waypoints?: Waypoint[]  // named walkable nodes for pathfinding
}

// ===== ROOM DEFINITIONS =====

export const ROOMS: Record<RoomId, Room> = {
  'main-office': {
    id: 'main-office',
    name: 'Main Office',
    description: 'Open plan workspace where agents code, debug, and ship',
    background: {
      day: '/rooms/office-day.png',
      night: '/rooms/office-night.png',
    },
    width: 800,
    height: 600,
    furniture: [
      // Desk cluster - back
      { id: 'desk-1a', type: 'desk-standing', sprite: 'desk-standing-left-rear', x: 42.4, y: 50.4 },
      { id: 'desk-1b', type: 'desk-standing', sprite: 'desk-standing-left-front', x: 46.7, y: 53 },
      { id: 'desk-1c', type: 'desk-standing', sprite: 'desk-standing-right-front', x: 39.9, y: 55.2 },
      // Desk cluster - front left
      { id: 'desk-2a', type: 'desk-standing', sprite: 'desk-standing-left-rear', x: 31.4, y: 64.8 },
      { id: 'desk-2b', type: 'desk-standing', sprite: 'desk-standing-left-front', x: 35.4, y: 67.5 },
      { id: 'desk-2c', type: 'desk-standing', sprite: 'desk-standing-right-front', x: 27.9, y: 70 },
      // Desk cluster - right
      { id: 'desk-3a', type: 'desk-standing', sprite: 'desk-standing-left-rear', x: 59, y: 73.7 },
      { id: 'desk-3b', type: 'desk-standing', sprite: 'desk-standing-left-front', x: 62.6, y: 76 },
      { id: 'desk-3c', type: 'desk-standing', sprite: 'desk-standing-right-front', x: 55.4, y: 78.7 },
      { id: 'desk-3d', type: 'desk-standing', sprite: 'desk-standing-right-rear', x: 66.6, y: 71.1 },
      // Coffee machine on counter
      { id: 'coffee', type: 'coffee-machine', sprite: 'coffee-off', x: 78.5, y: 50.2, interactive: true, state: 'off', label: 'Coffee Machine' },
      // Filing cabinet
      { id: 'filing-1', type: 'filing-cabinet', sprite: 'filing-closed', x: 45, y: 56.5, state: 'closed', label: 'Filing Cabinet' },
      // Plants
      { id: 'plant-2', type: 'plant-snake', sprite: 'plant-snake', x: 43.2, y: 37.9 },
      { id: 'plant-3', type: 'plant-money', sprite: 'plant-money', x: 32, y: 71.2 },
      { id: 'plant-5', type: 'plant-monstera', sprite: 'plant-monstera', x: 60.2, y: 80.4 },
      // Printer (swaps between working/broken on printer jam event)
      { id: 'printer-1', type: 'printer', sprite: 'printer-working', x: 85.4, y: 56.8, state: 'working', label: 'Printer' },
      // Background hotspots — baked into the room image, no sprite, just clickable zones
      { id: 'fire-extinguisher', type: 'hotspot', sprite: 'hotspot', x: 8, y: 60, interactive: true, label: 'Fire Extinguisher' },
      { id: 'water-cooler', type: 'hotspot', sprite: 'hotspot', x: 53, y: 45, interactive: true, label: 'Water Cooler' },
      { id: 'bell', type: 'hotspot', sprite: 'hotspot', x: 63, y: 39, interactive: true, label: 'Bell' },
      { id: 'kanban-board', type: 'hotspot', sprite: 'hotspot', x: 80, y: 42, interactive: true, label: 'Kanban Board' },
      { id: 'ship-it-poster', type: 'hotspot', sprite: 'hotspot', x: 8, y: 45, interactive: true, label: 'Ship It Poster' },
      { id: 'tv-monitor', type: 'hotspot', sprite: 'hotspot', x: 90, y: 42, interactive: true, label: 'Dashboard' },
    ],
    connections: [
      { toRoom: 'station-command', position: { x: 67.5, y: 48.9 }, label: 'Enter Command Deck', exitFacing: 'rear-right', entryFacing: 'front-right' },
      { toRoom: 'manager-office', position: { x: 67.5, y: 48.9 }, label: "Manager's Office", exitFacing: 'rear-right', entryFacing: 'front-right' },
    ],
    agentSpots: [
      // Desk spots are placed on nearby floor tiles, not on the tabletop sprites.
      // This keeps agents readable without making them look like they are standing on desks.
      // Front-left cluster: desks at y ~65-70
      { id: 'spot-1', type: 'desk', x: 24.4, y: 73.4, facing: 'down', spriteFacing: 'rear-left', zIndex: 88 },
      { id: 'spot-2', type: 'desk', x: 38.8, y: 72, facing: 'down', spriteFacing: 'rear-right', zIndex: 88 },
      { id: 'spot-3', type: 'desk', x: 24.8, y: 62.3, facing: 'down', spriteFacing: 'front-left', zIndex: 74 },
      // Back cluster: desks at y ~50-55
      { id: 'spot-4', type: 'desk', x: 36.7, y: 58.4, facing: 'down', spriteFacing: 'rear-left', zIndex: 74 },
      { id: 'spot-5', type: 'desk', x: 50.4, y: 56.2, facing: 'down', spriteFacing: 'rear-right', zIndex: 76 },
      { id: 'spot-6', type: 'desk', x: 36, y: 48.3, facing: 'down', spriteFacing: 'front-left', zIndex: 62 },
      // Right cluster: desks at y ~72-79
      { id: 'spot-7', type: 'desk', x: 51.1, y: 82, facing: 'down', spriteFacing: 'rear-left', zIndex: 96 },
      { id: 'spot-8', type: 'desk', x: 68.8, y: 78.5, facing: 'down', spriteFacing: 'rear-right', zIndex: 96 },
      { id: 'spot-9', type: 'desk', x: 53, y: 69.8, facing: 'down', spriteFacing: 'front-left', zIndex: 82 },
      { id: 'spot-10', type: 'desk', x: 71.5, y: 69.5, facing: 'down', spriteFacing: 'front-right', zIndex: 84 },
      // Activity spots
      { id: 'spot-coffee-1', type: 'coffee', x: 73.5, y: 56.7, facing: 'down', spriteFacing: 'rear-left' },
      { id: 'spot-coffee-2', type: 'coffee', x: 76.2, y: 58.4, facing: 'down', spriteFacing: 'front-right' },
      { id: 'spot-water-1', type: 'water', x: 53.3, y: 46.6, facing: 'down', spriteFacing: 'rear-left' },
      { id: 'spot-water-2', type: 'water', x: 56, y: 47.7, facing: 'down', spriteFacing: 'front-right' },
      { id: 'spot-filing', type: 'filing', x: 47.8, y: 57.6, facing: 'down', spriteFacing: 'front-right', zIndex: 70 },
      { id: 'spot-printer', type: 'printer', x: 81, y: 63, facing: 'down', spriteFacing: 'rear-left' },
      { id: 'spot-door-2', type: 'door', x: 64, y: 46.6, facing: 'down', spriteFacing: 'rear-right' },
      { id: 'spot-door-3', type: 'door', x: 69.9, y: 50.8, facing: 'down', spriteFacing: 'front-right' },
    ],
    entryPoint: { x: 67.5, y: 48.9 },
    walkableArea: [
      { x: 28.2, y: 46 },
      { x: 33, y: 50.2 },
      { x: 20.6, y: 60.9 },
      { x: 21.8, y: 65.5 },
      { x: 32, y: 71.4 },
      { x: 41.6, y: 62.7 },
      { x: 40.8, y: 58.1 },
      { x: 45.5, y: 56.3 },
      { x: 49.3, y: 54.5 },
      { x: 51.3, y: 52.2 },
      { x: 51.9, y: 49.3 },
      { x: 51.5, y: 46.7 },
      { x: 57.9, y: 47.3 },
      { x: 64.2, y: 47.4 },
      { x: 70, y: 49.9 },
      { x: 71.2, y: 55.4 },
      { x: 78.8, y: 60.7 },
      { x: 86.7, y: 65.6 },
      { x: 82.6, y: 72.8 },
      { x: 71.5, y: 68.4 },
      { x: 59.5, y: 57.1 },
      { x: 54.7, y: 61.9 },
      { x: 51.4, y: 65.9 },
      { x: 49.8, y: 70.1 },
      { x: 50, y: 75.3 },
      { x: 54.3, y: 78.2 },
      { x: 58.1, y: 80 },
      { x: 62.5, y: 78.9 },
      { x: 64.9, y: 76 },
      { x: 68.4, y: 73.3 },
      { x: 70.4, y: 71.1 },
      { x: 71.7, y: 69.3 },
      { x: 82.7, y: 73.4 },
      { x: 54.3, y: 93.6 },
      { x: 37.6, y: 84 },
      { x: 23.5, y: 75.6 },
      { x: 12.6, y: 68.8 },
      { x: 3.9, y: 62.9 },
      { x: 33.7, y: 42.4 },
      { x: 35.5, y: 48.6 },
      { x: 33, y: 50.2 },
      { x: 28.7, y: 46.3 },
    ],
    waypoints: [
      // User-mapped routes from /?helper — spots + aisle junctions
      { id: 'W-door',      x: 67.5, y: 48.9, connections: ['W-door-2', 'W-door-3'] },
      { id: 'W-door-2',    x: 64,   y: 46.6, connections: ['W-door', 'W-water-1', 'W-new-6'] },
      { id: 'W-door-3',    x: 69.9, y: 50.8, connections: ['W-door', 'W-coffee-1', 'W-spot-10', 'W-new-7'] },
      { id: 'W-water-1',   x: 53.3, y: 46.6, connections: ['W-door-2', 'W-water-2', 'W-spot-5'] },
      { id: 'W-water-2',   x: 56,   y: 47.7, connections: ['W-water-1', 'W-door-2', 'W-new-10'] },
      { id: 'W-spot-6',    x: 36,   y: 48.3, connections: ['W-spot-4', 'W-water-1'] },
      { id: 'W-spot-4',    x: 36.7, y: 58.4, connections: ['W-spot-6', 'W-spot-5', 'W-spot-3', 'W-filing', 'W-new-19'] },
      { id: 'W-spot-5',    x: 50.4, y: 56.2, connections: ['W-spot-4', 'W-water-1', 'W-filing', 'W-spot-9'] },
      { id: 'W-filing',    x: 47.8, y: 57.6, connections: ['W-spot-4', 'W-spot-5', 'W-spot-9', 'W-new-4'] },
      { id: 'W-spot-3',    x: 24.8, y: 62.3, connections: ['W-spot-4', 'W-spot-1'] },
      { id: 'W-spot-1',    x: 24.4, y: 73.4, connections: ['W-spot-3', 'W-spot-2', 'W-new-12'] },
      { id: 'W-spot-2',    x: 38.8, y: 72,   connections: ['W-spot-1', 'W-spot-4', 'W-spot-7', 'W-new-2'] },
      { id: 'W-spot-9',    x: 53,   y: 69.8, connections: ['W-filing', 'W-spot-5', 'W-spot-7', 'W-spot-10'] },
      { id: 'W-spot-10',   x: 71.5, y: 69.5, connections: ['W-spot-9', 'W-spot-8', 'W-door-3', 'W-coffee-1'] },
      { id: 'W-spot-7',    x: 51.1, y: 82,   connections: ['W-spot-9', 'W-spot-2', 'W-spot-8'] },
      { id: 'W-spot-8',    x: 68.8, y: 78.5, connections: ['W-spot-7', 'W-spot-10', 'W-new-22'] },
      { id: 'W-coffee-1',  x: 73.5, y: 56.7, connections: ['W-door-3', 'W-coffee-2', 'W-spot-10'] },
      { id: 'W-coffee-2',  x: 76.2, y: 58.4, connections: ['W-coffee-1', 'W-printer'] },
      { id: 'W-printer',   x: 81,   y: 63,   connections: ['W-coffee-2', 'W-new-23'] },
      // Aisle junctions
      { id: 'W-new-1',     x: 44.8, y: 63.1, connections: ['W-new-3'] },
      { id: 'W-new-2',     x: 57.5, y: 51.6, connections: ['W-spot-2', 'W-new-5'] },
      { id: 'W-new-3',     x: 37.5, y: 67.6, connections: ['W-new-1'] },
      { id: 'W-new-4',     x: 44.3, y: 63.3, connections: ['W-filing', 'W-new-14'] },
      { id: 'W-new-5',     x: 47.4, y: 58.3, connections: ['W-new-2'] },
      { id: 'W-new-6',     x: 57,   y: 52.2, connections: ['W-door-2', 'W-new-8'] },
      { id: 'W-new-7',     x: 63.9, y: 46.8, connections: ['W-door-3'] },
      { id: 'W-new-8',     x: 68.5, y: 49.9, connections: ['W-new-6'] },
      { id: 'W-new-10',    x: 55.6, y: 49.2, connections: ['W-water-2'] },
      { id: 'W-new-12',    x: 36.3, y: 76.8, connections: ['W-spot-1', 'W-new-13'] },
      { id: 'W-new-13',    x: 25.8, y: 72.2, connections: ['W-new-12', 'W-new-16'] },
      { id: 'W-new-14',    x: 36.9, y: 76.7, connections: ['W-new-4'] },
      { id: 'W-new-16',    x: 18.5, y: 59.5, connections: ['W-new-13', 'W-new-18'] },
      { id: 'W-new-18',    x: 29.9, y: 47.1, connections: ['W-new-16', 'W-new-20'] },
      { id: 'W-new-19',    x: 18.3, y: 57.7, connections: ['W-spot-4'] },
      { id: 'W-new-20',    x: 38.8, y: 54.2, connections: ['W-new-18'] },
      { id: 'W-new-22',    x: 76.3, y: 70.5, connections: ['W-spot-8', 'W-new-24'] },
      { id: 'W-new-23',    x: 66.8, y: 75.6, connections: ['W-printer'] },
      { id: 'W-new-24',    x: 81.3, y: 62.5, connections: ['W-new-22'] },
    ],
  },

  'station-command': {
    id: 'station-command',
    name: 'Station Command Deck',
    description: 'Two-level orbital command deck for space-themed agents',
    background: {
      day: '/rooms/station-command-day.png',
      night: '/rooms/station-command-night.png',
    },
    width: 800,
    height: 600,
    furniture: [],
    connections: [
      { toRoom: 'main-office', position: { x: 68.6, y: 19.2 }, label: 'Return to Office', exitFacing: 'front-right', entryFacing: 'front-right' },
      { toRoom: 'quantum-core', position: { x: 20.7, y: 35.2 }, label: 'Enter Quantum Core Lab', exitFacing: 'rear-left', entryFacing: 'front-right' },
      { toRoom: 'orbital-greenhouse', position: { x: 28.0, y: 78.4 }, label: 'Enter Greenhouse Bay', exitFacing: 'front-left', entryFacing: 'front-right' },
    ],
    agentSpots: [
      { id: 'station-ops', type: 'desk', x: 54.9, y: 55.5, facing: 'down', spriteFacing: 'front-left', zIndex: 62 },
      { id: 'station-systems', type: 'desk', x: 50.5, y: 26.5, facing: 'down', spriteFacing: 'front-left', zIndex: 36 },
      { id: 'station-strategy', type: 'desk', x: 36.8, y: 64.3, facing: 'down', spriteFacing: 'rear-right', zIndex: 72 },
      { id: 'station-research', type: 'desk', x: 68.1, y: 62.6, facing: 'down', spriteFacing: 'front-right', zIndex: 70 },
      { id: 'station-field', type: 'desk', x: 56.3, y: 68.5, facing: 'down', spriteFacing: 'rear-left', zIndex: 76 },
      { id: 'station-upper-left', type: 'standing', x: 19.6, y: 33.9, facing: 'down', spriteFacing: 'front-left', zIndex: 44 },
      { id: 'station-upper-right', type: 'standing', x: 66.5, y: 22.3, facing: 'down', spriteFacing: 'front-right', zIndex: 34 },
      { id: 'station-lab-airlock', type: 'door', x: 20.7, y: 35.2, facing: 'down', spriteFacing: 'rear-left', zIndex: 44 },
      { id: 'station-left-landing', type: 'standing', x: 39.5, y: 42.9, facing: 'down', spriteFacing: 'front-left', zIndex: 52 },
      { id: 'station-right-landing', type: 'standing', x: 73.1, y: 42.6, facing: 'down', spriteFacing: 'front-right', zIndex: 52 },
      { id: 'station-exit', type: 'door', x: 68.6, y: 19.2, facing: 'down', spriteFacing: 'front-right', zIndex: 32 },
      { id: 'station-greenhouse-airlock', type: 'door', x: 28.0, y: 78.4, facing: 'down', spriteFacing: 'front-left', zIndex: 88 },
    ],
    entryPoint: { x: 68.6, y: 19.2 },
    walkableArea: [
      { x: 18.0, y: 31.7 },
      { x: 52.3, y: 13.4 },
      { x: 75.2, y: 20.3 },
      { x: 79.7, y: 43.1 },
      { x: 69.4, y: 63.7 },
      { x: 66.0, y: 77.5 },
      { x: 44.3, y: 84.3 },
      { x: 29.4, y: 71.7 },
      { x: 15.7, y: 43.1 },
    ],
    waypoints: [
      { id: 'SC-exit', x: 68.6, y: 19.2, connections: ['SC-upper-right', 'SC-upper-mid'] },
      { id: 'SC-upper-right', x: 66.5, y: 22.3, connections: ['SC-exit', 'SC-upper-mid', 'SC-right-stair-top'] },
      { id: 'SC-upper-mid', x: 51.5, y: 25.3, connections: ['SC-exit', 'SC-upper-right', 'SC-upper-left', 'SC-left-stair-top'] },
      { id: 'SC-upper-left', x: 19.6, y: 33.9, connections: ['SC-upper-mid', 'SC-left-stair-top', 'SC-lab-airlock'] },
      { id: 'SC-lab-airlock', x: 20.7, y: 35.2, connections: ['SC-upper-left'] },
      { id: 'SC-left-stair-top', x: 39.5, y: 42.9, connections: ['SC-upper-mid', 'SC-upper-left', 'SC-left-stair-bottom'] },
      { id: 'SC-left-stair-bottom', x: 44.9, y: 51.6, connections: ['SC-left-stair-top', 'SC-core', 'SC-lower-left'] },
      { id: 'SC-core', x: 54.9, y: 52.1, connections: ['SC-left-stair-bottom', 'SC-right-stair-bottom', 'SC-lower-center', 'SC-lower-right'] },
      { id: 'SC-right-stair-top', x: 73.1, y: 42.6, connections: ['SC-upper-right', 'SC-right-stair-bottom'] },
      { id: 'SC-right-stair-bottom', x: 72.9, y: 52.7, connections: ['SC-right-stair-top', 'SC-core', 'SC-lower-right'] },
      { id: 'SC-lower-right', x: 68.6, y: 58.5, connections: ['SC-core', 'SC-right-stair-bottom', 'SC-front-right'] },
      { id: 'SC-lower-center', x: 54.6, y: 65.4, connections: ['SC-core', 'SC-front-right', 'SC-front-left'] },
      { id: 'SC-front-right', x: 61.1, y: 74.0, connections: ['SC-lower-center', 'SC-lower-right', 'SC-front-left'] },
      { id: 'SC-front-left', x: 44.7, y: 74.9, connections: ['SC-lower-center', 'SC-front-right', 'SC-lower-left', 'SC-greenhouse-airlock'] },
      { id: 'SC-lower-left', x: 32.3, y: 65.6, connections: ['SC-front-left', 'SC-left-stair-bottom'] },
      { id: 'SC-greenhouse-airlock', x: 28.0, y: 78.4, connections: ['SC-front-left'] },
    ],
  },

  'quantum-core': {
    id: 'quantum-core',
    name: 'Quantum Core Lab',
    description: 'Clean orbital laboratory for monitoring the station reactor core',
    background: {
      day: '/rooms/quantum-core-day.png',
      night: '/rooms/quantum-core-night.png',
    },
    width: 800,
    height: 600,
    furniture: [],
    connections: [
      { toRoom: 'station-command', position: { x: 50.0, y: 85.0 }, label: 'Return to Command Deck', exitFacing: 'front-right', entryFacing: 'front-left' },
    ],
    agentSpots: [
      { id: 'quantum-entry', type: 'door', x: 50.0, y: 85.0, facing: 'down', spriteFacing: 'front-right', zIndex: 92 },
      { id: 'quantum-front-left', type: 'desk', x: 41.8, y: 78.4, facing: 'up', spriteFacing: 'rear-left', zIndex: 86 },
      { id: 'quantum-front-right', type: 'desk', x: 58.2, y: 78.4, facing: 'up', spriteFacing: 'rear-right', zIndex: 86 },
      { id: 'quantum-left-console', type: 'desk', x: 30.4, y: 67.6, facing: 'up', spriteFacing: 'front-left', zIndex: 76 },
      { id: 'quantum-right-console', type: 'desk', x: 69.6, y: 67.6, facing: 'up', spriteFacing: 'front-right', zIndex: 76 },
      { id: 'quantum-reactor-left', type: 'standing', x: 42.2, y: 59.2, facing: 'up', spriteFacing: 'front-left', zIndex: 68 },
      { id: 'quantum-reactor-right', type: 'standing', x: 57.8, y: 59.2, facing: 'up', spriteFacing: 'front-right', zIndex: 68 },
      { id: 'quantum-upper-left', type: 'desk', x: 31.0, y: 48.6, facing: 'down', spriteFacing: 'front-left', zIndex: 58 },
      { id: 'quantum-upper-right', type: 'desk', x: 69.0, y: 48.6, facing: 'down', spriteFacing: 'front-right', zIndex: 58 },
      { id: 'quantum-back-left', type: 'standing', x: 39.6, y: 34.4, facing: 'down', spriteFacing: 'front-left', zIndex: 44 },
      { id: 'quantum-back-right', type: 'standing', x: 60.4, y: 34.4, facing: 'down', spriteFacing: 'front-right', zIndex: 44 },
    ],
    entryPoint: { x: 50.0, y: 85.0 },
    walkableArea: [
      { x: 23.0, y: 48.0 },
      { x: 34.0, y: 31.0 },
      { x: 50.0, y: 23.0 },
      { x: 66.0, y: 31.0 },
      { x: 77.0, y: 48.0 },
      { x: 76.0, y: 68.0 },
      { x: 63.0, y: 82.0 },
      { x: 50.0, y: 88.0 },
      { x: 37.0, y: 82.0 },
      { x: 24.0, y: 68.0 },
    ],
    waypoints: [
      { id: 'QC-entry', x: 50.0, y: 85.0, connections: ['QC-front-left', 'QC-front-right'] },
      { id: 'QC-front-left', x: 41.8, y: 78.4, connections: ['QC-entry', 'QC-left-console', 'QC-reactor-left'] },
      { id: 'QC-front-right', x: 58.2, y: 78.4, connections: ['QC-entry', 'QC-right-console', 'QC-reactor-right'] },
      { id: 'QC-left-console', x: 30.4, y: 67.6, connections: ['QC-front-left', 'QC-upper-left'] },
      { id: 'QC-right-console', x: 69.6, y: 67.6, connections: ['QC-front-right', 'QC-upper-right'] },
      { id: 'QC-reactor-left', x: 42.2, y: 59.2, connections: ['QC-front-left', 'QC-reactor-right', 'QC-upper-left'] },
      { id: 'QC-reactor-right', x: 57.8, y: 59.2, connections: ['QC-front-right', 'QC-reactor-left', 'QC-upper-right'] },
      { id: 'QC-upper-left', x: 31.0, y: 48.6, connections: ['QC-left-console', 'QC-reactor-left', 'QC-back-left'] },
      { id: 'QC-upper-right', x: 69.0, y: 48.6, connections: ['QC-right-console', 'QC-reactor-right', 'QC-back-right'] },
      { id: 'QC-back-left', x: 39.6, y: 34.4, connections: ['QC-upper-left', 'QC-back-right'] },
      { id: 'QC-back-right', x: 60.4, y: 34.4, connections: ['QC-upper-right', 'QC-back-left'] },
    ],
  },

  'orbital-greenhouse': {
    id: 'orbital-greenhouse',
    name: 'Orbital Greenhouse Bay',
    description: 'Hydroponic life-support bay with glowing botanical grow pods',
    background: {
      day: '/rooms/orbital-greenhouse-day.png',
      night: '/rooms/orbital-greenhouse-night.png',
    },
    width: 800,
    height: 600,
    furniture: [],
    connections: [
      { toRoom: 'station-command', position: { x: 82.0, y: 34.8 }, label: 'Return to Command Deck', exitFacing: 'front-right', entryFacing: 'front-left' },
    ],
    agentSpots: [
      { id: 'greenhouse-entry', type: 'door', x: 80.0, y: 43.0, facing: 'down', spriteFacing: 'front-right', zIndex: 54 },
      { id: 'greenhouse-bio-left', type: 'standing', x: 43.8, y: 59.0, facing: 'up', spriteFacing: 'front-left', zIndex: 68 },
      { id: 'greenhouse-bio-right', type: 'standing', x: 58.5, y: 59.8, facing: 'up', spriteFacing: 'front-right', zIndex: 70 },
      { id: 'greenhouse-left-row', type: 'standing', x: 18.8, y: 55.8, facing: 'up', spriteFacing: 'front-left', zIndex: 66 },
      { id: 'greenhouse-left-lower-row', type: 'standing', x: 36.8, y: 62.8, facing: 'up', spriteFacing: 'front-left', zIndex: 74 },
      { id: 'greenhouse-right-row', type: 'standing', x: 77.2, y: 51.5, facing: 'up', spriteFacing: 'front-right', zIndex: 62 },
      { id: 'greenhouse-right-lower-row', type: 'standing', x: 55.0, y: 70.5, facing: 'up', spriteFacing: 'front-right', zIndex: 80 },
      { id: 'greenhouse-wall-left', type: 'desk', x: 25.8, y: 36.6, facing: 'down', spriteFacing: 'front-left', zIndex: 46 },
      { id: 'greenhouse-wall-right', type: 'desk', x: 73.8, y: 37.0, facing: 'down', spriteFacing: 'front-right', zIndex: 46 },
      { id: 'greenhouse-front-console', type: 'desk', x: 38.5, y: 75.0, facing: 'up', spriteFacing: 'rear-left', zIndex: 84 },
      { id: 'greenhouse-left-console', type: 'desk', x: 39.0, y: 48.0, facing: 'up', spriteFacing: 'front-left', zIndex: 58 },
      { id: 'greenhouse-right-console', type: 'desk', x: 62.0, y: 48.6, facing: 'up', spriteFacing: 'front-right', zIndex: 58 },
    ],
    entryPoint: { x: 80.0, y: 43.0 },
    walkableArea: [
      { x: 12.0, y: 43.0 },
      { x: 27.0, y: 26.0 },
      { x: 50.0, y: 18.0 },
      { x: 82.0, y: 32.0 },
      { x: 88.0, y: 58.0 },
      { x: 71.0, y: 78.0 },
      { x: 49.0, y: 84.0 },
      { x: 25.0, y: 74.0 },
      { x: 9.0, y: 58.0 },
    ],
    waypoints: [
      { id: 'GH-entry', x: 80.0, y: 43.0, connections: ['GH-right-wall', 'GH-right-row'] },
      { id: 'GH-right-wall', x: 73.8, y: 37.0, connections: ['GH-entry', 'GH-back-mid', 'GH-right-console'] },
      { id: 'GH-left-wall', x: 25.8, y: 36.6, connections: ['GH-back-mid', 'GH-left-console', 'GH-left-row'] },
      { id: 'GH-back-mid', x: 49.0, y: 31.8, connections: ['GH-left-wall', 'GH-right-wall', 'GH-left-console', 'GH-right-console'] },
      { id: 'GH-left-console', x: 39.0, y: 48.0, connections: ['GH-left-wall', 'GH-back-mid', 'GH-bio-left', 'GH-left-row'] },
      { id: 'GH-right-console', x: 62.0, y: 48.6, connections: ['GH-right-wall', 'GH-back-mid', 'GH-bio-right', 'GH-right-row'] },
      { id: 'GH-bio-left', x: 43.8, y: 59.0, connections: ['GH-left-console', 'GH-bio-right', 'GH-front-console', 'GH-left-lower-row'] },
      { id: 'GH-bio-right', x: 58.5, y: 59.8, connections: ['GH-right-console', 'GH-bio-left', 'GH-front-console', 'GH-right-lower-row'] },
      { id: 'GH-left-row', x: 18.8, y: 55.8, connections: ['GH-left-wall', 'GH-left-console', 'GH-left-lower-row'] },
      { id: 'GH-right-row', x: 77.2, y: 51.5, connections: ['GH-entry', 'GH-right-console', 'GH-right-lower-row'] },
      { id: 'GH-left-lower-row', x: 36.8, y: 62.8, connections: ['GH-left-row', 'GH-bio-left', 'GH-front-console'] },
      { id: 'GH-right-lower-row', x: 55.0, y: 70.5, connections: ['GH-right-row', 'GH-bio-right', 'GH-front-console'] },
      { id: 'GH-front-console', x: 38.5, y: 75.0, connections: ['GH-bio-left', 'GH-bio-right', 'GH-left-lower-row', 'GH-right-lower-row'] },
    ],
  },

  'manager-office': {
    id: 'manager-office',
    name: "Manager's Office",
    description: 'Where the manager briefs agents and reviews work. Connected to the main Codex terminal.',
    background: {
      day: '/rooms/ceo-office.png',
      night: '/rooms/ceo-office.png',
    },
    width: 600,
    height: 450,
    furniture: [],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 95 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'mgr-spot', type: 'desk', x: 50, y: 40, facing: 'down' },
      { id: 'visitor-1', type: 'standing', x: 35, y: 65, facing: 'up' },
      { id: 'visitor-2', type: 'standing', x: 65, y: 65, facing: 'up' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'ceo-office': {
    id: 'ceo-office',
    name: 'CEO Office',
    description: 'Corner office with city views. Bloomberg terminal and whiskey shelf.',
    background: {
      day: '/rooms/ceo-office.png',
      night: '/rooms/ceo-office.png',
    },
    width: 600,
    height: 450,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 95 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'ceo-spot', type: 'desk', x: 50, y: 45, facing: 'down' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'meeting-room': {
    id: 'meeting-room',
    name: 'Meeting Room',
    description: 'Glass-walled room for standups, planning, and heated architecture debates.',
    background: {
      day: '/rooms/meeting-room.png',
      night: '/rooms/meeting-room.png',
    },
    width: 600,
    height: 450,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 95, y: 50 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'seat-1', type: 'meeting-seat', x: 30, y: 40, facing: 'right' },
      { id: 'seat-2', type: 'meeting-seat', x: 30, y: 55, facing: 'right' },
      { id: 'seat-3', type: 'meeting-seat', x: 70, y: 40, facing: 'left' },
      { id: 'seat-4', type: 'meeting-seat', x: 70, y: 55, facing: 'left' },
      { id: 'presenter', type: 'standing', x: 50, y: 25, facing: 'down' },
    ],
    entryPoint: { x: 90, y: 50 },
  },

  'kitchen': {
    id: 'kitchen',
    name: 'Kitchen',
    description: 'Espresso machine, kombucha on tap, and a fridge full of La Croix.',
    background: {
      day: '/rooms/kitchen-cafeteria.png',
      night: '/rooms/kitchen-cafeteria.png',
    },
    width: 600,
    height: 450,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 5, y: 50 }, label: 'Main Office' },
      { toRoom: 'rooftop', position: { x: 50, y: 5 }, label: 'Rooftop' },
    ],
    agentSpots: [
      { id: 'coffee-spot', type: 'standing', x: 30, y: 35, facing: 'up' },
      { id: 'lunch-1', type: 'meeting-seat', x: 35, y: 65, facing: 'right' },
      { id: 'lunch-2', type: 'meeting-seat', x: 65, y: 65, facing: 'left' },
      { id: 'snack-spot', type: 'standing', x: 15, y: 35, facing: 'up' },
    ],
    entryPoint: { x: 10, y: 50 },
  },

  'server-room': {
    id: 'server-room',
    name: 'Server Room',
    description: 'Cold. Loud. Blinking lights. Where deployments happen.',
    background: {
      day: '/rooms/server-room.png',
      night: '/rooms/server-room.png',
    },
    width: 500,
    height: 400,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 95 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'server-spot-1', type: 'standing', x: 35, y: 60, facing: 'up' },
      { id: 'server-spot-2', type: 'standing', x: 65, y: 60, facing: 'up' },
    ],
    entryPoint: { x: 50, y: 90 },
    ambience: 'server-hum',
  },

  'lobby': {
    id: 'lobby',
    name: 'Lobby',
    description: 'Where new hires arrive. Swag wall. Pile of Amazon packages.',
    background: {
      day: '/rooms/lobby-reception.png',
      night: '/rooms/lobby-reception.png',
    },
    width: 600,
    height: 450,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 5 }, label: 'Main Office' },
      { toRoom: 'parking', position: { x: 50, y: 95 }, label: 'Parking' },
    ],
    agentSpots: [
      { id: 'reception-spot', type: 'desk', x: 50, y: 40, facing: 'down' },
      { id: 'waiting-1', type: 'lounge', x: 25, y: 70, facing: 'right' },
      { id: 'waiting-2', type: 'lounge', x: 35, y: 70, facing: 'right' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'nap-room': {
    id: 'nap-room',
    name: 'Wellness Room',
    description: 'Sleep pods, meditation cushions, and a Himalayan salt lamp.',
    background: {
      day: '/rooms/nap-wellness-room.png',
      night: '/rooms/nap-wellness-room.png',
    },
    width: 500,
    height: 400,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 95 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'nap-1', type: 'lounge', x: 25, y: 40, facing: 'down' },
      { id: 'nap-2', type: 'lounge', x: 50, y: 40, facing: 'down' },
      { id: 'nap-3', type: 'lounge', x: 75, y: 40, facing: 'down' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'rooftop': {
    id: 'rooftop',
    name: 'Rooftop Terrace',
    description: 'Friday drinks, BBQ, and pretending to have work-life balance.',
    background: {
      day: '/rooms/rooftop-terrace.png',
      night: '/rooms/rooftop-terrace.png',
    },
    width: 700,
    height: 500,
    furniture: [
    ],
    connections: [
      { toRoom: 'kitchen', position: { x: 50, y: 95 }, label: 'Kitchen' },
    ],
    agentSpots: [
      { id: 'roof-1', type: 'lounge', x: 25, y: 50, facing: 'down' },
      { id: 'roof-2', type: 'lounge', x: 65, y: 50, facing: 'down' },
      { id: 'roof-3', type: 'lounge', x: 40, y: 75, facing: 'right' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'gym': {
    id: 'gym',
    name: 'Gym',
    description: 'A Peloton, some dumbbells, and a mirror for flexing your PRs.',
    background: {
      day: '/rooms/gym-fitness-room.png',
      night: '/rooms/gym-fitness-room.png',
    },
    width: 500,
    height: 400,
    furniture: [
    ],
    connections: [
      { toRoom: 'main-office', position: { x: 50, y: 95 }, label: 'Main Office' },
    ],
    agentSpots: [
      { id: 'gym-1', type: 'standing', x: 25, y: 45, facing: 'down' },
      { id: 'gym-2', type: 'standing', x: 75, y: 45, facing: 'down' },
    ],
    entryPoint: { x: 50, y: 90 },
  },

  'parking': {
    id: 'parking',
    name: 'Parking Garage',
    description: 'Teslas, e-scooters, and reserved spots nobody respects.',
    background: {
      day: '/rooms/parking-garage.png',
      night: '/rooms/parking-garage.png',
    },
    width: 700,
    height: 500,
    furniture: [
    ],
    connections: [
      { toRoom: 'lobby', position: { x: 50, y: 5 }, label: 'Lobby' },
    ],
    agentSpots: [],
    entryPoint: { x: 50, y: 10 },
  },
}

// ===== ROOM NAVIGATION =====
// Find path between rooms using BFS
export function findRoomPath(from: RoomId, to: RoomId): RoomId[] {
  if (from === to) return [from]

  const visited = new Set<RoomId>()
  const queue: { room: RoomId; path: RoomId[] }[] = [{ room: from, path: [from] }]
  visited.add(from)

  while (queue.length > 0) {
    const { room, path } = queue.shift()!
    const connections = ROOMS[room].connections

    for (const conn of connections) {
      if (conn.toRoom === to) return [...path, to]
      if (!visited.has(conn.toRoom)) {
        visited.add(conn.toRoom)
        queue.push({ room: conn.toRoom, path: [...path, conn.toRoom] })
      }
    }
  }

  return [from] // no path found, stay put
}

// Get all rooms connected to a given room
export function getConnectedRooms(roomId: RoomId): RoomId[] {
  return ROOMS[roomId].connections.map(c => c.toRoom)
}

// Get a free agent spot in a room
export function getFreeSpot(
  roomId: RoomId,
  occupiedSpotIds: Set<string>,
  type?: AgentSpot['type'],
): AgentSpot | null {
  const room = ROOMS[roomId]
  const spots = type
    ? room.agentSpots.filter(s => s.type === type)
    : room.agentSpots

  for (const spot of spots) {
    if (!occupiedSpotIds.has(spot.id)) return spot
  }
  return null
}
