export const BROKER_CHANNEL = "ponpoko.surface.v1";

export const READY_CONTROL = "ponpoko.surface.ready";

export const HELLO_CONTROL = "ponpoko.host.hello";

export const PALETTE_CONTROL = "ponpoko.host.palette";

export const DROP_CONTROL = "ponpoko.host.drop";

export const PROTOCOL_VERSION = 1;

export const HOST_PLATFORM = "host.platform";

export const HOST_WORK = "host.work";

export const HOST_SURFACE = "host.surface";

export const SURFACE_OPERATIONS = ["tool.file", "tool.paste", "backend.call"] as const;

export const NAMESPACES = [HOST_PLATFORM, HOST_WORK, HOST_SURFACE] as const;

export type Namespace = (typeof NAMESPACES)[number];

export const PLATFORM_OPERATIONS = [
  "research.search", "ai.request", "protocol.info", "providers.list", "attachments.pick", "attachments.read", "attachments.paste-image",
  "files.save", "preferences.list", "settings.open", "link.open",
] as const;

export type PlatformOperation = (typeof PLATFORM_OPERATIONS)[number];

export const WORK_OPERATIONS = [
  "list",
  "get",
  "events.subscribe",
  "events.unsubscribe",
  "instruction.append",
  "pause",
  "resume",
  "stop",
] as const;

export type WorkOperation = (typeof WORK_OPERATIONS)[number];

export const OPERATIONS: Record<Namespace, readonly string[]> = {
  [HOST_PLATFORM]: PLATFORM_OPERATIONS,
  [HOST_WORK]: WORK_OPERATIONS,
  [HOST_SURFACE]: SURFACE_OPERATIONS,
};

