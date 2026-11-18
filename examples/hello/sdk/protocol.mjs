export const BROKER_CHANNEL = "ponpoko.surface.v1";

export const READY_CONTROL = "ponpoko.surface.ready";

export const HELLO_CONTROL = "ponpoko.host.hello";

export const PALETTE_CONTROL = "ponpoko.host.palette";

export const DROP_CONTROL = "ponpoko.host.drop";

export const PROTOCOL_VERSION = 1;

export const HOST_PLATFORM = "host.platform";

export const HOST_WORK = "host.work";

export const HOST_SURFACE = "host.surface";

export const SURFACE_OPERATIONS = ["tool.file", "tool.paste", "backend.call"]         ;

export const NAMESPACES = [HOST_PLATFORM, HOST_WORK, HOST_SURFACE]         ;



export const PLATFORM_OPERATIONS = [
  "research.search", "ai.request", "protocol.info", "providers.list", "attachments.pick", "attachments.read", "attachments.paste-image",
  "files.save", "preferences.list", "settings.open", "link.open",
]         ;



export const WORK_OPERATIONS = [
  "list",
  "get",
  "events.subscribe",
  "events.unsubscribe",
  "instruction.append",
  "pause",
  "resume",
  "stop",
]         ;



export const OPERATIONS                                       = {
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
]         ;



const ERROR_MESSAGES                            = {
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

const RETRYABLE_CODES                       = ["host_unavailable"];

export function errorMessageFor(code           )         {
  return ERROR_MESSAGES[code];
}

export function isErrorCode(value         )                     {
  return typeof value === "string" && (ERROR_CODES                     ).includes(value);
}

export function isRetryable(code           )          {
  return RETRYABLE_CODES.includes(code);
}

export function isNamespace(value         )                     {
  return typeof value === "string" && (NAMESPACES                     ).includes(value);
}

export function isOperation(namespace           , operation         )          {
  return typeof operation === "string" && OPERATIONS[namespace].includes(operation);
}



export function operationName(namespace           , operation        )         {
  return `${namespace}.${operation}`;
}

export function isBrokerChannel(value         )          {
  return value === BROKER_CHANNEL;
}





















































function carriedId(value         )         {
  if (typeof value !== "object" || value === null) return "";
  const candidate = (value                            ).request_id;
  return typeof candidate === "string" ? candidate : "";
}

function failed(value         , code           , message = errorMessageFor(code))              {
  return { ok: false, id: carriedId(value), code, message };
}

export function parseBrokerRequest(value         , view         )              {
  if (typeof value !== "object" || value === null) return failed(value, "malformed_request");
  const candidate = value                          ;
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

export function answerOk(view        , requestId        , result         )                 {
  return { channel: BROKER_CHANNEL, view, request_id: requestId, ok: true, result };
}

export function answerError(
  view        ,
  requestId        ,
  code           ,
  message         ,
  retryable          ,
  cursor         ,
)                 {
  const said = typeof message === "string" && message.trim().length > 0 ? message : errorMessageFor(code);
  const error                  = { code, message: said, retryable: retryable ?? isRetryable(code) };
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
  view        ,
  requestId        ,
  namespace           ,
  operation        ,
  payload          ,
)                {
  return payload === undefined
    ? { channel: BROKER_CHANNEL, view, request_id: requestId, namespace, operation }
    : { channel: BROKER_CHANNEL, view, request_id: requestId, namespace, operation, payload };
}
