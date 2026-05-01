'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

const WS_BASE = "ws://127.0.0.1:8000";

interface WebSocketPriceMessage {
  symbol: string;
  price: number;
  timestamp: string;
}

interface UseWebSocketPriceResult {
  price: number | null;
  connected: boolean;
  error: string | null;
}

export function useWebSocketPrice(symbol: string | null): UseWebSocketPriceResult {
  const [price, setPrice] = useState<number | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    if (!symbol) return;

    const url = `${WS_BASE}/api/v1/stream/price/${encodeURIComponent(symbol)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data: WebSocketPriceMessage = JSON.parse(event.data);
        setPrice(data.price);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
      setError('WebSocket connection failed');
    };
  }, [symbol]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return { price, connected, error };
}
