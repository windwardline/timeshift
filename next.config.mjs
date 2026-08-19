/** @type {import('next').NextConfig} */
const nextConfig = {
  // `next dev` detects an AI coding agent (CLAUDECODE and friends) and appends a
  // managed "nextjs-agent-rules" block to AGENTS.md — this repo's operating
  // contract — telling whoever finds the diff to commit it. A build tool editing
  // the document that governs how the repo is worked on is the owner's decision,
  // not the tool's, so it is declined here. This is Next's own documented switch
  // (`agentRules`, default true), not a workaround.
  agentRules: false,
};

export default nextConfig;
