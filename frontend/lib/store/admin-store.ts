import { create } from "zustand";
import * as adminApi from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import type {
  ModelResponse,
  ProviderResponse,
} from "@/lib/types/admin";

interface AdminStore {
  providers: ProviderResponse[];
  models: ModelResponse[];
  loading: boolean;
  error: string | null;

  refresh: (opts?: { silent?: boolean }) => Promise<void>;
  setProviders: (next: ProviderResponse[]) => void;
  setModels: (next: ModelResponse[]) => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  providers: [],
  models: [],
  loading: true,
  error: null,

  refresh: async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) set({ loading: true });
    set({ error: null });
    try {
      const [providers, models] = await Promise.all([
        adminApi.listProviders(),
        adminApi.listAdminModels(),
      ]);
      set({ providers, models, loading: false });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? String(err.message)
          : "无法加载,后端服务未启动?";
      set({ error: msg, loading: false });
    }
  },

  setProviders: (next) => set({ providers: next }),
  setModels: (next) => set({ models: next }),
}));
