import { describe, it, expect } from 'vitest';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { trpc2OpenApi } from './index.js';

const t = initTRPC.create();

describe('trpc2OpenApi', () => {
  describe('full spec snapshot', () => {
    it('should generate complete OpenAPI spec for a typical API', () => {
      const router = t.router({
        // Query with input and output
        getUser: t.procedure
          .input(z.object({ id: z.string() }))
          .output(
            z.object({
              id: z.string(),
              name: z.string(),
              email: z.email(),
              role: z.enum(['admin', 'user', 'guest']),
            }),
          )
          .query(({ input }) => ({
            id: input.id,
            name: 'Test User',
            email: 'test@example.com',
            role: 'user' as const,
          })),
        // Mutation with complex input
        createUser: t.procedure
          .input(
            z.object({
              name: z.string().min(1),
              email: z.email(),
              profile: z
                .object({
                  bio: z.string().optional(),
                  avatar: z.url().optional(),
                })
                .optional(),
            }),
          )
          .output(z.object({ id: z.string(), createdAt: z.string() }))
          .mutation(() => ({ id: '123', createdAt: new Date().toISOString() })),
        // Simple query without input/output
        health: t.procedure.query(() => 'ok'),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'User Management API',
        apiVersion: '2.0.0',
        basePath: '/api/v2',
        router,
      });

      expect(spec).toMatchSnapshot();
    });
  });

  describe('basic structure', () => {
    it('should generate a valid OpenAPI 3.1 document', () => {
      const router = t.router({});

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      expect(spec.openapi).toBe('3.1.0');
      expect(spec.info.title).toBe('Test API');
      expect(spec.info.version).toBe('1.0.0');
      expect(spec.paths).toEqual({});
      expect(spec.components).toEqual({});
    });
  });

  describe('query procedures', () => {
    it('should generate GET endpoint for query procedure', () => {
      const router = t.router({
        greeting: t.procedure.query(() => 'hello'),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      expect(spec.paths?.['/trpc/greeting']).toBeDefined();
      expect(spec.paths?.['/trpc/greeting']?.get).toBeDefined();
      expect(spec.paths?.['/trpc/greeting']?.get?.operationId).toBe('greeting');
    });

    it('should include input schema as query parameter for query procedure', () => {
      const router = t.router({
        greeting: t.procedure
          .input(z.object({ name: z.string() }))
          .query(({ input }) => `Hello, ${input.name}!`),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      const operation = spec.paths!['/trpc/greeting']?.get;
      expect(operation?.parameters).toBeDefined();
      expect(operation?.parameters).toHaveLength(1);

      const param = operation?.parameters?.[0] as {
        name: string;
        in: string;
        content: Record<string, { schema: unknown }>;
      };
      expect(param.name).toBe('input');
      expect(param.in).toBe('query');
      expect(param.content['application/json'].schema).toMatchSnapshot();
    });

    it('should include output schema wrapped in tRPC response envelope', () => {
      const router = t.router({
        greeting: t.procedure
          .output(z.object({ message: z.string() }))
          .query(() => ({ message: 'hello' })),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      const operation = spec.paths!['/trpc/greeting']?.get;
      const response = operation?.responses?.['200'] as {
        description: string;
        content?: Record<string, { schema: unknown }>;
      };

      expect(response.description).toBe('Successful response');
      expect(response.content?.['application/json'].schema).toMatchSnapshot();
    });
  });

  describe('mutation procedures', () => {
    it('should generate POST endpoint for mutation procedure', () => {
      const router = t.router({
        createUser: t.procedure.mutation(() => ({ id: '1' })),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      expect(spec.paths!['/trpc/createUser']).toBeDefined();
      expect(spec.paths!['/trpc/createUser']?.post).toBeDefined();
      expect(spec.paths!['/trpc/createUser']?.post?.operationId).toBe(
        'createUser',
      );
    });

    it('should include input schema as request body for mutation procedure', () => {
      const router = t.router({
        createUser: t.procedure
          .input(
            z.object({
              email: z.email(),
              name: z.string(),
            }),
          )
          .mutation(({ input }) => ({ id: '1', ...input })),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      const operation = spec.paths!['/trpc/createUser']?.post;
      expect(operation?.requestBody).toBeDefined();

      const requestBody = operation?.requestBody as {
        required: boolean;
        content: Record<string, { schema: unknown }>;
      };
      expect(requestBody.required).toBe(true);
      expect(requestBody.content['application/json'].schema).toMatchSnapshot();
    });
  });

  describe('subscription procedures', () => {
    it('should skip subscription procedures', () => {
      const router = t.router({
        onMessage: t.procedure.subscription(() => {
          return {
            [Symbol.asyncIterator]: async function* () {
              yield 'message';
            },
          };
        }),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      expect(spec.paths!['/trpc/onMessage']).toBeUndefined();
    });
  });

  describe('multiple procedures', () => {
    it('should handle multiple procedures in a router', () => {
      const router = t.router({
        getUser: t.procedure
          .input(z.object({ id: z.string() }))
          .output(z.object({ id: z.string(), name: z.string() }))
          .query(({ input }) => ({ id: input.id, name: 'Test User' })),
        createUser: t.procedure
          .input(z.object({ name: z.string() }))
          .output(z.object({ id: z.string(), name: z.string() }))
          .mutation(({ input }) => ({ id: '1', name: input.name })),
        deleteUser: t.procedure
          .input(z.object({ id: z.string() }))
          .mutation(({ input }) => ({ deleted: input.id })),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/api',
        router,
      });

      expect(Object.keys(spec.paths!)).toHaveLength(3);
      expect(spec.paths).toMatchSnapshot();
    });
  });

  describe('procedures without input/output', () => {
    it('should handle procedure without input', () => {
      const router = t.router({
        health: t.procedure.query(() => 'ok'),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      const operation = spec.paths!['/trpc/health']?.get;
      expect(operation?.parameters).toBeUndefined();
      expect(operation?.requestBody).toBeUndefined();
    });

    it('should handle procedure without output', () => {
      const router = t.router({
        ping: t.procedure.query(() => 'pong'),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      const operation = spec.paths!['/trpc/ping']?.get;
      const response = operation?.responses?.['200'] as {
        description: string;
        content?: unknown;
      };

      expect(response.description).toBe('Successful response');
      expect(response.content).toBeUndefined();
    });
  });

  describe('complex zod schemas', () => {
    it('should handle nested object schemas', () => {
      const router = t.router({
        createOrder: t.procedure
          .input(
            z.object({
              customer: z.object({
                name: z.string(),
                email: z.email(),
              }),
              items: z.array(
                z.object({
                  productId: z.string(),
                  quantity: z.number().int().positive(),
                }),
              ),
            }),
          )
          .mutation(() => ({ orderId: '123' })),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      const operation = spec.paths!['/trpc/createOrder']?.post;
      const requestBody = operation?.requestBody as {
        content: Record<string, { schema: unknown }>;
      };
      expect(requestBody.content['application/json'].schema).toMatchSnapshot();
    });

    it('should handle optional fields', () => {
      const router = t.router({
        updateUser: t.procedure
          .input(
            z.object({
              id: z.string(),
              name: z.string().optional(),
              email: z.email().optional(),
            }),
          )
          .mutation(() => ({ success: true })),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      const operation = spec.paths!['/trpc/updateUser']?.post;
      const requestBody = operation?.requestBody as {
        content: Record<string, { schema: unknown }>;
      };
      expect(requestBody.content['application/json'].schema).toMatchSnapshot();
    });

    it('should handle enum schemas', () => {
      const router = t.router({
        setStatus: t.procedure
          .input(
            z.object({
              status: z.enum(['active', 'inactive', 'pending']),
            }),
          )
          .mutation(() => ({ success: true })),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '/trpc',
        router,
      });

      const operation = spec.paths!['/trpc/setStatus']?.post;
      const requestBody = operation?.requestBody as {
        content: Record<string, { schema: unknown }>;
      };
      expect(requestBody.content['application/json'].schema).toMatchSnapshot();
    });
  });

  describe('base path variations', () => {
    it('should handle base path without leading slash', () => {
      const router = t.router({
        test: t.procedure.query(() => 'ok'),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: 'api',
        router,
      });

      expect(spec.paths!['api/test']?.get).toBeDefined();
    });

    it('should handle empty base path', () => {
      const router = t.router({
        test: t.procedure.query(() => 'ok'),
      });

      const spec = trpc2OpenApi({
        apiTitle: 'Test API',
        apiVersion: '1.0.0',
        basePath: '',
        router,
      });

      expect(spec.paths!['/test']?.get).toBeDefined();
    });
  });
});
