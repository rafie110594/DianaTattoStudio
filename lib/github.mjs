import crypto from "node:crypto";

const API = "https://api.github.com";

function cfg() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";
  if (!token || !repo) throw new Error("GITHUB_TOKEN / GITHUB_REPO not configured");
  return { token, repo, branch };
}

async function gh(path, init = {}) {
  const { token } = cfg();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "diana-tattoo-admin",
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = (json && (json.message || json.error)) || res.statusText;
    const err = new Error(`GitHub ${res.status}: ${msg}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

export async function getRef() {
  const { repo, branch } = cfg();
  const ref = await gh(`/repos/${repo}/git/ref/heads/${branch}`);
  return ref.object.sha;
}

export async function getCommit(sha) {
  const { repo } = cfg();
  return gh(`/repos/${repo}/git/commits/${sha}`);
}

export async function getTree(treeSha) {
  const { repo } = cfg();
  return gh(`/repos/${repo}/git/trees/${treeSha}?recursive=1`);
}

export async function createBlob(base64, encoding = "base64") {
  const { repo } = cfg();
  return gh(`/repos/${repo}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: base64, encoding })
  });
}

export async function getFileSha(path) {
  const { repo, branch } = cfg();
  try {
    const data = await gh(`/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`);
    return Array.isArray(data) ? null : data.sha;
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

export async function createTree(baseTreeSha, entries) {
  const { repo } = cfg();
  return gh(`/repos/${repo}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseTreeSha, tree: entries })
  });
}

export async function createCommit(message, treeSha, parentSha, author) {
  const { repo } = cfg();
  const body = { message, tree: treeSha, parents: [parentSha] };
  if (author && author.name && author.email) body.author = author;
  return gh(`/repos/${repo}/git/commits`, { method: "POST", body: JSON.stringify(body) });
}

export async function updateRef(commitSha) {
  const { repo, branch } = cfg();
  return gh(`/repos/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commitSha, force: false })
  });
}

export function contentHash(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex").slice(0, 8);
}

/* commit a set of files atomically */
export async function commitFiles(files, message, author) {
  const parent = await getRef();
  const parentCommit = await getCommit(parent);
  const baseTree = parentCommit.tree.sha;

  const entries = [];
  for (const f of files) {
    if (f.delete) {
      entries.push({ path: f.path, mode: "100644", type: "blob", sha: null });
      continue;
    }
    const blob = f.sha ? { sha: f.sha } : await createBlob(f.base64, "base64");
    entries.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }

  const tree = await createTree(baseTree, entries);
  const commit = await createCommit(message, tree.sha, parent, author);
  await updateRef(commit.sha);
  return { sha: commit.sha, url: commit.html_url || null, files: entries.length, parent };
}

export async function readTextFile(path) {
  const { repo, branch } = cfg();
  const data = await gh(`/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`);
  if (Array.isArray(data) || !data.content) throw new Error(`GitHub: ${path} bukan file`);
  return Buffer.from(data.content, data.encoding === "base64" ? "base64" : "utf8").toString("utf8");
}

/* list all files under a repo directory (recursive), returns repo-relative paths */
export async function listFiles(dir) {
  const { repo, branch } = cfg();
  const out = [];
  const walk = async (path) => {
    let items;
    try {
      items = await gh(`/repos/${repo}/contents/${encodeURI(path)}?ref=${branch}`);
    } catch (e) {
      if (e.status === 404) return;
      throw e;
    }
    if (!Array.isArray(items)) return;
    for (const item of items) {
      if (item.type === "dir") await walk(item.path);
      else if (item.type === "file") out.push(item.path);
    }
  };
  await walk(dir);
  return out;
}
