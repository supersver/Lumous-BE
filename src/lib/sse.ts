import { once } from 'node:events';
import type { Response } from 'express';

export type SseEventMap = object;

export const initializeSseResponse = (res: Response): void => {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  if (typeof res.flushHeaders === 'function') {
    res.flushHeaders();
  }
};

export const sendSseEvent = async <Events extends SseEventMap, EventName extends keyof Events>(
  res: Response,
  event: EventName,
  data: Events[EventName],
): Promise<void> => {
  if (res.destroyed || res.writableEnded) {
    return;
  }

  const payload = `event: ${String(event)}\ndata: ${JSON.stringify(data)}\n\n`;

  if (!res.write(payload)) {
    await Promise.race([once(res, 'drain'), once(res, 'close')]);
  }
};

export const closeSseResponse = (res: Response): void => {
  if (!res.destroyed && !res.writableEnded) {
    res.end();
  }
};
