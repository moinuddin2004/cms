import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ResponseWrapper } from '../dtos/ResponseWrapper';
import { AppLogger } from '../services/logger.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Internal error text (SQL, constraint/column names, vendor errors) is
    // only sent outside production; it is always logged below.
    const devMessage =
      process.env.NODE_ENV === 'production'
        ? exception instanceof HttpException
          ? exception.message
          : 'Internal server error'
        : exception instanceof HttpException
          ? exception.message
          : exception?.message || 'Internal server error';

    const message =
      exception instanceof HttpException
        ? exception.getResponse()['message'] || 'Something went wrong'
        : 'Something went wrong';

    const error =
      exception instanceof HttpException ? exception.getResponse() : null;

    this.logger.error(
      `Exception thrown: ${exception}`,
      exception instanceof HttpException
        ? JSON.stringify(exception.getResponse())
        : exception instanceof Error
          ? exception.stack
          : '',
      maskTokens(request.url),
    );

    response.status(status).json(
      ResponseWrapper.builder()
        .isSuccess(false)
        .httpStatusCode(status)
        .message(typeof message === 'string' ? message : message[0])
        .devMessage(devMessage)
        .error(error)
        .build(),
    );
  }
}

/** Token-in-path routes: never write the token into logs. */
function maskTokens(url: string | undefined): string | undefined {
  return url?.replace(
    /(\/(?:lab-link|join-invites|join)\/)[^/?#]+/g,
    '$1***',
  );
}
