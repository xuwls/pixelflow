import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIStore {
  isCreateDialogOpen: boolean;
  rightPanelCollapsed: boolean;
  leftPanelCollapsed: boolean;
  debugMode: boolean;

  openCreateDialog: () => void;
  closeCreateDialog: () => void;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleDebugMode: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set) => ({
      isCreateDialogOpen: false,
      rightPanelCollapsed: false,
      leftPanelCollapsed: false,
      debugMode: false,

      openCreateDialog: () => set({ isCreateDialogOpen: true }),
      closeCreateDialog: () => set({ isCreateDialogOpen: false }),
      toggleLeftPanel: () => set((s) => ({ leftPanelCollapsed: !s.leftPanelCollapsed })),
      toggleRightPanel: () => set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
      toggleDebugMode: () => set((s) => ({ debugMode: !s.debugMode })),
    }),
    {
      name: "pixelflow-ui-storage",
      partialize: (state) => ({ debugMode: state.debugMode }),
    }
  )
);
