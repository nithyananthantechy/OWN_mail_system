import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const { method, url } = req;
    const requestId = req.headers['x-request-id'];
    const userId = req.user?.id;
    const now = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const duration = Date.now() - now;
          // Never log request/response bodies (may contain passwords)
          this.logger.log({
            requestId,
            method,
            url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userId,
          });
        },
        error: (err) => {
          const duration = Date.now() - now;
          this.logger.error({
            requestId,
            method,
            url,
            duration: `${duration}ms`,
            userId,
            error: err?.message,
          });
        },
      }),
    );
  }
}
