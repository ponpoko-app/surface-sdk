import { readFile } from "node:fs/promises";

function fail(code, message, details = {}) { return Object.assign(new Error(message), details, {code}); }
export function createBackendResearch({ control = process.env.PONPOKO_HOST_CONTROL, surfaceId = process.env.PONPOKO_SURFACE_ID } = {}) {
  return Object.freeze({ async search(input) {
    if (!control || !surfaceId) throw fail("host_unavailable", "The Host backend environment is missing.");
    const endpoint = JSON.parse(await readFile(control, "utf8"));
    const url = new URL(endpoint.url);
    if (endpoint.protocol !== 1 || url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.username || url.password || url.search || url.hash || typeof endpoint.token !== "string" || !endpoint.token) throw fail("invalid_input", "Invalid Host control endpoint.");
    const request_id = crypto.randomUUID();
    let response, answer;
    try {
      response = await fetch(url, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${endpoint.token}` },
        body: JSON.stringify({ protocol: 1, verb: "runtime", surface_id: surfaceId, extra: {operation: "research.search", input, request_id} }),
      });
      answer = await response.json();
    } catch { throw fail("search_outcome_unknown", "Search response was not confirmed. Do not repeat automatically.", {request_id}); }
    if (!response.ok || answer.ok !== true) throw fail("host_unavailable", "The Host could not accept search.", {request_id});
    if (answer.snapshot?.ok !== true) {
      const error = answer.snapshot?.error;
      throw fail(error?.code ?? "search_outcome_unknown", error?.message ?? "Search response was not confirmed.", {...error, request_id, cloud_request_id: error?.request_id});
    }
    const result = answer.snapshot.result;
    if (result?.contract_version !== 1 || result.trust !== "untrusted_web_content" || !Array.isArray(result.results) || result.results.length > 5) throw fail("search_invalid_response", "The Host returned unsupported search evidence.", {request_id});
    return result;
  } });
}
