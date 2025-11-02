
export enum Team {
  Butchery = 'Butchery',
  Maintenance = 'Maintenance',
}

export enum Page {
  Home = 'Home',
  Butchery = 'Butchery',
  Maintenance = 'Maintenance',
  Broilers = 'Broilers',
  Admin = 'Admin',
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  team: Team;
  dueDate: string;
  time?: string;
  isCompleted: boolean;
  isRecurring: boolean;
  recurringDays?: number[];
  recurringEndDate?: string;
  imageUrl?: string;
  addedBy: 'admin' | 'user';
  notes?: string;
}

export interface StockItem {
  id: string;
  name: string;
  currentStockKg: number;
  pricePerKgUSD: number;
}

export interface StockHistory {
  id: string;
  stockItemId: string;
  stockItemName: string;
  date: string;
  type: 'sale' | 'add' | 'initial';
  amountKg: number;
  amountUSD?: number;
}

export interface Flock {
  id: string;
  name: string;
  placementDate: string;
  birdCount: number;
  dailyLogs: DailyLog[];
}

export interface DailyLog {
  id:string;
  date: string;
  feedConsumptionKg: number;
  waterConsumptionL: number;
  mortalityCount: number;
  averageWeightKg: number;
  temperatureCelsius: number;
  notes?: string;
}

export interface AppState {
  tasks: Task[];
  stockItems: StockItem[];
  stockHistory: StockHistory[];
  flocks: Flock[];
}