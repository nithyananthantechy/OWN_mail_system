import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply } from 'fastify';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred. Please try again.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'object' && response !== null) {
        const res = response as Record<string, unknown>;
        message = (res['message'] as string) || message;
        code = (res['error'] as string) || this.statusToCode(status);
      } else if (typeof response === 'string') {
        message = response;
        code = this.statusToCode(status);
      }
    } else {
      // Log technical details server-side only - never expose to client
      this.logger.error(
        `Unhandled exception: ${exception instanceof Error ? exception.message : String(exception)}`,
        exception instanceof Error ? exception.stack : undefined,
        {
          requestId: request?.headers?.['x-request-id'],
          method: request?.method,
          url: request?.url,
        },
      );
    }

    reply.status(status).send({
      success: false,
      error: {
        code,
        message: this.sanitizeMessage(message),
      },
      requestId: request?.headers?.['x-request-id'],
    });
  }

  private statusToCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return codes[status] || 'UNKNOWN_ERROR';
  }

  private sanitizeMessage(message: unknown): string {
    if (Array.isArray(message)) {
      return message[0] || 'Validation failed.';
    }
    if (typeof message === 'string') {
      // Never expose internal paths or stack traces
      if (message.includes('node_modules') || message.includes('at ')) {
        return 'An unexpected error occurred.';
      }
      return message;
    }
    return 'An unexpected error occurred.';
  }
}
