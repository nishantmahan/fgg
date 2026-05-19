export interface Group {
  id: string;
  name: string;
  userId: string;
  dailyReset: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Task {
  id: string;
  url: string;
  title: string;
  favicon: string;
  notes: string;
  completed: boolean;
  completedAt?: number;
  dueDate?: number;
  resetDaily: boolean;
  order: number;
  userId: string;
  groupId: string;
  createdAt: number;
  updatedAt: number;
}

export type FilterType = "all" | "active" | "completed" | "due" | "expired";
