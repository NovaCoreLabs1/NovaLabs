"use client";

import { useCallback } from 'react';
import * as Sentry from '@sentry/nextjs';
import { useAuthActions } from '../store/authStore';

interface ErrorHandlerReturn {
  handleError: (error: any) => void;
}

/**
 * Hook that provides centralised HTTP error handling for the NovaLabs frontend.
 * Automatically logs out the user on 401 Unauthorized responses.
 * Logs warnings for 403/404 and errors for 500 responses.
 * Reports errors to Sentry for monitoring and debugging.
 *
 * @returns An object with a `handleError` callback to pass to catch blocks
 */
export const useErrorHandler = (): ErrorHandlerReturn => {
  const { logout } = useAuthActions();

  const handleError = useCallback((error: any) => {
    // Log all errors to the console
    console.log('Error occurred:', error);

    // Handle different error types
    if (error?.response?.status || error?.status) {
      const status = error.response?.status || error.status;

      switch (status) {
        case 401:
          // Unauthorized - log the user out (don't report to Sentry, expected behavior)
          console.error('Unauthorized access. Logging out user.');
          logout();
          break;

        case 403:
          // Forbidden - report to Sentry as it may indicate permission issues
          console.warn('Forbidden access. User lacks required permissions.');
          Sentry.captureException(error, {
            level: 'warning',
            tags: { httpStatus: '403' },
          });
          break;

        case 404:
          // Not Found - don't report to Sentry, usually expected
          console.warn('Resource not found.');
          break;

        case 500:
          // Internal Server Error - report to Sentry
          console.error('Internal server error occurred.');
          Sentry.captureException(error, {
            level: 'error',
            tags: { httpStatus: '500' },
          });
          break;

        default:
          // Default error handler for unexpected cases
          console.error('Unexpected error occurred:', error);
          Sentry.captureException(error, {
            tags: { httpStatus: String(status) },
          });
          break;
      }
    } else {
      // Default error handler for unexpected cases
      console.error('Unexpected error occurred:', error);
      Sentry.captureException(error);
    }
  }, [logout]);

  return {
    handleError
  };
};
