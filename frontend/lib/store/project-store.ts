import { create } from "zustand";
import type { Project } from "@/lib/types/project";
import type { WorkflowNode, MediaFile } from "@/lib/types/workflow";
import * as projectsApi from "@/lib/api/projects";

interface ProjectStore {
  projects: Project[];
  currentProject: (Project & { nodes: unknown[]; media_files: unknown[] }) | null;
  isLoading: boolean;

  fetchProjects: () => Promise<void>;
  loadProject: (id: number) => Promise<void>;
  createProject: (name: string, productTitle?: string, productDescription?: string) => Promise<Project>;
  deleteProject: (id: number) => Promise<void>;
  setCurrentProject: (project: (Project & { nodes: unknown[]; media_files: unknown[] }) | null) => void;
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,

  fetchProjects: async () => {
    set({ isLoading: true });
    const projects = await projectsApi.listProjects();
    set({ projects, isLoading: false });
  },

  loadProject: async (id: number) => {
    set({ isLoading: true });
    const project = await projectsApi.getProject(id);
    set({ currentProject: project as (Project & { nodes: unknown[]; media_files: unknown[] }), isLoading: false });
  },

  createProject: async (name, productTitle, productDescription) => {
    const project = await projectsApi.createProject({
      name,
      product_title: productTitle,
      product_description: productDescription,
    });
    set({ projects: [project, ...get().projects] });
    return project;
  },

  deleteProject: async (id: number) => {
    await projectsApi.deleteProject(id);
    set({ projects: get().projects.filter((p) => p.id !== id) });
  },

  setCurrentProject: (project) => set({ currentProject: project }),
}));
