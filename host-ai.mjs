export const SCHEMA = {"$schema":"https://json-schema.org/draft/2020-12/schema","$id":"ponpoko.host.ai.v1","contract_version":1,"title":"Ponpoko Host AI API","description":"Provider-neutral inference through registered surface identity. Validation and setup inspection never call a model.","$defs":{"ModelIo":{"type":"object","properties":{"inputs":{"type":"array","minItems":1,"maxItems":16,"uniqueItems":true,"items":{"type":"string","minLength":1,"maxLength":32,"pattern":"^[a-z0-9_-]+$"}},"outputs":{"type":"array","minItems":1,"maxItems":16,"uniqueItems":true,"items":{"type":"string","minLength":1,"maxLength":32,"pattern":"^[a-z0-9_-]+$"}}},"required":["inputs","outputs"],"additionalProperties":false},"InputPart":{"type":"object","properties":{"type":{"type":"string","minLength":1,"maxLength":32,"pattern":"^[a-z0-9_-]+$"},"text":{"type":["string","null"]},"role":{"enum":["user","assistant","system",null]},"url":{"type":["string","null"]},"data_base64":{"type":["string","null"]},"mime_type":{"type":["string","null"]},"name":{"type":["string","null"]},"value":{}},"required":["type"],"additionalProperties":false,"anyOf":[{"required":["text"],"properties":{"text":{"type":"string"}}},{"required":["url"],"properties":{"url":{"type":"string"}}},{"required":["data_base64"],"properties":{"data_base64":{"type":"string"}}},{"required":["value"],"properties":{"value":{"not":{"type":"null"}}}}],"allOf":[{"if":{"properties":{"type":{"const":"text"}}},"then":{"required":["text"],"properties":{"text":{"type":"string"}}}}]},"InferenceOptions":{"type":"object","properties":{"temperature":{"type":"number"},"max_tokens":{"type":"number"},"count":{"type":"number"},"dimensions":{"type":"number"},"top_n":{"type":"number"},"seed":{"type":"number"},"speed":{"type":"number"},"duration":{"type":"number"},"voice":{"type":"string"},"format":{"type":"string"},"size":{"type":"string"},"query":{"type":"string"},"language":{"type":"string"},"aspect_ratio":{"type":"string"},"tools":{"type":"array","items":{"type":"object"}}},"required":[],"additionalProperties":false},"InferenceRequest":{"type":"object","properties":{"request_id":{"type":"string","minLength":1,"maxBytes":128},"io":{"$ref":"#/$defs/ModelIo"},"input":{"type":"array","minItems":1,"maxItems":256,"items":{"$ref":"#/$defs/InputPart"}},"options":{"$ref":"#/$defs/InferenceOptions"},"stream":{"type":"boolean"},"budget":{"type":"object","properties":{"seconds":{"type":"integer","minimum":1,"maximum":600},"output_bytes":{"type":"integer","minimum":1,"maximum":33554432}},"required":["seconds","output_bytes"],"additionalProperties":false}},"required":["request_id","io","input","budget"],"additionalProperties":false},"AiEnvelope":{"type":"object","properties":{"operation":{"enum":["contract","validate","invoke","invoke_lookup","invoke_status","invoke_events","invoke_stop","invoke_job_status","invoke_job_cancel","slots","usage"]},"contract_version":{"const":1},"input":{"$ref":"#/$defs/InferenceRequest"},"request_id":{"type":"string","minLength":1,"maxBytes":128},"after":{"type":"integer","minimum":0,"maximum":9007199254740991},"check_setup":{"type":"boolean"}},"required":["operation","contract_version"],"additionalProperties":false,"allOf":[{"if":{"properties":{"operation":{"enum":["invoke","validate"]}}},"then":{"required":["input"]}},{"if":{"properties":{"operation":{"enum":["invoke_lookup","invoke_status","invoke_events","invoke_stop","invoke_job_status","invoke_job_cancel"]}}},"then":{"required":["request_id"]}}]},"OutputPart":{"type":"object","properties":{"type":{"type":"string"},"text":{"type":["string","null"]},"url":{"type":["string","null"]},"data_base64":{"type":["string","null"]},"mime_type":{"type":["string","null"]},"value":{},"index":{"type":["integer","null"]}},"required":["type"],"additionalProperties":true},"InferenceResult":{"type":"object","properties":{"output":{"type":"array","items":{"$ref":"#/$defs/OutputPart"}},"usage":{},"job":{"type":"object","properties":{"id":{"type":"string"},"status":{"type":"string"},"progress":{},"error":{}},"required":["id","status"],"additionalProperties":false}},"required":["output"],"additionalProperties":false}},"$ref":"#/$defs/AiEnvelope","examples":[{"operation":"invoke","contract_version":1,"input":{"request_id":"example-lantern","io":{"inputs":["text"],"outputs":["image"]},"input":[{"type":"text","text":"A paper lantern"}],"budget":{"seconds":120,"output_bytes":1048576}}}]};
export const CONTRACT = {"version":1,"schema_sha256":"d7f73a2bf923779ce0612ba2ed918503843a31fc96a8bdd2b2725f9bcda758cd"};
export function validateSchema(root, schema, value, path = "$") {
  const fail = message => { throw Object.assign(new Error(`${path}: ${message}`), { code: "invalid_input", path }); };
  if (schema.$ref) return validateSchema(root, root.$defs[schema.$ref.split("/").at(-1)], value, path);
  const matches = candidate => { try { validateSchema(root, candidate, value, path); return true; } catch { return false; } };
  if (schema.anyOf && !schema.anyOf.some(matches)) fail("does not match an allowed shape");
  if (schema.not && matches(schema.not)) fail("has a disallowed value");
  for (const child of schema.allOf || []) validateSchema(root, child, value, path);
  if (schema.if && matches(schema.if) && schema.then) validateSchema(root, schema.then, value, path);
  if ("const" in schema && value !== schema.const) fail(`must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) fail(`must be one of ${JSON.stringify(schema.enum)}`);
  const kind = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.includes(kind) && !(kind === "number" && types.includes("integer") && Number.isSafeInteger(value))) fail(`must be ${types.join(" or ")}`);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) fail("must be finite");
    if (schema.minimum !== undefined && value < schema.minimum) fail(`must be at least ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) fail(`must be at most ${schema.maximum}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && Array.from(value).length < schema.minLength) fail("is too short");
    if (schema.maxLength !== undefined && Array.from(value).length > schema.maxLength) fail("is too long");
    if (schema.maxBytes !== undefined && new TextEncoder().encode(value).length > schema.maxBytes) fail("exceeds its byte bound");
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail("has an invalid format");
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) fail("has too few items");
    if (schema.maxItems !== undefined && value.length > schema.maxItems) fail("has too many items");
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) fail("must have unique items");
    if (schema.items) value.forEach((item, index) => validateSchema(root, schema.items, item, `${path}[${index}]`));
  } else if (value && typeof value === "object") {
    for (const key of schema.required || []) if (!Object.hasOwn(value, key)) fail(`missing ${key}`);
    for (const key of Object.keys(value)) {
      if (Object.hasOwn(schema.properties || {}, key)) validateSchema(root, schema.properties[key], value[key], `${path}.${key}`);
      else if (schema.additionalProperties === false) fail(`unexpected field ${key}`);
    }
  }
  return value;
}
const TOKENS_PER_MEDIA = 1500;
const DEFAULT_RESERVED_OUTPUT = 8192;
const HARD_INPUT_BYTES = 12 * 1024 * 1024;
const UTF8 = new TextEncoder();

function positiveInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

function clampRatio(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value < 1 ? value : fallback;
}

function supportsIo(offered, required) {
  if (!offered || !required || !Array.isArray(offered.inputs) || !Array.isArray(offered.outputs)) return false;
  return required.inputs.every(item => offered.inputs.includes(item))
    && required.outputs.every(item => offered.outputs.includes(item));
}

function phaseRank(slotPhase, requested) {
  const normalized = slotPhase ?? null;
  if (requested) {
    if (normalized === requested) return 0;
    if (normalized === null) return 1;
    return 2;
  }
  return normalized === null ? 0 : 1;
}

function ioSize(io) {
  return (io?.inputs?.length ?? 0) + (io?.outputs?.length ?? 0);
}

function computeBudget(source, maxContext, maxBytes, maxOutput, options = {}) {
  const triggerRatio = clampRatio(options.trigger_ratio, 0.75);
  const targetRatio = Math.min(clampRatio(options.target_ratio, 0.5), triggerRatio);
  const resolvedOutput = positiveInt(options.max_output_tokens) ?? maxOutput;
  let safeInput = null;
  let triggerTokens = null;
  let targetTokens = null;
  if (maxContext !== null) {
    const reserved = Math.min(resolvedOutput ?? DEFAULT_RESERVED_OUTPUT, Math.floor(maxContext / 4));
    safeInput = Math.max(1024, maxContext - reserved);
    triggerTokens = Math.max(1024, Math.floor(safeInput * triggerRatio));
    targetTokens = Math.max(512, Math.floor(safeInput * targetRatio));
  }
  const triggerBytes = maxBytes !== null ? Math.max(4096, Math.floor(maxBytes * triggerRatio)) : null;
  const targetBytes = maxBytes !== null ? Math.max(2048, Math.floor(maxBytes * targetRatio)) : null;
  return {
    source,
    max_context_tokens: maxContext,
    max_input_bytes: maxBytes,
    max_output_tokens: resolvedOutput,
    safe_input_tokens: safeInput,
    trigger_tokens: triggerTokens,
    target_tokens: targetTokens,
    trigger_bytes: triggerBytes,
    target_bytes: targetBytes,
  };
}

export function resolveContextBudget(slots, io, options = {}) {
  const localMatches = (slots?.local ?? [])
    .filter(slot => supportsIo(slot?.io, io))
    .sort((a, b) => ioSize(a.io) - ioSize(b.io) || String(a.provider_id).localeCompare(String(b.provider_id)));
  if (localMatches.length > 0) {
    const chosen = localMatches[0];
    return computeBudget("local", positiveInt(chosen.context_length), null, null, options);
  }
  const phase = options.phase ?? null;
  const cloudMatches = (slots?.cloud ?? [])
    .filter(slot => slot?.enabled && slot?.status === "active" && supportsIo(slot?.io, io) && (!phase || !slot.phase || slot.phase === phase))
    .sort((a, b) =>
      phaseRank(a.phase, phase) - phaseRank(b.phase, phase)
      || ioSize(a.io) - ioSize(b.io)
      || (a.position ?? 0) - (b.position ?? 0)
      || String(a.slot_id).localeCompare(String(b.slot_id)),
    );
  if (cloudMatches.length > 0) {
    const chosen = cloudMatches[0];
    return computeBudget(
      "cloud",
      positiveInt(chosen.context_length),
      positiveInt(chosen.max_input_bytes),
      positiveInt(chosen.max_output_tokens),
      options,
    );
  }
  return computeBudget("none", null, null, null, options);
}

function estimateTextTokens(text) {
  if (!text) return 0;
  const bytes = UTF8.encode(text);
  let ascii = 0;
  let nonAscii = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] < 128) ascii += 1;
    else nonAscii += 1;
  }
  return Math.ceil(ascii / 4) + Math.ceil(nonAscii / 2);
}

function utf8ByteLength(text) {
  return text ? UTF8.encode(text).length : 0;
}

function sliceHeadBytes(text, maxBytes) {
  if (!text || utf8ByteLength(text) <= maxBytes) return text ?? "";
  let used = 0;
  let out = "";
  for (const ch of text) {
    const size = utf8ByteLength(ch);
    if (used + size > maxBytes) break;
    used += size;
    out += ch;
  }
  return out;
}

function sliceTailBytes(text, maxBytes) {
  if (!text || utf8ByteLength(text) <= maxBytes) return text ?? "";
  const chars = Array.from(text);
  let used = 0;
  let start = chars.length;
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const size = utf8ByteLength(chars[i]);
    if (used + size > maxBytes) break;
    used += size;
    start = i;
  }
  return chars.slice(start).join("");
}

function trimPartText(text, cap) {
  const totalBytes = utf8ByteLength(text);
  if (totalBytes <= cap) return text;
  const head = sliceHeadBytes(text, Math.floor((cap * 2) / 3));
  const tail = sliceTailBytes(text, Math.floor(cap / 4));
  return `${head}\n\n[Compacted from ${totalBytes} bytes to fit the model context budget.]\n\n${tail}`;
}

export function estimateInputTokens(input, options = {}) {
  const overheadBytes = positiveInt(options.overhead_bytes) ?? 0;
  const overheadTokens = positiveInt(options.overhead_tokens) ?? Math.ceil(overheadBytes / 3);
  let tokens = overheadTokens;
  let bytes = overheadBytes;
  let images = 0;
  for (const part of Array.isArray(input) ? input : []) {
    if (!part || typeof part !== "object") continue;
    tokens += 8;
    bytes += 48;
    if (typeof part.text === "string") {
      tokens += estimateTextTokens(part.text);
      bytes += utf8ByteLength(part.text);
    }
    if (part.type !== "text" && (typeof part.data_base64 === "string" || typeof part.url === "string")) {
      tokens += TOKENS_PER_MEDIA;
      images += 1;
      if (typeof part.data_base64 === "string") bytes += part.data_base64.length;
      if (typeof part.url === "string") bytes += utf8ByteLength(part.url);
    }
    if (part.value !== undefined && part.value !== null) {
      const encoded = JSON.stringify(part.value);
      tokens += estimateTextTokens(encoded);
      bytes += utf8ByteLength(encoded);
    }
  }
  const lastTokens = positiveInt(options.last_input_tokens);
  const lastBytes = positiveInt(options.last_sent_bytes);
  if (lastTokens !== null && lastBytes !== null) {
    if (bytes >= lastBytes) {
      tokens = Math.max(tokens, lastTokens + Math.ceil((bytes - lastBytes) / 3));
    } else {
      tokens = Math.max(tokens, Math.floor((lastTokens * bytes) / lastBytes));
    }
  }
  return { tokens, bytes, images };
}

function summarizeOmitted(omitted, maxBytes, header) {
  let out = `${header || "[Compacted earlier conversation context]"} (${omitted.length} earlier entries summarized)\n`;
  const firstUser = omitted.find(part => part.type === "text" && (part.role ?? "user") === "user" && typeof part.text === "string" && part.text.trim());
  if (firstUser) {
    out += `\nInitial request:\n${sliceHeadBytes(firstUser.text.trim(), 1200)}\n`;
  }
  const notes = [];
  for (const part of omitted) {
    const role = part.role ?? "user";
    if (part.type === "text" && typeof part.text === "string") {
      const compact = part.text.replace(/\s+/g, " ").trim();
      if (compact) notes.push(`- ${role}: ${sliceHeadBytes(compact, 240)}`);
    } else {
      notes.push(`- ${role}: [omitted ${part.type} attachment: ${part.name || part.type}]`);
    }
  }
  if (notes.length > 0) {
    out += "\nKey earlier turns:\n";
    for (const line of notes.slice(-12)) out += `${line}\n`;
  }
  if (utf8ByteLength(out) > maxBytes) {
    return `${sliceHeadBytes(out, Math.max(256, maxBytes - 80))}\n[Summary trimmed to fit model context budget.]`;
  }
  return out;
}

function compactAtLevel(input, level, budget, options) {
  const preserveSystem = options.preserve_system !== false;
  const systemParts = [];
  const bodyParts = [];
  for (const part of input) {
    if (preserveSystem && part?.role === "system") systemParts.push(part);
    else bodyParts.push(part);
  }
  const defaultKeep = [6, 4, 2, 1, 1][Math.min(level, 4)];
  const keepRecent = positiveInt(options.keep_recent) !== null ? Math.min(options.keep_recent, defaultKeep) : defaultKeep;
  const baseSummaryCap = [16000, 10000, 6000, 3500, 2000][Math.min(level, 4)];
  const summaryCap = budget.target_tokens
    ? Math.min(baseSummaryCap, Math.max(1500, Math.floor((budget.target_tokens * 2) / 3)))
    : baseSummaryCap;
  const partCap = [32000, 16000, 8000, 4000, 2000][Math.min(level, 4)];
  const systemCap = [Infinity, Infinity, 24000, 12000, 6000][Math.min(level, 4)];
  const next = [];
  for (const sys of systemParts) {
    if (typeof sys.text === "string" && utf8ByteLength(sys.text) > systemCap) {
      next.push({ ...sys, text: trimPartText(sys.text, systemCap) });
    } else {
      next.push({ ...sys });
    }
  }
  let omittedParts = 0;
  let kept = bodyParts;
  if (bodyParts.length > keepRecent) {
    const split = bodyParts.length - keepRecent;
    omittedParts = split;
    next.push({ type: "text", role: "user", text: summarizeOmitted(bodyParts.slice(0, split), summaryCap, options.summary_header) });
    kept = bodyParts.slice(split);
  }
  const dropMedia = level >= 2;
  let droppedMedia = 0;
  for (const part of kept) {
    if (part.type !== "text" && dropMedia) {
      droppedMedia += 1;
      continue;
    }
    if (level >= 1 && typeof part.text === "string" && utf8ByteLength(part.text) > partCap) {
      next.push({ ...part, text: trimPartText(part.text, partCap) });
    } else {
      next.push({ ...part });
    }
  }
  if (droppedMedia > 0) {
    next.push({ type: "text", role: "user", text: `[Compaction note: ${droppedMedia} media attachment(s) omitted to fit the model context budget.]` });
  }
  return { input: next, omittedParts: omittedParts + droppedMedia };
}

export function compactInputParts(input, budget = {}, options = {}) {
  const parts = Array.isArray(input) ? input : [];
  const normalized = budget && typeof budget === "object" && (budget.trigger_tokens !== undefined || budget.target_tokens !== undefined)
    ? budget
    : computeBudget("custom", positiveInt(budget?.max_context_tokens), positiveInt(budget?.max_input_bytes), positiveInt(budget?.max_output_tokens), options);
  const initial = estimateInputTokens(parts, options);
  const overTrigger = initial.bytes > HARD_INPUT_BYTES
    || (normalized.trigger_tokens !== null && initial.tokens >= normalized.trigger_tokens)
    || (normalized.trigger_bytes !== null && initial.bytes >= normalized.trigger_bytes);
  const explicitLevel = typeof options.level === "number" && Number.isInteger(options.level) ? Math.max(0, Math.min(4, options.level)) : null;
  if (!options.force && explicitLevel === null && !overTrigger) {
    return { input: parts.map(part => ({ ...part })), compacted: false, omitted_parts: 0, estimated_tokens: initial.tokens, estimated_bytes: initial.bytes, level: 0 };
  }
  const levels = explicitLevel !== null ? [explicitLevel] : [0, 1, 2, 3, 4];
  let best = { input: parts.map(part => ({ ...part })), omittedParts: 0 };
  let bestEst = initial;
  let usedLevel = levels[0];
  for (const level of levels) {
    const candidate = compactAtLevel(parts, level, normalized, options);
    const est = estimateInputTokens(candidate.input, options);
    best = candidate;
    bestEst = est;
    usedLevel = level;
    const underTarget = est.bytes <= HARD_INPUT_BYTES
      && (normalized.target_tokens === null || est.tokens <= normalized.target_tokens)
      && (normalized.target_bytes === null || est.bytes <= normalized.target_bytes);
    if (underTarget) break;
  }
  const compacted = best.omittedParts > 0 || bestEst.bytes < initial.bytes || bestEst.tokens < initial.tokens;
  return {
    input: best.input,
    compacted,
    omitted_parts: best.omittedParts,
    estimated_tokens: bestEst.tokens,
    estimated_bytes: bestEst.bytes,
    level: usedLevel,
  };
}
export function uncertainAiOperation(operation) {
  return ["invoke", "invoke_stop", "invoke_job_cancel"].includes(operation);
}

export class AiRequestError extends Error {
  constructor({ code, message, io }, request_id) {
    super(message);
    this.name = "AiRequestError";
    Object.assign(this, { code, io, request_id });
  }
}

export function createHostAi(transport) {
  async function request(operation, payload = {}, options) {
    const envelope = { ...payload, operation, contract_version: CONTRACT.version };
    const requestId = envelope.input?.request_id ?? envelope.request_id;
    try { validateSchema(SCHEMA, SCHEMA, envelope); }
    catch (error) { throw new AiRequestError(error, requestId); }
    if (envelope.input?.input.some(part => part.type === "text" && typeof part.text !== "string")) throw new AiRequestError({ message: "Text input requires text.", code: "invalid_input" }, requestId);
    let answer;
    try { answer = await transport(envelope, options); }
    catch (error) { if (error && typeof error === "object") { error.request_id ??= envelope.input?.request_id ?? envelope.request_id; } throw error; }
    if (answer?.ok === false) throw new AiRequestError({ code: "ai_unavailable", ...answer.error, message: answer.error?.message || "Host AI request failed." }, requestId);
    return answer?.ok === true ? answer.result : answer;
  }
  return Object.freeze({
    contractVersion: CONTRACT.version,
    contract: options => request("contract", {}, options),
    invoke: (input, options) => request("invoke", { input }, options),
    validate: (input, checkSetup = false, options) => request("validate", { input, check_setup: checkSetup }, options),
    lookup: (request_id, options) => request("invoke_lookup", { request_id }, options),
    status: (request_id, options) => request("invoke_status", { request_id }, options),
    events: (request_id, after = 0, options) => request("invoke_events", { request_id, after }, options),
    stop: (request_id, options) => request("invoke_stop", { request_id }, options),
    jobStatus: (request_id, options) => request("invoke_job_status", { request_id }, options),
    jobCancel: (request_id, options) => request("invoke_job_cancel", { request_id }, options),
    slots: options => request("slots", {}, options),
    usage: options => request("usage", {}, options),
    contextBudget: async (io, options = {}) => {
      const slots = await request("slots", {}, options);
      return resolveContextBudget(slots, io, options);
    },
    compactInput: async (input, io, options = {}) => {
      const slots = await request("slots", {}, options);
      const budget = resolveContextBudget(slots, io, options);
      return compactInputParts(input, budget, options);
    },
  });
}
