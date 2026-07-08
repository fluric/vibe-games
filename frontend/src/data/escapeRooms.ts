/** Static configuration for all Escape rooms.
 *  Adding a new room = adding a new entry here + bumping TOTAL_ROOMS in escape.ts.
 */

export type PuzzleType = 'keypad' | 'cipher' | 'fuse' | 'symbol_grid' | 'valves' | 'image_keypad' | 'riddle';

export interface HotSpot {
  id: string;
  label: string;       // visible tooltip / aria-label
  x: string;          // CSS left % position
  y: string;          // CSS top % position
  revealedClue: string; // text shown when tapped
}

export interface KeypadRoomConfig {
  puzzleType: 'keypad';
  solution: string;           // 4-digit string
  visibleClues: { x: string; y: string; text: string; label: string }[];
  hiddenHotspot: HotSpot;
}

export interface CipherRoomConfig {
  puzzleType: 'cipher';
  ciphertext: string;         // uppercase, e.g. "GRHHW"
  shift: number;              // correct Caesar shift to reveal solution
  solution: string;           // plaintext answer, uppercase
  sceneClueText: string;      // e.g. "Count the candles on the table"
}

export interface FuseRoomConfig {
  puzzleType: 'fuse';
  // Each wire: its colour class and the label of its correct post
  wires: { id: string; color: string; colorHex: string; targetPost: string }[];
  posts: { id: string; label: string }[];
  clues?: string[];
}

export interface SymbolGridRoomConfig {
  puzzleType: 'symbol_grid';
  symbols: string[];
  solutionSequence: number[]; // Initial sequence, but the puzzle will generate longer ones dynamically
  clues: string[]; // Used for instructions now
}

export interface ValvesRoomConfig {
  puzzleType: 'valves';
  valves: { id: string; label: string }[];
  maxValue: number;
  solution: number[]; // Array of values (0-maxValue)
  clues: string[];
}
export interface ImageKeypadRoomConfig {
  puzzleType: 'image_keypad';
  solution: string; // 4-digit string
  imageUrl: string;
  clues: string[];
}

export interface RiddleRoomConfig {
  puzzleType: 'riddle';
  riddleText: string;
  solution: string; // The correct answer text
  clues: string[];
}

export interface MemoryGridRoomConfig {
  puzzleType: 'memory_grid';
  // Grid config is handled internally by the puzzle component
}

export type RoomConfig = KeypadRoomConfig | CipherRoomConfig | FuseRoomConfig | SymbolGridRoomConfig | ValvesRoomConfig | ImageKeypadRoomConfig | RiddleRoomConfig | MemoryGridRoomConfig;

