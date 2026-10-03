// Example meeting created on first run so the app opens with something to explore.
import type { Alert, Clip, Meeting, Playlist } from '../src/types.ts';

const META = {
  "title": "Q4 platform planning",
  "date": 1790866800000,
  "duration": 2672,
  "speakers": [
    "Priya Shah",
    "Marcus Lee",
    "Hannah Berg",
    "Dana Okafor",
    "Wei Zhang",
    "Tomás Rivera"
  ],
  "summary": {
    "overview": "The platform team set the Q4 plan. Billing migration and job-queue rework phase one come first and run in parallel: billing because the legacy contract renews on January 31st, the queue because it caused 7 of September's 11 pages. Search across workspaces starts once queue phase one ships, aiming for a mid-December beta. Mobile offline moved to Q1. Open questions are the cost of separate search hosts and whether to do queue phase two.",
    "chapters": [
      {
        "start": 5,
        "title": "Goals and reliability numbers",
        "summary": "Priya sets the goal of a ranked Q4 list. Marcus reports 7 of 11 September pages came from the job queue stalling on large payloads."
      },
      {
        "start": 113,
        "title": "Search depends on the queue",
        "summary": "Dana pitches cross-workspace search (240 votes). Wei flags that sharing hosts with the queue would inherit its incidents; separate hosts cost about $4k/month."
      },
      {
        "start": 250,
        "title": "Billing migration deadline",
        "summary": "Finance needs the switch before January 31st; with the December 18th freeze, two engineers must start by mid-October."
      },
      {
        "start": 400,
        "title": "Offline mode moves to Q1",
        "summary": "Tomás joins and argues the sync-conflict design isn't settled. The group agrees to push offline to Q1; Hannah will brief sales."
      },
      {
        "start": 750,
        "title": "Capacity and queue phasing",
        "summary": "About 7.5 effective engineers. The queue rework is split: phase one (payload limits, dead letters) now, phase two reviewed in November."
      },
      {
        "start": 1010,
        "title": "Postgres upgrade",
        "summary": "Wei raises the out-of-support version; upgrade scheduled for the first week of November, separate from the queue release."
      },
      {
        "start": 1275,
        "title": "Search beta plan",
        "summary": "Search backend starts end of October for a mid-December beta. Hannah picks five beta accounts, and design starts now."
      },
      {
        "start": 1600,
        "title": "Ranking read-back and staffing",
        "summary": "Priya confirms the ranking. Billing is staffed by Sam and Ines, pending manager sign-off."
      },
      {
        "start": 1985,
        "title": "On-call during the rewrite",
        "summary": "Wei and Marcus disagree on whether the queue team carries the pager. They settle on a shadow rotation for October."
      },
      {
        "start": 2360,
        "title": "Status page and wrap-up",
        "summary": "A public queue-health status component is added to phase one. Priya will write up and share the plan."
      }
    ],
    "decisions": [
      "Q4 ranking: billing migration, queue rework phase one, search across workspaces, Postgres upgrade.",
      "Mobile offline mode moves to Q1 with a beta date to be shared with sales.",
      "Queue rework is split; only phase one is committed for Q4, phase two is reviewed at the November check-in.",
      "Postgres upgrade happens the first week of November, not in the same week as queue phase one.",
      "Queue team runs as secondary on-call under a shadow rotation through October.",
      "A public queue-health status component is part of queue phase one."
    ],
    "actions": [
      {
        "owner": "Wei Zhang",
        "text": "Get a firm monthly cost for dedicated search index hosts",
        "due": "Friday",
        "t": 195,
        "done": false
      },
      {
        "owner": "Hannah Berg",
        "text": "Tell sales offline is moving to Q1 and share the beta date",
        "due": "this week",
        "t": 477,
        "done": false
      },
      {
        "owner": "Tomás Rivera",
        "text": "Confirm the Q1 offline beta date",
        "due": "end of next week",
        "t": 486,
        "done": false
      },
      {
        "owner": "Marcus Lee",
        "text": "Ship queue phase one, including the public status component",
        "due": "end of October",
        "t": 1026,
        "done": false
      },
      {
        "owner": "Marcus Lee",
        "text": "Lead the queue phase two review at the November check-in",
        "due": "November",
        "t": 813,
        "done": false
      },
      {
        "owner": "Wei Zhang",
        "text": "Run the Postgres upgrade",
        "due": "first week of November",
        "t": 1051,
        "done": false
      },
      {
        "owner": "Hannah Berg",
        "text": "Send Dana five beta customers for search",
        "due": "Monday",
        "t": 1307,
        "done": true
      },
      {
        "owner": "Dana Okafor",
        "text": "Pair with Tomás on search results page design",
        "due": "this week",
        "t": 1325,
        "done": false
      },
      {
        "owner": "Priya Shah",
        "text": "Confirm Sam and Ines for billing with their managers",
        "due": "today",
        "t": 1656,
        "done": false
      },
      {
        "owner": "Marcus Lee",
        "text": "Set up the shadow on-call rotation for October",
        "due": "",
        "t": 2021,
        "done": false
      },
      {
        "owner": "Priya Shah",
        "text": "Write up and share the Q4 plan",
        "due": "",
        "t": 2650,
        "done": false
      }
    ],
    "people": [
      {
        "name": "Priya Shah",
        "summary": "Ran the meeting and drove it to a ranked list. Broke ties on sequencing and staffing, and read the ranking back for confirmation.",
        "commitments": [
          "Confirm Sam and Ines with their managers today",
          "Write up and share the Q4 plan"
        ],
        "asks": []
      },
      {
        "name": "Marcus Lee",
        "summary": "Brought the reliability data that put the queue at the top. Agreed to split the rework into phases as long as phase two gets a real review. Wants the queue team close to on-call.",
        "commitments": [
          "Ship queue phase one by end of October",
          "Add the public status component",
          "Run the shadow on-call rotation and report in November",
          "Own the phase two review"
        ],
        "asks": [
          "November check-in report on the shadow rotation"
        ]
      },
      {
        "name": "Hannah Berg",
        "summary": "Represented customers and finance. Established the hard January 31st billing deadline and pushed for a status page. Will handle sales messaging for the offline delay.",
        "commitments": [
          "Brief sales on offline moving to Q1",
          "Send five search beta customers by Monday",
          "Staff billing with Sam and Ines"
        ],
        "asks": []
      },
      {
        "name": "Dana Okafor",
        "summary": "Proposed search across workspaces and accepted that it depends on the queue. Proposed splitting the queue rework to free people for search.",
        "commitments": [
          "Start the index service after queue phase one",
          "Ship search beta by mid-December",
          "Pair with Tomás on results design"
        ],
        "asks": []
      },
      {
        "name": "Wei Zhang",
        "summary": "Flagged the hidden dependency between search and the queue and the Postgres end-of-support date. Pushed back on the queue team carrying the pager during the rewrite.",
        "commitments": [
          "Firm up dedicated host cost by Friday",
          "Run the Postgres upgrade first week of November"
        ],
        "asks": [
          "Cost number that decides whether search and the queue can run in parallel"
        ]
      },
      {
        "name": "Tomás Rivera",
        "summary": "Joined late from the design review. Argued for moving offline to Q1 until the sync model is settled, and proposed the shadow on-call compromise.",
        "commitments": [
          "Confirm the Q1 offline beta date by end of next week",
          "Start search results design now"
        ],
        "asks": [
          "Q1 offline beta date for Hannah and sales"
        ]
      }
    ],
    "topics": [
      "Q4 planning",
      "job queue",
      "search",
      "billing migration",
      "offline mode",
      "on-call",
      "Postgres"
    ]
  }
} as const;

