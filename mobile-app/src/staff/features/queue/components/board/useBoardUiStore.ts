import { create } from 'zustand';

/** What the board's sheets and dialogs are doing right now. Ids only — never patient data (docs/03 PHI rule). */
export type BoardFlow =
  | { kind: 'urgent'; entryId: string }
  | { kind: 'transfer'; entryId: string }
  | { kind: 'cancel'; entryId: string }
  | { kind: 'open-lane' };

interface BoardUiState {
  /** Doctor whose lane is shown; null = first open lane. */
  selectedDoctorId: string | null;
  /** Row ActionSheet target. `actionOpen` is separate so the sheet keeps its content while it animates out. */
  actionEntryId: string | null;
  actionOpen: boolean;
  flow: BoardFlow | null;
  /** Ticket sheet target (set by a row, or by the walk-in toast's "Show ticket"). */
  ticketEntryId: string | null;
  /** Entry the list should scroll to (a fresh walk-in). Consumed by the board. */
  focusEntryId: string | null;

  selectDoctor: (doctorId: string | null) => void;
  openActions: (entryId: string) => void;
  closeActions: () => void;
  startFlow: (flow: BoardFlow) => void;
  endFlow: () => void;
  showTicket: (entryId: string) => void;
  hideTicket: () => void;
  focusEntry: (entryId: string, doctorId?: string) => void;
  clearFocus: () => void;
}

export const useBoardUiStore = create<BoardUiState>()((set) => ({
  selectedDoctorId: null,
  actionEntryId: null,
  actionOpen: false,
  flow: null,
  ticketEntryId: null,
  focusEntryId: null,

  selectDoctor: (selectedDoctorId) => set({ selectedDoctorId }),
  openActions: (actionEntryId) => set({ actionEntryId, actionOpen: true }),
  closeActions: () => set({ actionOpen: false }),
  startFlow: (flow) => set({ flow }),
  endFlow: () => set({ flow: null }),
  showTicket: (ticketEntryId) => set({ ticketEntryId }),
  hideTicket: () => set({ ticketEntryId: null }),
  focusEntry: (focusEntryId, doctorId) =>
    set((s) => ({ focusEntryId, selectedDoctorId: doctorId ?? s.selectedDoctorId })),
  clearFocus: () => set({ focusEntryId: null }),
}));
