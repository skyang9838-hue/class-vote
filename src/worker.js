// 반 투표 — 라운드별 제외/선택 투표. 상태는 Durable Object 하나("main")에 둔다.
import { ITEMS } from "./items.js";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname.startsWith("/api/")) {
      const stub = env.VOTE.get(env.VOTE.idFromName("main"));
      return stub.fetch(req);
    }
    return env.ASSETS.fetch(req);
  },
};

function randKey() {
  const a = new Uint8Array(9);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

function tally(state) {
  const counts = Object.fromEntries(state.alive.map((id) => [id, 0]));
  for (const ids of Object.values(state.votes)) for (const id of ids) if (id in counts) counts[id]++;
  return counts;
}

// 마감할 때 남길 후보를 계산한다. 경계에서 같은 표가 있으면 ties에 담는다.
function propose(state) {
  const r = state.round;
  const counts = tally(state);
  // 제외 투표: 표 적은 순으로 keep개 남김. 선택 투표: 표 많은 순으로 keep개 남김.
  const order = [...state.alive].sort((a, b) =>
    r.mode === "exclude" ? counts[a] - counts[b] : counts[b] - counts[a]
  );
  const keep = Math.min(r.keep, order.length);
  const survivors = order.slice(0, keep);
  let ties = [];
  if (keep > 0 && keep < order.length) {
    const edge = counts[order[keep - 1]];
    if (counts[order[keep]] === edge) ties = order.filter((id) => counts[id] === edge);
  }
  return { counts, survivors, ties };
}

export class VoteRoom {
  constructor(ctx) {
    this.ctx = ctx;
    this.state = null;
  }

  async load() {
    if (!this.state) this.state = (await this.ctx.storage.get("s")) || null;
    if (this.state) this.state.items = ITEMS;
    return this.state;
  }
  async save() {
    await this.ctx.storage.put("s", this.state);
  }

  fresh(adminKey, total) {
    return {
      adminKey,
      total,
      title: "우리 반 반티 투표",
      items: ITEMS,
      alive: ITEMS.map((i) => i.id),
      round: null, // {n, mode, picks, keep, open, reveal, proposal}
      votes: {}, // 번호 -> [id]
      history: [],
      roundNo: 0,
    };
  }

  publicView(s, num) {
    if (!s) return { ready: false };
    const r = s.round;
    const out = {
      ready: true,
      title: s.title,
      total: s.total,
      items: s.items.filter((i) => s.alive.includes(i.id)),
      winner: s.alive.length === 1 && !r ? s.items.find((i) => i.id === s.alive[0]) : null,
      round: r && { n: r.n, mode: r.mode, picks: r.picks, keep: r.keep, open: r.open, reveal: r.reveal },
      voted: Object.keys(s.votes).length,
      mine: num && s.votes[num] ? s.votes[num] : null,
    };
    if (r && (r.reveal || !r.open)) out.counts = tally(s);
    return out;
  }

  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const s = await this.load();

    if (req.method === "GET" && path === "/api/state") {
      return json(this.publicView(s, url.searchParams.get("num")));
    }

    if (req.method === "GET" && path === "/api/admin-state") {
      if (!s) return json({ error: "투표가 없어요" }, 403);
      const r = s.round;
      return json({
        ...s,
        adminKey: undefined,
        counts: r ? tally(s) : null,
        votedNums: Object.keys(s.votes).map(Number).sort((a, b) => a - b),
      });
    }

    if (req.method !== "POST") return json({ error: "없는 주소" }, 404);
    const body = await req.json().catch(() => ({}));

    if (path === "/api/vote") {
      if (!s || !s.round || !s.round.open) return json({ error: "지금은 투표 시간이 아니에요" }, 400);
      const num = Number(body.num);
      if (!Number.isInteger(num) || num < 0 || num > s.total) return json({ error: "번호를 확인해 주세요" }, 400);
      const ids = [...new Set(Array.isArray(body.ids) ? body.ids : [])].filter((id) => s.alive.includes(id));
      if (ids.length !== s.round.picks) return json({ error: `${s.round.picks}개를 골라 주세요` }, 400);
      s.votes[num] = ids;
      await this.save();
      return json({ ok: true });
    }

    if (path === "/api/admin") {
      const { action } = body;
      if (action === "create") {
        if (s) return json({ ok: true, key: s.adminKey });
        const key = randKey();
        this.state = this.fresh(key, Math.max(1, Math.min(40, Number(body.total) || 23)));
        await this.save();
        return json({ ok: true, key });
      }
      if (!s) return json({ error: "투표가 없어요" }, 403);

      if (action === "reset") {
        this.state = this.fresh(s.adminKey, s.total);
      } else if (action === "total") {
        s.total = Math.max(1, Math.min(40, Number(body.total) || s.total));
      } else if (action === "start") {
        if (s.round) return json({ error: "진행 중인 라운드를 먼저 끝내 주세요" }, 400);
        const mode = body.mode === "exclude" ? "exclude" : "pick";
        const n = s.alive.length;
        const picks = Math.max(1, Math.min(n - 1, Number(body.picks) || 1));
        const keep = Math.max(1, Math.min(n - 1, Number(body.keep) || 1));
        s.roundNo += 1;
        s.round = { n: s.roundNo, mode, picks, keep, open: true, reveal: !!body.reveal, proposal: null };
        s.votes = {};
      } else if (action === "reveal") {
        if (s.round) s.round.reveal = !s.round.reveal;
      } else if (action === "close") {
        if (!s.round || !s.round.open) return json({ error: "열린 라운드가 없어요" }, 400);
        s.round.open = false;
        s.round.proposal = propose(s);
      } else if (action === "reopen") {
        if (s.round) { s.round.open = true; s.round.proposal = null; }
      } else if (action === "toggle") {
        const p = s.round && s.round.proposal;
        if (!p) return json({ error: "마감 뒤에 고를 수 있어요" }, 400);
        const id = body.id;
        p.survivors = p.survivors.includes(id) ? p.survivors.filter((x) => x !== id) : [...p.survivors, id];
      } else if (action === "next") {
        const p = s.round && s.round.proposal;
        if (!p || p.survivors.length < 1) return json({ error: "남길 반티가 없어요" }, 400);
        s.history.push({
          n: s.round.n,
          mode: s.round.mode,
          picks: s.round.picks,
          counts: p.counts,
          voted: Object.keys(s.votes).length,
          survivors: p.survivors,
        });
        s.alive = s.alive.filter((id) => p.survivors.includes(id));
        s.round = null;
        s.votes = {};
      } else {
        return json({ error: "모르는 동작" }, 400);
      }
      await this.save();
      return json({ ok: true });
    }

    return json({ error: "없는 주소" }, 404);
  }
}
