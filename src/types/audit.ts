export interface HistoryLog {
  id: string;
  operatorId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  timestamp: Date;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  diff: Record<string, { before: unknown; after: unknown }>;
}
