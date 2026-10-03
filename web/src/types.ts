// Shared between the React app and the API server.

export interface Line {
  t: number; // seconds from meeting start
  s: string; // speaker
  x: string; // text
}

export interface Chapter { start: number; title: string; summary: string }
export interface ActionItem { owner: string; text: string; due: string; t: number; done: boolean }
export interface Person { name: string; summary: string; commitments: string[]; asks: string[] }

export interface Summary {
  overview: string;
  chapters: Chapter[];
  decisions: string[];
  actions: ActionItem[];
  people: Person[];
  topics: string[];
}

export type MeetingStatus = 'ready' | 'summarizing' | 'failed' | 'nosummary';

export interface MeetingMeta {
  id: string;
  title: string;
  date: number;
  duration: number;
  speakers: string[];
  lineCount: number;
  status: MeetingStatus;
  statusText: string;
  summary: Summary | null;
  createdAt: number;
  example?: boolean;
  /** Per speaker (same order as `speakers`), which of TALK_BUCKETS time slices they spoke in. List responses only. */
  talkMap?: number[][];
}

export const TALK_BUCKETS = 48;

export interface Meeting extends MeetingMeta {
  lines: Line[];
}

export interface Clip {
  id: string;
  meetingId: string;
  start: number;
  end: number;
  title: string;
  createdAt: number;
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

export interface Playlist {
  id: string;
  name: string;
  description: string;
  clipIds: string[];
  createdAt: number;
}

export interface Alert { id: string; keyword: string; createdAt: number }

export interface AlertMatch {
  alertId: string;
  meetingId: string;
  title: string;
  date: number;
  t: number;
  s: string;
  x: string;
}

export const DEAL_STAGES = ['Discovery', 'Demo', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export interface Deal {
  id: string;
  name: string;
  company: string;
  stage: DealStage;
  value: number;
  meetingIds: string[];
  createdAt: number;
}

export interface MemberStats {
  name: string;
  calls: number;
  talkSeconds: number;
  /** Average share of talk time in the calls they joined, 0-1. */
  talkShare: number;
  /** Average longest uninterrupted stretch per call, in seconds. */
  longestMonologue: number;
  /** Average questions asked per call. */
  questionsPerCall: number;
  lastCall: number;
}

export interface TeamStats {
  calls: number;
  totalSeconds: number;
  callsByWeek: number[]; // last 8 weeks, oldest first
  members: MemberStats[];
}
