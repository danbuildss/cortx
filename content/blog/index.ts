import { meta as post1 } from './why-x402-needs-end-to-end-monitoring';
import { meta as post2 } from './x402-failure-modes';
import { meta as post3 } from './x402-facilitators-arent-universal';
import { meta as post4 } from './measuring-x402-reliability';

export const ALL_POSTS = [post1, post2, post3, post4].sort(
  (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
);

export type PostMeta = (typeof ALL_POSTS)[number];