export const ERROR_CODES = [
  "malformed_request",
  "unknown_operation",
  "protocol_mismatch",
  "unregistered_frame",
  "stale_view",
  "forbidden_scope",
  "not_found",
  "invalid_input",
  "cursor_expired",
  "budget_exhausted",
  "budget_out_of_bounds",
  "host_unavailable",
  "search_unavailable", "search_outcome_unknown", "search_invalid_response", "search_upstream_error",
  "sign_in_required", "quota_exhausted", "rate_limited", "outcome_unknown",
  "idempotency_in_progress", "idempotency_conflict", "service_budget_exhausted", "operation_disabled", "inference_disabled", "concurrency_limit",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const ERROR_MESSAGES: Record<ErrorCode, string> = {
  "search_unavailable": "Web search is unavailable",
  "search_outcome_unknown": "Search outcome is unknown; do not repeat automatically",
  "search_invalid_response": "Search returned unsupported evidence",
  "search_upstream_error": "The search provider rejected the request",
  "sign_in_required": "Sign in to Ponpoko Cloud to search",
  "quota_exhausted": "No account points remain",
  "rate_limited": "Search requests are arriving too quickly",
  "outcome_unknown": "Inspect the original request before repeating",
  "idempotency_in_progress": "The original request is still in progress",
  "idempotency_conflict": "This request identity was used with different input",
  "service_budget_exhausted": "The hosted service reached its budget",
  "operation_disabled": "This service is disabled",
  "inference_disabled": "Hosted services are disabled",
  "concurrency_limit": "The service has reached its in-flight limit",

  malformed_request: "the host could not read the request",
  unknown_operation: "the host accepts no such operation",
  protocol_mismatch: "this surface and the running Ponpoko speak different protocols",
  unregistered_frame: "the host does not know which surface sent this",
  stale_view: "this surface tab was replaced by a newer one",
  forbidden_scope: "the request reached outside what this surface may touch",
  not_found: "the thing the request names is not here",
  invalid_input: "the request carried an argument the host refuses",
  cursor_expired: "the host no longer holds the events from that cursor",
  budget_exhausted: "the work has no allowance left",
  budget_out_of_bounds: "the budget asked for is larger than the host allows",
  host_unavailable: "the host cannot answer right now",
};

const RETRYABLE_CODES: readonly ErrorCode[] = ["host_unavailable"];

export function errorMessageFor(code: ErrorCode): string {
  return ERROR_MESSAGES[code];
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && (ERROR_CODES as readonly string[]).includes(value);
}

export function isRetryable(code: ErrorCode): boolean {
  return RETRYABLE_CODES.includes(code);
}

export function isNamespace(value: unknown): value is Namespace {
  return typeof value === "string" && (NAMESPACES as readonly string[]).includes(value);
}

export function isOperation(namespace: Namespace, operation: unknown): boolean {
  return typeof operation === "string" && OPERATIONS[namespace].includes(operation);
}



export function operationName(namespace: Namespace, operation: string): string {
  return `${namespace}.${operation}`;
}

export function isBrokerChannel(value: unknown): boolean {
  return value === BROKER_CHANNEL;
}

export interface BrokerRequest {
  channel: typeof BROKER_CHANNEL;
  view: string;
  request_id: string;
  namespace: Namespace;
  operation: string;
  payload?: unknown;
}

export interface BrokerErrorBody {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  cursor?: number;
}

export interface BrokerResponse {
  channel: typeof BROKER_CHANNEL;
  view: string;
  request_id: string;
  ok: boolean;
  result?: unknown;
  error?: BrokerErrorBody;
}

export interface BrokerEvent {
  channel: typeof BROKER_CHANNEL;
  view: string;
  event_id: string;
  seq: number;
  type: string;
  timestamp: number;
  work_id?: string;
  thread_id?: string;
  payload?: unknown;
}

export interface BrokerControl {
  contracts?: Record<string, { version: number; schema_sha256: string }>;
  channel: typeof BROKER_CHANNEL;
  view: string;
  control: string;
  doors?: readonly string[];
  protocol?: number;
  tokens?: Record<string, string>;
  paths?: readonly string[];
}

export type BrokerParse =
  | { ok: true; request: BrokerRequest }
  | { ok: false; id: string; code: ErrorCode; message: string };

function carriedId(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  const candidate = (value as { request_id?: unknown }).request_id;
  return typeof candidate === "string" ? candidate : "";
}

function failed(value: unknown, code: ErrorCode, message = errorMessageFor(code)): BrokerParse {
  return { ok: false, id: carriedId(value), code, message };
}

export function parseBrokerRequest(value: unknown, view?: string): BrokerParse {
  if (typeof value !== "object" || value === null) return failed(value, "malformed_request");
  const candidate = value as Partial<BrokerRequest>;
  if (candidate.channel !== BROKER_CHANNEL) return failed(value, "stale_view");
  if (typeof view === "string" && candidate.view !== view) return failed(value, "stale_view");
  const frameView = candidate.view;
  if (typeof frameView !== "string" || frameView.trim().length === 0) {
    return failed(value, "malformed_request");
  }
  const id = candidate.request_id;
  if (typeof id !== "string" || id.trim().length === 0) {
    return failed(value, "malformed_request", "the request carries no request_id");
  }
  if (!isNamespace(candidate.namespace)) return failed(value, "malformed_request");
  const namespace = candidate.namespace;
  const operation = typeof candidate.operation === "string" ? candidate.operation : "";
  if (!isOperation(namespace, operation)) return failed(value, "unknown_operation");
  const payload = candidate.payload;
  if (payload !== undefined && (typeof payload !== "object" || payload === null || Array.isArray(payload))) {
    return failed(value, "malformed_request", "the request payload is not an object");
  }
  return {
    ok: true,
    request: {
      channel: BROKER_CHANNEL,
      view: frameView,
      request_id: id,
      namespace,
      operation,
      ...(payload === undefined ? {} : { payload }),
    },
  };
}

export function answerOk(view: string, requestId: string, result: unknown): BrokerResponse {
  return { channel: BROKER_CHANNEL, view, request_id: requestId, ok: true, result };
}

export function answerError(
  view: string,
  requestId: string,
  code: ErrorCode,
  message?: string,
  retryable?: boolean,
  cursor?: number,
): BrokerResponse {
  const said = typeof message === "string" && message.trim().length > 0 ? message : errorMessageFor(code);
  const error: BrokerErrorBody = { code, message: said, retryable: retryable ?? isRetryable(code) };
  if (typeof cursor === "number" && Number.isFinite(cursor)) error.cursor = cursor;
  return {
    channel: BROKER_CHANNEL,
    view,
    request_id: requestId,
    ok: false,
    error,
  };
}

export function requestFor(
  view: string,
  requestId: string,
  namespace: Namespace,
  operation: string,
  payload?: unknown,
): BrokerRequest {
  return payload === undefined
    ? { channel: BROKER_CHANNEL, view, request_id: requestId, namespace, operation }
    : { channel: BROKER_CHANNEL, view, request_id: requestId, namespace, operation, payload };
}
