import { closeSseResponse, initializeSseResponse, sendSseEvent } from '@lib/sse';
import { AppError } from '@middlewares/error.middleware';
import { streamCancellationService } from '@services/stream-cancellation.service';
import { asyncHandler } from '@middlewares/async-handler.middleware';
import { streamingService } from '@services/streaming.service';
import { parseChatIdParam, parseCreateChatMessageDto } from '@/types/message.dto';
import type { StreamChatSseEvents } from '@/types/streaming.dto';
import type { Request, Response } from 'express';

const getAuthenticatedUserId = (req: Request): string => {
  if (!req.user) {
    throw new AppError('Authentication required.', 401, 'AUTH_REQUIRED');
  }

  return req.user.id;
};

const getStreamErrorMessage = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return 'Streaming request was interrupted.';
  }

  return 'Unable to stream assistant response.';
};

export const streamingController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const chatId = parseChatIdParam(req.params.chatId);
    const dto = parseCreateChatMessageDto(req.body);
    const cancellation = streamCancellationService.createForHttpStream(req, res);

    initializeSseResponse(res);

    try {
      await streamingService.streamChatCompletion({
        userId,
        chatId,
        dto,
        cancellation,
        callbacks: {
          onStart: (event) => sendSseEvent<StreamChatSseEvents, 'start'>(res, 'start', event),
          onToken: (event) => sendSseEvent<StreamChatSseEvents, 'token'>(res, 'token', event),
          onComplete: (event) =>
            sendSseEvent<StreamChatSseEvents, 'complete'>(res, 'complete', event),
        },
      });

      cancellation.complete();
      cancellation.cleanup();
      closeSseResponse(res);
    } catch (error) {
      cancellation.complete();
      cancellation.cleanup();

      if (!cancellation.isCancelled()) {
        await sendSseEvent<StreamChatSseEvents, 'error'>(res, 'error', {
          message: getStreamErrorMessage(error),
        });
      }

      closeSseResponse(res);
    }
  }),
};