export interface EscapeRoom {
  id: number;
  name: string;
  description: string;
  atmosphere: string;  // one-line flavour text shown in room-select card
  config: RoomConfig;
}

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export function useEscapeRooms(): EscapeRoom[] {
  const { t } = useTranslation('escape');

  return useMemo(() => [
    {
      id: 1,
      name: t('room1.name', { defaultValue: 'The Keypad' }),
      description: t('room1.description', { defaultValue: 'A dimly lit server room. A heavy steel door bars your exit. The PIN is hidden somewhere in the room.' }),
      atmosphere: t('room1.atmosphere', { defaultValue: 'Server humming. Dust on every surface. One red light blinks.' }),
      config: {
        puzzleType: 'keypad',
        solution: '4827',
        visibleClues: [
          { x: '12%', y: '30%', text: '4 _ _ _', label: t('room1.clue1', { defaultValue: 'Sticky note on monitor' }) },
          { x: '72%', y: '18%', text: '_ _ 2 _', label: t('room1.clue2', { defaultValue: 'Whiteboard scrawl' }) },
          { x: '55%', y: '72%', text: '_ _ _ 7', label: t('room1.clue3', { defaultValue: 'Label on server rack' }) },
        ],
        hiddenHotspot: {
          id: 'plant',
          label: t('room1.hotspotLabel', { defaultValue: 'Potted plant in the corner' }),
          x: '85%',
          y: '80%',
          revealedClue: t('room1.hotspotClue', { defaultValue: 'Under the pot: _ 8 _ _' }),
        },
      },
    },
    {
      id: 2,
      name: t('room2.name', { defaultValue: 'The Cipher Wheel' }),
      description: t('room2.description', { defaultValue: 'A dusty library. An ancient mechanical wheel sits on a pedestal.' }),
      atmosphere: t('room2.atmosphere', { defaultValue: 'Wax drips. Pages rustle. Something is encoded here.' }),
      config: {
        puzzleType: 'cipher',
        ciphertext: t('room2.ciphertext', { defaultValue: 'JEVGF' }),
        shift: Number(t('room2.shift', { defaultValue: 17 })),
        solution: t('room2.solution', { defaultValue: 'SNEPO' }),
        sceneClueText: t('room2.clueText', { defaultValue: 'A grandfather clock is frozen at 5:00 PM. A dusty mirror hangs beside it.' }),
      },
    },
    {
      id: 3,
      name: t('room3.name', { defaultValue: 'The Fuse Box' }),
      description: t('room3.description', { defaultValue: 'A utility room reeking of ozone. The circuit board on the wall is a scrambled mess of wires.' }),
      atmosphere: t('room3.atmosphere', { defaultValue: 'Sparks crackle. The lights flicker. Patch the circuit.' }),
      config: {
        puzzleType: 'fuse',
        wires: [
          { id: 'w1', color: 'Red',    colorHex: '#ef4444', targetPost: 'C' },
          { id: 'w2', color: 'Blue',   colorHex: '#3b82f6', targetPost: 'B' },
          { id: 'w3', color: 'Yellow', colorHex: '#eab308', targetPost: 'D' },
          { id: 'w4', color: 'Green',  colorHex: '#22c55e', targetPost: 'A' },
        ],
        posts: [
          { id: 'A', label: 'A · HIGH' },
          { id: 'B', label: 'B · LOW'  },
          { id: 'C', label: 'C · ALT'  },
          { id: 'D', label: 'D · GND'  },
        ],
        clues: [
          t('room3.clue1', { defaultValue: "1. The wire connected to HIGH is neither Blue nor Red." }),
          t('room3.clue2', { defaultValue: "2. The Red wire connects exactly one level above the Yellow wire." }),
          t('room3.clue3', { defaultValue: "3. The ALT post is not connected to the Green wire." }),
          t('room3.clue4', { defaultValue: "4. The Yellow wire connects to a post lower than the Blue wire's post." })
        ]
      },
    },
    {
      id: 4,
      name: t('room4.name', { defaultValue: "The Sphinx's Sanctum" }),
      description: t('room4.description', { defaultValue: 'A massive stone chamber filled with sand. A monolithic statue with human head and lion body stares at you.' }),
      atmosphere: t('room4.atmosphere', { defaultValue: 'Sand shifts beneath your feet. Two glowing eyes watch from the dark.' }),
      config: {
        puzzleType: 'riddle',
        riddleText: t('room4.riddleText', { defaultValue: 'I guard a secret,\nyet have no voice.\nTurn me left,\nand I reveal your choice.' }),
        solution: t('room4.solution', { defaultValue: 'KEY' }), // Accepts KEY
        clues: [
          t('room4.clue1', { defaultValue: 'It fits in a lock.' })
        ]
      }
    },
    {
      id: 5,
      name: t('room5.name', { defaultValue: 'The Memory Matrix' }),
      description: t('room5.description', { defaultValue: 'A stark white room with a 3x3 terminal. You must prove your memory to pass.' }),
      atmosphere: t('room5.atmosphere', { defaultValue: 'Neon lights pulse. A mechanical voice demands sequences.' }),
      config: {
        puzzleType: 'memory_grid',
      }
    }
  ], [t]);
}
