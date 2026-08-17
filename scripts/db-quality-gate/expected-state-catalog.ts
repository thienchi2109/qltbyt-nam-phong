import { z } from "zod"

const policySchema = z
  .object({
    command: z.enum(["ALL", "DELETE", "INSERT", "SELECT", "UPDATE"]),
    identity: z.string().min(1),
    permissive: z.boolean(),
    roles: z.array(z.string().min(1)),
    using: z.string().min(1).nullable(),
    withCheck: z.string().min(1).nullable(),
  })
  .strict()

/** Validates logical application-owned structure collected from a disposable catalog. */
export const applicationCatalogSchema = z
  .object({
    relations: z.array(
      z
        .object({
          columns: z
            .array(
              z
                .object({
                  dataType: z.string().min(1),
                  name: z.string().min(1),
                  nullable: z.boolean(),
                  ordinal: z.number().int().nonnegative().optional(),
                })
                .strict()
            )
            .default([]),
          constraints: z
            .array(z.object({ definition: z.string().min(1), name: z.string().min(1) }).strict())
            .default([]),
          extensionOwned: z.boolean().optional(),
          identity: z.string().min(1),
          indexes: z
            .array(z.object({ definition: z.string().min(1), name: z.string().min(1) }).strict())
            .default([]),
          kind: z.enum(["table", "view"]),
          triggers: z
            .array(z.object({ definition: z.string().min(1), name: z.string().min(1) }).strict())
            .default([]),
        })
        .strict()
    ),
    routines: z.array(
      z
        .object({
          definition: z.string().min(1),
          extensionOwned: z.boolean().optional(),
          identity: z.string().min(1),
          kind: z.enum(["function", "procedure"]),
        })
        .strict()
    ),
  })
  .strict()

/** Validates security-significant ownership, grant, RLS, policy, and routine state. */
export const accessCatalogSchema = z
  .object({
    routines: z.array(
      z
        .object({
          executionMode: z.enum(["definer", "invoker"]),
          grants: z.array(
            z
              .object({
                operations: z.array(z.string().min(1)).min(1),
                role: z.string().min(1),
              })
              .strict()
          ),
          identity: z.string().min(1),
          owner: z.string().min(1),
          searchPath: z.string().min(1).nullable(),
        })
        .strict()
    ),
    tables: z.array(
      z
        .object({
          grants: z.array(
            z
              .object({
                operations: z.array(z.string().min(1)).min(1),
                role: z.string().min(1),
              })
              .strict()
          ),
          identity: z.string().min(1),
          owner: z.string().min(1),
          policies: z.array(policySchema),
          rls: z
            .object({
              enabled: z.boolean(),
              forced: z.boolean(),
            })
            .strict(),
        })
        .strict()
    ),
  })
  .strict()

/** Validates environment facts that cannot be derived safely from structural replay. */
export const environmentCatalogSchema = z
  .object({
    extensions: z.array(
      z
        .object({
          name: z.string().min(1),
          schema: z.string().min(1),
          version: z.string().min(1),
        })
        .strict()
    ),
    postgresqlVersion: z.string().min(1),
    supabaseVersion: z.string().min(1),
  })
  .strict()

export type AccessCatalog = z.infer<typeof accessCatalogSchema>
