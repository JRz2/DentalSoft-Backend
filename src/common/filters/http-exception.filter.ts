import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Error interno del servidor';
        let code: string | undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                const res = exceptionResponse as any;
                message = res.message || message;
                code = res.code;
            }
        } else if (exception instanceof Error) {
            message = exception.message;
        }

        const errorResponse = {
            statusCode: status,
            message,
            code,
            timestamp: new Date().toISOString(),
            path: request.url,
        };

        // Log de errores 5xx para debugging
        if (status >= 500) {
            console.error('[Exception]', {
                path: request.url,
                method: request.method,
                status,
                message,
                stack: exception instanceof Error ? exception.stack : undefined,
            });
        }

        response.status(status).json(errorResponse);
    }
}