import type { NextRequest } from "next/server";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { getWorkItems, type WorkItem } from "@/lib/azure";
import { JORNADA_HORAS, isProjectKey } from "@/lib/config";
import { ISO_DATE, addDaysISO, diffDays, eachDay, isBusinessDay, todayISO } from "@/lib/dates";
import { inRange, loadMembers } from "@/lib/members";
import { activityStats, activityTotals } from "@/lib/stats";
import type { StatsResponse } from "@/lib/types";

const MAX_RANGE_DAYS = 1100;

/** Analítica del rango [from, to]: series diarias, por persona, por tipo, por Feature y por work item. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/projects/[project]/stats">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);

  const params = request.nextUrl.searchParams;
  const to = ISO_DATE.test(params.get("to") ?? "") ? params.get("to")! : todayISO();
  const from = ISO_DATE.test(params.get("from") ?? "") ? params.get("from")! : addDaysISO(to, -13);
  const span = diffDays(from, to);
  if (span < 0 || span > MAX_RANGE_DAYS) return errorResponse(new Error("Rango de fechas inválido"), 400);
  const prevTo = addDaysISO(from, -1);
  const prevFrom = addDaysISO(prevTo, -span);

  try {
    const [members, stats, prev] = await Promise.all([
      loadMembers(project),
      activityStats(project, from, to),
      activityTotals(project, prevFrom, prevTo),
    ]);

    const expectedFor = (date: string) =>
      isBusinessDay(date) ? members.filter((m) => inRange(m, date)).reduce((s, m) => s + JORNADA_HORAS * m.allocation, 0) : 0;
    const dueFor = (date: string) => (isBusinessDay(date) ? members.filter((m) => inRange(m, date)).length : 0);

    // --- Serie diaria ---
    const byDate = new Map<string, { hours: number; activities: number; people: number }>();
    for (const d of stats.memberDays) {
      const agg = byDate.get(d.date) ?? { hours: 0, activities: 0, people: 0 };
      agg.hours += d.hours;
      agg.activities += d.activities;
      agg.people += 1;
      byDate.set(d.date, agg);
    }
    const days = eachDay(from, to);
    const daily = days.map((date) => ({
      date,
      businessDay: isBusinessDay(date),
      hours: round(byDate.get(date)?.hours ?? 0),
      activities: byDate.get(date)?.activities ?? 0,
      reported: byDate.get(date)?.people ?? 0,
      due: dueFor(date),
      expected: round(expectedFor(date)),
    }));

    // --- Por persona ---
    const perMember = new Map<string, { hours: number; activities: number; days: number }>();
    for (const d of stats.memberDays) {
      const m = perMember.get(d.employeeId) ?? { hours: 0, activities: 0, days: 0 };
      m.hours += d.hours;
      m.activities += d.activities;
      m.days += 1;
      perMember.set(d.employeeId, m);
    }
    const businessDays = days.filter(isBusinessDay);
    const byMember = members
      .map((m) => ({
        employeeId: m.employeeId,
        name: m.name,
        hours: round(perMember.get(m.employeeId)?.hours ?? 0),
        expected: round(businessDays.filter((d) => inRange(m, d)).length * JORNADA_HORAS * m.allocation),
        daysReported: perMember.get(m.employeeId)?.days ?? 0,
        activities: perMember.get(m.employeeId)?.activities ?? 0,
      }))
      .sort((a, b) => b.hours - a.hours || b.expected - a.expected || a.name.localeCompare(b.name, "es"));

    // --- Por tipo ---
    const perType = new Map<string, { hours: number; activities: number }>();
    for (const w of stats.workItems) {
      const type = w.type ?? "Otro";
      const t = perType.get(type) ?? { hours: 0, activities: 0 };
      t.hours += w.hours;
      t.activities += w.activities;
      perType.set(type, t);
    }

    // --- Por Feature (sube por el árbol de Azure, cacheado; Azure solo lectura) ---
    let azureOk = true;
    const perFeature = new Map<string, { id: number | null; title: string; hours: number }>();
    try {
      const { items } = await getWorkItems(project);
      const byId = new Map(items.map((w) => [w.id, w]));
      const featureOf = (id: number): WorkItem | null => {
        let current = byId.get(id);
        for (let i = 0; i < 8 && current; i++) {
          if (current.type === "Feature") return current;
          current = current.parentId ? byId.get(current.parentId) : undefined;
        }
        return null;
      };
      for (const w of stats.workItems) {
        const feature = featureOf(w.workItemId);
        const key = feature ? String(feature.id) : "none";
        const f = perFeature.get(key) ?? { id: feature?.id ?? null, title: feature?.title ?? "Sin feature", hours: 0 };
        f.hours += w.hours;
        perFeature.set(key, f);
      }
    } catch {
      azureOk = false;
    }

    const body: StatsResponse = {
      projectKey: project,
      from,
      to,
      azureOk,
      daily,
      byMember,
      memberDays: stats.memberDays.map((d) => ({ ...d, hours: round(d.hours) })),
      byType: [...perType.entries()].map(([type, v]) => ({ type, hours: round(v.hours), activities: v.activities })),
      byFeature: [...perFeature.values()].map((f) => ({ ...f, hours: round(f.hours) })).sort((a, b) => b.hours - a.hours),
      byWorkItem: stats.workItems.map((w) => ({
        workItemId: w.workItemId,
        hours: round(w.hours),
        activities: w.activities,
        employeeIds: w.employeeIds,
      })),
      totals: {
        hours: round(daily.reduce((s, d) => s + d.hours, 0)),
        activities: daily.reduce((s, d) => s + d.activities, 0),
        expected: round(daily.reduce((s, d) => s + d.expected, 0)),
        prevHours: round(prev.hours),
        prevExpected: round(eachDay(prevFrom, prevTo).reduce((s, d) => s + expectedFor(d), 0)),
        prevActivities: prev.activities,
      },
    };
    return Response.json(body);
  } catch (error) {
    return errorResponse(error);
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
