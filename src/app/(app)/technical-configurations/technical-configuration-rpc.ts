import type {
  TechnicalConfigurationDossierCreateRpcArgs,
  TechnicalConfigurationDossierGetRpcArgs,
  TechnicalConfigurationDossierListRpcArgs,
  TechnicalConfigurationDossierListWireResponse,
  TechnicalConfigurationDossierWireResponse,
} from "./types"

type TechnicalConfigurationRpcErrorPayload = {
  code?: string
  message?: string
  details?: string
  hint?: string
}

type TechnicalConfigurationRpcRequestOptions = {
  signal?: AbortSignal
}

/** Preserves HTTP and PostgREST metadata from technical configuration RPC failures. */
export class TechnicalConfigurationRpcError extends Error {
  readonly status: number
  readonly code?: string
  readonly details?: string
  readonly hint?: string

  constructor(status: number, payload: TechnicalConfigurationRpcErrorPayload) {
    super(payload.message || `RPC failed (${status})`)
    this.name = "TechnicalConfigurationRpcError"
    this.status = status
    this.code = payload.code
    this.details = payload.details
    this.hint = payload.hint
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function getErrorPayload(payload: unknown): TechnicalConfigurationRpcErrorPayload {
  const errorPayload = isRecord(payload) ? (payload.error ?? payload) : payload

  if (typeof errorPayload === "string") {
    return { message: errorPayload }
  }

  if (!isRecord(errorPayload)) {
    return {}
  }

  return {
    code: typeof errorPayload.code === "string" ? errorPayload.code : undefined,
    message: typeof errorPayload.message === "string" ? errorPayload.message : undefined,
    details: typeof errorPayload.details === "string" ? errorPayload.details : undefined,
    hint: typeof errorPayload.hint === "string" ? errorPayload.hint : undefined,
  }
}

async function callTechnicalConfigurationRpc<TResponse>(
  fn: string,
  args: object,
  options: TechnicalConfigurationRpcRequestOptions = {}
): Promise<TResponse> {
  const response = await fetch(`/api/rpc/${encodeURIComponent(fn)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    signal: options.signal,
  })

  const payload: unknown = await response.json().catch((error: unknown) => {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error
    }

    return null
  })

  if (!response.ok) {
    throw new TechnicalConfigurationRpcError(response.status, getErrorPayload(payload))
  }

  if (payload === null) {
    throw new TechnicalConfigurationRpcError(response.status, {
      message: "RPC returned an invalid JSON response",
    })
  }

  return payload as TResponse
}

/** Lists configuration dossiers visible to the authenticated global user. */
export function listTechnicalConfigurationDossiers(
  args: TechnicalConfigurationDossierListRpcArgs = {},
  signal?: AbortSignal
): Promise<TechnicalConfigurationDossierListWireResponse> {
  return callTechnicalConfigurationRpc("technical_configuration_dossiers_list", args, { signal })
}

/** Fetches one configuration dossier by identifier. */
export function getTechnicalConfigurationDossier(
  id: string,
  signal?: AbortSignal
): Promise<TechnicalConfigurationDossierWireResponse> {
  const args: TechnicalConfigurationDossierGetRpcArgs = { p_id: id }

  return callTechnicalConfigurationRpc("technical_configuration_dossiers_get", args, { signal })
}

/** Creates a configuration dossier only when the explicit save action is submitted. */
export function createTechnicalConfigurationDossier(
  args: TechnicalConfigurationDossierCreateRpcArgs,
  signal?: AbortSignal
): Promise<TechnicalConfigurationDossierWireResponse> {
  return callTechnicalConfigurationRpc("technical_configuration_dossiers_create", args, { signal })
}
