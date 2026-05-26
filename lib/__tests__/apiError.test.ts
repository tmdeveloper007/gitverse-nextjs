import { apiError } from '../api-error';
import { NextResponse } from 'next/server';

jest.mock('next/server', () => {
  return {
    NextResponse: {
      json: jest.fn((body, init) => {
        return {
          body,
          status: init?.status,
        };
      }),
    },
  };
});

describe('apiError', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a NextResponse with error message and status code', () => {
    const response = apiError(400, 'Bad Request');
    expect(NextResponse.json).toHaveBeenCalledWith(
      {
        error: {
          message: 'Bad Request',
        },
      },
      { status: 400 }
    );
    expect(response).toEqual({
      body: {
        error: {
          message: 'Bad Request',
        },
      },
      status: 400,
    });
  });

  it('includes optional error code when provided', () => {
    const response = apiError(401, 'Unauthorized', 'AUTH_EXPIRED');
    expect(NextResponse.json).toHaveBeenCalledWith(
      {
        error: {
          message: 'Unauthorized',
          code: 'AUTH_EXPIRED',
        },
      },
      { status: 401 }
    );
    expect(response).toEqual({
      body: {
        error: {
          message: 'Unauthorized',
          code: 'AUTH_EXPIRED',
        },
      },
      status: 401,
    });
  });
});
