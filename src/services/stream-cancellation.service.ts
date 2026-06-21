import type { Request, Response } from 'express';

export class StreamCancelledError extends Error {
  constructor(message = 'Streaming request was cancelled.') {
    super(message);
    this.name = 'StreamCancelledError';
  }
}

export type StreamCancellation = {
  signal: AbortSignal;
  isCancelled: () => boolean;
  cancel: (message?: string) => void;
  complete: () => void;
  cleanup: () => void;
  throwIfCancelled: () => void;
};

type CleanupHandler = () => void;

export const isStreamCancelledError = (error: unknown): boolean =>
  error instanceof StreamCancelledError ||
  (error instanceof Error && error.name === 'AbortError');

const listenOnce = (
  target: Request | Response,
  eventName: 'aborted' | 'close',
  handler: () => void,
): CleanupHandler => {
  target.once(eventName, handler);

  return () => {
    target.off(eventName, handler);
  };
};

const create = (): StreamCancellation => {
  const abortController = new AbortController();
  let cancelled = false;
  let completed = false;
  let cancelError = new StreamCancelledError();

  const cancellation: StreamCancellation = {
    signal: abortController.signal,
    isCancelled: () => cancelled,
    cancel: (message?: string) => {
      if (cancelled || completed) {
        return;
      }

      cancelled = true;
      cancelError = new StreamCancelledError(message);
      abortController.abort(cancelError);
    },
    complete: () => {
      completed = true;
    },
    cleanup: () => undefined,
    throwIfCancelled: () => {
      if (cancelled) {
        throw cancelError;
      }
    },
  };

  return cancellation;
};

const createForHttpStream = (req: Request, res: Response): StreamCancellation => {
  const cancellation = create();
  const cancel = (message: string) => cancellation.cancel(message);

  const cleanupHandlers: CleanupHandler[] = [
    listenOnce(req, 'aborted', () => cancel('Client aborted the streaming request.')),
    listenOnce(req, 'close', () => {
      if (req.aborted || req.socket.destroyed || res.destroyed) {
        cancel('Client closed the streaming request.');
      }
    }),
    listenOnce(res, 'close', () => cancel('Client closed the streaming response.')),
  ];

  const originalCleanup = cancellation.cleanup;

  cancellation.cleanup = () => {
    while (cleanupHandlers.length > 0) {
      cleanupHandlers.pop()?.();
    }

    originalCleanup();
  };

  if (req.aborted || res.destroyed) {
    cancel('Client disconnected before streaming started.');
  }

  return cancellation;
};

export const streamCancellationService = {
  create,
  createForHttpStream,
};
