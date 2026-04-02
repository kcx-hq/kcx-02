import { create } from "zustand";

type UploadHistorySelectionStore = {
  selectedFileIds: number[];
  setSelectedFiles: (ids: number[]) => void;
  retainOnlyFiles: (ids: number[]) => void;
  clearSelectedFiles: () => void;
  toggleFile: (id: number) => void;
  toggleSelectAll: (ids: number[]) => void;
  isSelected: (id: number) => boolean;
};

const uniqueSorted = (ids: number[]) => [...new Set(ids)].sort((a, b) => a - b);

export const useUploadHistorySelectionStore = create<UploadHistorySelectionStore>((set, get) => ({
  selectedFileIds: [],
  setSelectedFiles: (ids) => {
    set({ selectedFileIds: uniqueSorted(ids.filter((id) => Number.isInteger(id))) });
  },
  retainOnlyFiles: (ids) => {
    const allowed = uniqueSorted(ids.filter((id) => Number.isInteger(id)));
    const current = get().selectedFileIds;
    set({ selectedFileIds: current.filter((id) => allowed.includes(id)) });
  },
  clearSelectedFiles: () => {
    set({ selectedFileIds: [] });
  },
  toggleFile: (id) => {
    if (!Number.isInteger(id)) return;
    const selected = get().selectedFileIds;
    if (selected.includes(id)) {
      set({ selectedFileIds: selected.filter((selectedId) => selectedId !== id) });
      return;
    }
    set({ selectedFileIds: uniqueSorted([...selected, id]) });
  },
  toggleSelectAll: (ids) => {
    const validIds = uniqueSorted(ids.filter((id) => Number.isInteger(id)));
    const selected = get().selectedFileIds;
    const allSelected = validIds.length > 0 && validIds.every((id) => selected.includes(id));

    if (allSelected) {
      set({
        selectedFileIds: selected.filter((id) => !validIds.includes(id)),
      });
      return;
    }

    set({ selectedFileIds: uniqueSorted([...selected, ...validIds]) });
  },
  isSelected: (id) => get().selectedFileIds.includes(id),
}));