const LINES = [{"t":5,"s":"Priya Shah","x":"Okay, we have everyone except Tomás, who said he'd join late. This is Q4 platform planning. The goal today is to leave with a ranked list for the quarter and owners for each item."},
  {"t":21,"s":"Marcus Lee","x":"Before we rank anything, can I give the reliability numbers? They change the conversation a bit."},
  {"t":27,"s":"Priya Shah","x":"Go ahead."},
  {"t":30,"s":"Marcus Lee","x":"We had eleven paging incidents in September. Seven of them trace back to the job queue. Median recovery was forty minutes, and two of them were over two hours. The queue is the single biggest source of on-call pain right now."},
  {"t":62,"s":"Dana Okafor","x":"Is that seven distinct root causes or the same one repeating?"},
  {"t":68,"s":"Marcus Lee","x":"Mostly the same one. Workers stall when a payload is over about two megabytes and the retry loop keeps re-enqueuing it. We patched the symptom twice."},
  {"t":84,"s":"Priya Shah","x":"So that goes near the top regardless of what else we pick."},
  {"t":89,"s":"Hannah Berg","x":"From the customer side I agree. Three of our top ten accounts filed tickets about delayed exports last month, and exports run on that queue."},
  {"t":105,"s":"Priya Shah","x":"Okay. Let's put the queue rework down as candidate one. Dana, you had the search proposal."},
  {"t":113,"s":"Dana Okafor","x":"Yes. Search across workspaces is the most requested feature on the board, two hundred and forty votes. The prototype works on a single tenant. To ship it properly we need the new index service, which is about six engineer-weeks."},
  {"t":140,"s":"Wei Zhang","x":"Six weeks assumes the index service doesn't share hosts with the queue. If it does, and the queue is still flaky, search inherits every incident Marcus just described."},
  {"t":158,"s":"Dana Okafor","x":"That's fair. I'd want the queue fixed first anyway."},
  {"t":164,"s":"Priya Shah","x":"So there's a dependency. Search after queue."},
  {"t":169,"s":"Wei Zhang","x":"Or we give the index its own hosts, but that's more cost."},
  {"t":185,"s":"Hannah Berg","x":"How much more?"},
  {"t":188,"s":"Wei Zhang","x":"Roughly four thousand a month at current volume. I can firm that up."},
  {"t":195,"s":"Priya Shah","x":"Wei, please get a real number by Friday. That decides whether we can run them in parallel."},
  {"t":202,"s":"Wei Zhang","x":"Will do."},
  {"t":250,"s":"Priya Shah","x":"Next is the billing migration. Hannah, where are we on that?"},
  {"t":256,"s":"Hannah Berg","x":"Finance wants us off the legacy billing provider before their contract renews on January 31st. If we miss it we pay for another full year. It's not glamorous but the date is hard."},
  {"t":278,"s":"Marcus Lee","x":"What's the engineering size?"},
  {"t":282,"s":"Hannah Berg","x":"Two engineers for about five weeks, plus a week of parallel running where both systems bill and we compare."},
  {"t":298,"s":"Dana Okafor","x":"Five weeks starting when? If we start in November we're cutting it close with the holiday freeze."},
  {"t":309,"s":"Hannah Berg","x":"The freeze starts December 18th. So realistically we need to start by mid-October."},
  {"t":320,"s":"Priya Shah","x":"Then billing is effectively non-negotiable and has to start in the first two weeks."},
  {"t":400,"s":"Tomás Rivera","x":"Sorry, I'm here. The design review ran over. What did I miss?"},
  {"t":406,"s":"Priya Shah","x":"Queue rework is top of the list because of incidents, search depends on it, billing has a hard January deadline. We were about to talk about the mobile offline work."},
  {"t":421,"s":"Tomás Rivera","x":"Right. So mobile offline mode. I'll be honest, after this morning's design review I think we should push it to Q1. The sync conflict design isn't settled and I don't want to staff it while we're still arguing about the model."},
  {"t":442,"s":"Hannah Berg","x":"Sales has been promising offline for a while. If we push it I need something to tell them."},
  {"t":450,"s":"Tomás Rivera","x":"We can give them a date for the beta in Q1 and show the design. That's more honest than a rushed release."},
  {"t":461,"s":"Priya Shah","x":"I'm fine with that. Does anyone object to moving offline to Q1?"},
  {"t":467,"s":"Marcus Lee","x":"No objection."},
  {"t":469,"s":"Dana Okafor","x":"None."},
  {"t":471,"s":"Priya Shah","x":"Okay, offline moves to Q1. Hannah, can you take the message to sales?"},
  {"t":477,"s":"Hannah Berg","x":"Yes, I'll talk to Rachel's team this week and send them the Q1 beta date once Tomás confirms it."},
  {"t":486,"s":"Tomás Rivera","x":"I'll have a date by the end of next week."},
  {"t":750,"s":"Priya Shah","x":"Let's talk capacity. We have nine engineers for the quarter, minus on-call rotation, so call it seven and a half effective."},
  {"t":764,"s":"Marcus Lee","x":"The queue rework is three engineers for six weeks. I've scoped it pretty carefully. Phase one is payload limits and dead-letter handling, phase two is moving to the new broker."},
  {"t":782,"s":"Wei Zhang","x":"Can phase one alone fix the paging?"},
  {"t":786,"s":"Marcus Lee","x":"Most of it. Phase one kills the stall loop. Phase two is about throughput for next year."},
  {"t":795,"s":"Dana Okafor","x":"Then do phase one now and decide on phase two after we see the numbers. That frees people for search."},
  {"t":804,"s":"Marcus Lee","x":"I can live with that if we commit to reviewing phase two in November, not leave it hanging."},
  {"t":813,"s":"Priya Shah","x":"Agreed. Phase one now, phase two review in the November planning check-in. Marcus owns the review."},
  {"t":821,"s":"Marcus Lee","x":"Okay."},
  {"t":1010,"s":"Wei Zhang","x":"One thing nobody mentioned is the Postgres upgrade. We're on a version that goes out of support in February. It's maybe a week of work but it touches everything."},
  {"t":1028,"s":"Priya Shah","x":"Can it ride along with the queue work?"},
  {"t":1032,"s":"Wei Zhang","x":"Better to do it separately, in a quiet week. I'd propose the first week of November."},
  {"t":1040,"s":"Marcus Lee","x":"That's fine as long as it's not the same week we ship queue phase one."},
  {"t":1046,"s":"Wei Zhang","x":"Phase one should be out by end of October, so we're clear."},
  {"t":1051,"s":"Priya Shah","x":"Okay, Postgres upgrade first week of November, Wei owns it."},
  {"t":1275,"s":"Dana Okafor","x":"Back to search. If the queue phase one lands end of October, I can start the index service then and ship search to beta customers by mid-December, before the freeze."},
  {"t":1291,"s":"Hannah Berg","x":"Which beta customers? I'd like to pick them. Two of the accounts that complained about exports are the loudest about search too."},
  {"t":1302,"s":"Dana Okafor","x":"That would be great. Send me a list of five."},
  {"t":1307,"s":"Hannah Berg","x":"I'll send it Monday."},
  {"t":1312,"s":"Tomás Rivera","x":"For search, design needs two weeks lead time on the results page. If Dana starts the backend at end of October, we should start design now."},
  {"t":1325,"s":"Dana Okafor","x":"Yes, let's pair on that this week."},
  {"t":1600,"s":"Priya Shah","x":"Let me read back the ranking. One, billing migration, starts this month, hard deadline January 31st. Two, queue rework phase one, three engineers, done by end of October. Three, search across workspaces, backend starts after queue phase one, beta by mid-December. Four, Postgres upgrade, first week of November. Offline moves to Q1."},
  {"t":1630,"s":"Marcus Lee","x":"Billing above the queue?"},
  {"t":1634,"s":"Priya Shah","x":"Only because the date is fixed. They run in parallel, different people."},
  {"t":1640,"s":"Marcus Lee","x":"Okay, as long as the queue gets its three people."},
  {"t":1645,"s":"Priya Shah","x":"It does. Hannah, who are your two for billing?"},
  {"t":1650,"s":"Hannah Berg","x":"I'd like Sam and Ines. They did the last provider integration."},
  {"t":1656,"s":"Priya Shah","x":"I'll confirm with their managers today."},
  {"t":1985,"s":"Wei Zhang","x":"Can we talk about on-call for a second? If the queue team is heads-down, I don't want them also carrying pager duty for the queue they're rewriting."},
  {"t":1996,"s":"Marcus Lee","x":"I actually want them on it. Nobody knows the failure modes better."},
  {"t":2002,"s":"Wei Zhang","x":"Then they'll never finish. Every incident costs them a day."},
  {"t":2007,"s":"Tomás Rivera","x":"What about a shadow rotation, someone from platform takes primary and the queue team is secondary only?"},
  {"t":2016,"s":"Marcus Lee","x":"I could try that for October and see how it goes."},
  {"t":2021,"s":"Priya Shah","x":"Let's do that. Marcus, set up the shadow rotation and report back at the November check-in alongside the phase two review."},
  {"t":2360,"s":"Hannah Berg","x":"Last thing from me. Customers keep asking for a status page that shows queue health, since exports are what they notice. Could that be part of phase one?"},
  {"t":2372,"s":"Marcus Lee","x":"A public status component is a day of work once we have the metrics. I can add it to phase one."},
  {"t":2380,"s":"Priya Shah","x":"Good. Add it."},
  {"t":2650,"s":"Priya Shah","x":"Okay, I think we're done. I'll write this up and share it. Thanks, everyone. Good meeting."},
  {"t":2658,"s":"Tomás Rivera","x":"Thanks, bye."}];

export function exampleMeeting(): Meeting {
  const meta = structuredClone(META) as unknown as Omit<Meeting, 'id' | 'lines' | 'lineCount' | 'status' | 'statusText' | 'createdAt' | 'example'>;
  return { id: 'example-q4', ...meta, lines: LINES.map(l => ({ ...l })), lineCount: LINES.length, status: 'ready', statusText: '', createdAt: Date.now(), example: true };
}

export function exampleClip(meetingId: string): Clip {
  return { id: 'example-clip', meetingId, start: 1985, end: 2025, title: 'On-call debate during the queue rewrite', createdAt: Date.now() };
}

export function examplePlaylist(clipIds: string[]): Playlist {
  return { id: 'example-playlist', name: 'Q4 planning highlights', description: 'Key moments from the Q4 platform planning call.', clipIds, createdAt: Date.now() };
}

export function exampleAlerts(): Alert[] {
  const now = Date.now();
  return [
    { id: 'example-alert-customers', keyword: 'customers', createdAt: now },
    { id: 'example-alert-deadline', keyword: 'deadline', createdAt: now + 1 },
  ];
}
