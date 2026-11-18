export type GitState = "unversioned" | "local_commits" | "remote_configured" | "pushed";
export type GitVisibility = "public" | "private" | "unknown";
export type GitChoice = "undecided" | "declined";
export interface GitRepoView {
  folder: string;
  state: GitState;
  branch: string | null;
  head: string | null;
  remote: string | null;
  remote_slug: string | null;
  visibility: GitVisibility;
  ahead: number;
  behind: number;
  dirty: boolean;
  git_program: string | null;
  reason: string | null;
  checked_at: number | null;
  choice: GitChoice;
}
