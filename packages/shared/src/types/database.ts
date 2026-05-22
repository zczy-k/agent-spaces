export interface DatabaseMeta {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface DocNode {
  id: string;
  databaseId: string;
  title: string;
  icon: string;
  cover: string;
  content: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  isTrash: boolean;
}

export const PRESET_COVERS = [
  'linear-gradient(to right, #10b981, #06b6d4)',
  'linear-gradient(to right, #ec4899, #8b5cf6)',
  'linear-gradient(to right, #f43f5e, #f97316)',
  'linear-gradient(to right, #1e293b, #0f172a)',
  'linear-gradient(to right, #3b82f6, #06b6d4)',
  'linear-gradient(to right, #f59e0b, #e11d48)',
  'linear-gradient(to right, #475569, #1e293b)',
];
