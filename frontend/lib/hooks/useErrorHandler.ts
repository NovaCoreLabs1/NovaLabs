"use client";

import { useCallback } from 'react';
import { useAuthActions } from '../store/authStore';

interface ApiError {
  status?: number;
  response?: { status?: number };
  message?: string;
}

interface ErrorHandlerReturn {
  handleError: (error: ApiError) => void;
}

/**
 * Hook that provides centralised HTTP error handling for the NovaLabs frontend.
 * Automatically logs out the user on 401 Unauthorized responses.
 * Logs warnings for 403/404 and errors for 500 responses.
 *
 * @returns An object with a `handleError` callback to pass to catch blocks
 */
export const useErrorHandler = (): ErrorHandlerReturn => {
  const { logout } = useAuthActions();

  const handleError = useCallback((error: ApiError) => {
    // Log all errors to the console
    console.log('Error occurred:', error);

    // Handle different error types
    if (error?.response?.status || error?.status) {
      const status = error.response?.status || error.status;
      
      switch (status) {
        case 401:
          // Unauthorized - log the user out
          console.error('Unauthorized access. Logging out user.');
          logout();
          break;
          
        case 403:
          // Forbidden
          console.warn('Forbidden access. User lacks required permissions.');
          break;
          
        case 404:
          // Not Found
          console.warn('Resource not found.');
          break;
          
        case 500:
          // Internal Server Error
          console.error('Internal server error occurred.');
          break;
          
        default:
          // Default error handler for unexpected cases
          console.error('Unexpected error occurred:', error);
          break;
      }
    } else {
      // Default error handler for unexpected cases
      console.error('Unexpected error occurred:', error);
    }
  }, [logout]);

  return {
    handleError
  };
};
