import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate';

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
    };
    mockRes = {};
    mockNext = vi.fn();
  });

  describe('validateBody', () => {
    it('should pass validation with valid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      mockReq.body = { name: 'John', age: 30 };

      const middleware = validateBody(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ name: 'John', age: 30 });
    });

    it('should fail validation with invalid data', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number(),
      });

      mockReq.body = { name: 'John', age: 'invalid' };

      const middleware = validateBody(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should transform data according to schema', () => {
      const schema = z.object({
        age: z.string().transform(val => parseInt(val, 10)),
      });

      mockReq.body = { age: '30' };

      const middleware = validateBody(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ age: 30 });
    });

    it('should handle missing required fields', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      mockReq.body = { name: 'John' }; // missing email

      const middleware = validateBody(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        name: z.string(),
        email: z.string().email().optional(),
      });

      mockReq.body = { name: 'John' };

      const middleware = validateBody(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe('validateQuery', () => {
    it('should pass validation with valid query params', () => {
      const schema = z.object({
        page: z.string(),
        limit: z.string(),
      });

      mockReq.query = { page: '1', limit: '10' };

      const middleware = validateQuery(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({ page: '1', limit: '10' });
    });

    it('should fail validation with invalid query params', () => {
      const schema = z.object({
        page: z.string().regex(/^\d+$/),
      });

      mockReq.query = { page: 'invalid' };

      const middleware = validateQuery(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should transform query params', () => {
      const schema = z.object({
        active: z.enum(['true', 'false']).transform(val => val === 'true'),
      });

      mockReq.query = { active: 'true' };

      const middleware = validateQuery(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({ active: true });
    });
  });

  describe('validateParams', () => {
    it('should pass validation with valid params', () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      mockReq.params = { id: '123e4567-e89b-12d3-a456-426614174000' };

      const middleware = validateParams(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should fail validation with invalid params', () => {
      const schema = z.object({
        id: z.string().uuid(),
      });

      mockReq.params = { id: 'not-a-uuid' };

      const middleware = validateParams(schema);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});
