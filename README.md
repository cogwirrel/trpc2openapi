# trpc2openapi

Yet another tRPC to OpenAPI converter — because I couldn't find one that supported **tRPC 11** and **Zod 4**.

This library does not modify your tRPC API in any way. It generates an OpenAPI 3.1 specification that documents your existing tRPC API as-is, conforming to the [tRPC RPC specification](https://trpc.io/docs/rpc).

> Looking to make your tRPC API more RESTful? Check out [trpc-to-openapi](https://github.com/mcampa/trpc-to-openapi) which allows you to expose your tRPC procedures as REST endpoints.

## Installation

```bash
npm install trpc2openapi
# or
pnpm add trpc2openapi
# or
yarn add trpc2openapi
```

## Usage

```typescript
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { trpc2OpenApi } from 'trpc2openapi';

const t = initTRPC.create();

const appRouter = t.router({
  greeting: t.procedure
    .input(z.object({ name: z.string() }))
    .output(z.object({ message: z.string() }))
    .query(({ input }) => ({ message: `Hello, ${input.name}!` })),
});

const openApiSpec = trpc2OpenApi({
  apiTitle: 'My API',
  apiVersion: '1.0.0',
  basePath: '/trpc',
  router: appRouter,
});
```

This generates an OpenAPI spec where:

- Queries become `GET` endpoints with input as a query parameter
- Mutations become `POST` endpoints with input as request body
- Responses are wrapped in tRPC's `{ result: { data: ... } }` envelope

## License

MIT
