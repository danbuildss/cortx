import { meta as post1 } from './why-x402-needs-end-to-end-monitoring';

export const ALL_POSTS = [post1].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);

export type PostMeta = (typeof ALL_POSTS)[number];
