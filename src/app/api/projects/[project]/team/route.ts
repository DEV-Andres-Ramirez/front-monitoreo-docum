import type { NextRequest } from "next/server";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { JORNADA_HORAS, isProjectKey } from "@/lib/config";
import { ISO_DATE, isBusinessDay, todayISO, weekRange } from "@/lib/dates";
import { inRange, loadMembers } from "@/lib/members";
import { activityStats } from "@/lib/stats";
import type { TeamMember, TeamResponse } from "@/lib/types";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/projects/[project]/team">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);

  const param = request.nextUrl.searchParams.get("date") ?? "";
  const date = ISO_DATE.test(param) ? param : todayISO();
  const { start, end } = weekRange(date);
  const businessDay = isBusinessDay(date);

  try {
    const [rows, stats] = await Promise.all([loadMembers(project), activityStats(project, start, end)]);

    const day = new Map<string, { hours: number; count: number }>();
    const week = new Map<string, number>();
    for (const d of stats.memberDays) {
      week.set(d.employeeId, (week.get(d.employeeId) ?? 0) + d.hours);
      if (d.date === date) day.set(d.employeeId, { hours: d.hours, count: d.activities });
    }

    const members: TeamMember[] = rows
      .map((m) => ({
        memberId: m.id,
        employeeId: m.employeeId,
        name: m.name,
        email: m.email,
        role: m.role,
        allocation: m.allocation,
        assignmentType: m.assignmentType,
        startDate: m.startDate,
        endDate: m.endDate,
        inRange: inRange(m, date),
        expectedHours: Math.round(JORNADA_HORAS * m.allocation * 100) / 100,
        dayHours: day.get(m.employeeId)?.hours ?? 0,
        dayCount: day.get(m.employeeId)?.count ?? 0,
        weekHours: Math.round((week.get(m.employeeId) ?? 0) * 100) / 100,
      }))
      .sort((a, b) => b.allocation - a.allocation || a.name.localeCompare(b.name, "es"));

    const dueMembers = businessDay ? members.filter((m) => m.inRange) : [];
    const body: TeamResponse = {
      projectKey: project,
      date,
      isBusinessDay: businessDay,
      weekStart: start,
      weekEnd: end,
      members,
      totals: {
        dayHours: round(members.reduce((s, m) => s + m.dayHours, 0)),
        dayExpected: round(dueMembers.reduce((s, m) => s + m.expectedHours, 0)),
        weekHours: round(members.reduce((s, m) => s + m.weekHours, 0)),
        dayActivities: members.reduce((s, m) => s + m.dayCount, 0),
        reported: members.filter((m) => m.dayHours > 0).length,
        due: dueMembers.length,
        total: members.length,
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
