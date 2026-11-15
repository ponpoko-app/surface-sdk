export type SearchRequest = { query: string; domains?: Array<string> };
export type SearchResult = { url: string; title: string; text: string; evidence_kind: "search_snippet" | "extracted_passage"; published_at: string | null };
export type SearchResponse = { contract_version: 1; request_id: string; status: "evidence_found" | "no_evidence"; trust: "untrusted_web_content"; retrieved_at: string; results: Array<SearchResult> };
