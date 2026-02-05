import { type AnyTRPCRouter } from '@trpc/server';
import { type OpenAPIV3_1 } from 'openapi-types';
import * as z from 'zod';

type AnyProcedure = {
  _def: {
    procedure: true;
    type: 'query' | 'mutation' | 'subscription';
    inputs: z.ZodType[];
    output?: z.ZodType;
  };
};

interface RouterRecord {
  [key: string]: AnyProcedure | RouterRecord;
}

const PROCEDURE_TYPE_HTTP_METHOD_MAP: Record<string, string | undefined> = {
  query: 'get',
  mutation: 'post',
  subscription: undefined,
};

/**
 * Convert a tRPC router to an OpenAPI 3.1 specification document.
 *
 * @param options - Configuration options for generating the OpenAPI spec
 * @param options.apiTitle - The title of the API (used in OpenAPI info.title)
 * @param options.apiVersion - The version of the API (used in OpenAPI info.version)
 * @param options.basePath - The base path prefix for all tRPC endpoints (e.g., '/trpc')
 * @param options.router - The tRPC router to convert to OpenAPI
 * @returns An OpenAPI 3.1 Document object
 *
 * @example
 * ```typescript
 * import { initTRPC } from '@trpc/server';
 * import { z } from 'zod';
 * import { trpc2OpenApi } from 'trpc2openapi';
 *
 * const t = initTRPC.create();
 * const appRouter = t.router({
 *   greeting: t.procedure
 *     .input(z.object({ name: z.string() }))
 *     .output(z.object({ message: z.string() }))
 *     .query(({ input }) => ({ message: `Hello, ${input.name}!` })),
 * });
 *
 * const spec = trpc2OpenApi({
 *   apiTitle: 'My API',
 *   apiVersion: '1.0.0',
 *   basePath: '/trpc',
 *   router: appRouter,
 * });
 * ```
 */
export const trpc2OpenApi = ({
  apiTitle,
  apiVersion,
  basePath,
  router,
}: {
  apiTitle: string;
  apiVersion: string;
  basePath: string;
  router: AnyTRPCRouter;
}): OpenAPIV3_1.Document => ({
  openapi: '3.1.0',
  info: { title: apiTitle, version: apiVersion },
  paths: getPathsForRouterRecord({
    basePath,
    routerRecord: router._def.procedures as RouterRecord,
  }),
  components: {},
});

/**
 * Recursively process a router record and generate OpenAPI paths
 */
const getPathsForRouterRecord = ({
  basePath,
  routerRecord,
}: {
  basePath: string;
  routerRecord: RouterRecord;
}): OpenAPIV3_1.PathsObject => {
  const paths: OpenAPIV3_1.PathsObject = {};

  for (const [procedureName, procedureOrRouterRecord] of Object.entries(
    routerRecord,
  )) {
    Object.assign(
      paths,
      isProcedure(procedureOrRouterRecord)
        ? getPathsForProcedure({
            basePath,
            procedureName: String(procedureName),
            procedure: procedureOrRouterRecord,
          })
        : getPathsForRouterRecord({
            basePath,
            routerRecord: procedureOrRouterRecord,
          }),
    );
  }

  return paths;
};

/**
 * Generate OpenAPI path for a single procedure
 */
const getPathsForProcedure = ({
  basePath,
  procedureName,
  procedure,
}: {
  basePath: string;
  procedureName: string;
  procedure: AnyProcedure;
}): OpenAPIV3_1.PathsObject => {
  const def = procedure._def;

  const method = PROCEDURE_TYPE_HTTP_METHOD_MAP[def.type];
  if (method == null) {
    return {};
  }

  const operation: OpenAPIV3_1.OperationObject = {
    operationId: procedureName,
  };

  // Handle input schema
  if (def.inputs[0] != null) {
    const jsonSchema = z.toJSONSchema(def.inputs[0] as z.ZodType);

    const content: Record<string, OpenAPIV3_1.MediaTypeObject> = {
      'application/json': {
        schema: jsonSchema as unknown as OpenAPIV3_1.SchemaObject,
      },
    };

    if (method === 'get') {
      operation.parameters = [
        {
          name: 'input',
          in: 'query',
          content,
        } as OpenAPIV3_1.ParameterObject,
      ];
    } else {
      operation.requestBody = {
        required: true,
        content,
      };
    }
  }

  // Handle output schema - tRPC wraps responses in { result: { data: <output> } }
  if (def.output != null) {
    const outputJsonSchema = z.toJSONSchema(def.output as z.ZodType);

    // Wrap the output schema in tRPC's response envelope: { result: { data: <output> } }
    const responseSchema: OpenAPIV3_1.SchemaObject = {
      type: 'object',
      properties: {
        result: {
          type: 'object',
          properties: {
            data: outputJsonSchema as unknown as OpenAPIV3_1.SchemaObject,
          },
          required: ['data'],
        },
      },
      required: ['result'],
    };

    operation.responses = {
      '200': {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: responseSchema,
          },
        },
      },
    };
  } else {
    // Default response when no output schema is defined
    operation.responses = {
      '200': {
        description: 'Successful response',
      },
    };
  }

  return {
    [`${basePath}/${procedureName}`]: {
      [method]: operation,
    },
  };
};

/**
 * Type guard to check if a value is a tRPC procedure
 */
const isProcedure = (
  maybeProcedure: AnyProcedure | RouterRecord,
): maybeProcedure is AnyProcedure =>
  (maybeProcedure as AnyProcedure)._def.procedure === true;
