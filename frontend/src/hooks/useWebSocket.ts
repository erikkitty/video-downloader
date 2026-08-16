import { useEffect, useRef, useState } from 'react';
import type { WSEvent } from '../types';

export const useWebSocket = (url: string) => {
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as WSEvent;
        setEvents((prev) => [...prev, data]);
      } catch (e) {
        console.error('Failed to parse WS message:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, [url]);

  const clearEvents = () => setEvents([]);

  return { events, connected, clearEvents };
};