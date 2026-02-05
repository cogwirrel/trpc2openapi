# trpc2openapi

Yet another tRPC to OpenAPI converter — because I couldn't find one that supported **tRPC 11** and **Zod 4**.

This library generates an OpenAPI 3.1 specification that conforms to the [tRPC RPC specification](https://trpc.io/docs/rpc), meaning the generated spec describes how tRPC handles HTTP requests and responses.

## Installation

```bash
npm install trpc2openapi
# or
pnpm add trpc2openapi
# or
yarn add trpc2openapi
```

## Peer Dependencies

This package requires the following peer dependencies:

- `@trpc/server` ^11
- `zod` ^4
- `openapi-types` ^12

## Usage

```typescript
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { trpc2OpenApi } from 'trpc2openapi';

// Create your tRPC router as usual
const t = initTRPC.create();

const appRouter = t.router({
  greeting: t.procedure
    .input(z.object({ name: z.string() }))
    .output(z.object({ message: z.string() }))
    .query(({ input }) => ({
      message: `Hello, ${input.name}!`,
    })),

  createUser: t.procedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1),
      }),
    )
    .output(
      z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
      }),
    )
    .mutation(({ input }) => ({
      id: crypto.randomUUID(),
      ...input,
    })),
});

// Generate the OpenAPI specification
const openApiSpec = trpc2OpenApi({
  apiTitle: 'My API',
  apiVersion: '1.0.0',
  basePath: '/trpc',
  router: appRouter,
});

console.log(JSON.stringify(openApiSpec, null, 2));
```

### Output

The above example generates an OpenAPI spec like:

```json
{
  "openapi": "3.1.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": {
    "/trpc/greeting": {
      "get": {
        "operationId": "greeting",
        "parameters": [
          {
            "name": "input",
            "in": "query",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "name": { "type": "string" }
                  },
                  "required": ["name"]
                }
              }
            }
          }
        ],
        "responses": {
          "200": {
            "description": "Successful response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "result": {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "object",
                          "properties": {
                            "message": { "type": "string" }
                          },
                          "required": ["message"]
                        }
                      },
                      "required": ["data"]
                    }
                  },
                  "required": ["result"]
                }
              }
            }
          }
        }
      }
    },
    "/trpc/createUser": {
      "post": {
        "operationId": "createUser",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "email": { "type": "string", "format": "email" },
                  "name": { "type": "string", "minLength": 1 }
                },
                "required": ["email", "name"]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Successful response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "result": {
                      "type": "object",
                      "properties": {
                        "data": {
                          "type": "object",
                          "properties": {
                            "id": { "type": "string" },
                            "email": { "type": "string" },
                            "name": { "type": "string" }
                          },
                          "required": ["id", "email", "name"]
                        }
                      },
                      "required": ["data"]
                    }
                  },
                  "required": ["result"]
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {}
}
```

## License

MIT
