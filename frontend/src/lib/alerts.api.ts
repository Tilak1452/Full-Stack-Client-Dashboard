import { apiFetch } from './api-client';

export type AlertCondition =
  | 'price_above'
  | 'price_below'
  | 'rsi_above'
  | 'rsi_below'
  | 'sma_cross_above'
  | 'sma_cross_below';

export type AlertStatus = 'active' | 'triggered' | 'expired';

export interface AlertItem {
  id: number;
  symbol: string;
  condition: AlertCondition;
  threshold: number;
  status: AlertStatus;
  message: string | null;
  created_at: string;
  triggered_at: string | null;
}

export interface CreateAlertPayload {
  symbol: string;
  condition: AlertCondition;
  threshold: number;
}

export const alertsApi = {
  getActive: (): Promise<AlertItem[]> =>
    apiFetch<AlertItem[]>('/api/v1/alerts/active'),

  getNotifications: (): Promise<AlertItem[]> =>
    apiFetch<AlertItem[]>('/api/v1/alerts/notifications'),

  create: (payload: CreateAlertPayload): Promise<AlertItem> =>
    apiFetch<AlertItem>('/api/v1/alerts/', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  delete: (id: number): Promise<void> =>
    apiFetch<void>(`/api/v1/alerts/${id}`, { method: 'DELETE' }),
};
