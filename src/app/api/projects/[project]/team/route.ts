import type { NextRequest } from "next/server";
import { errorResponse, isAuthenticated, unauthorizedResponse } from "@/lib/auth";
import { JORNADA_HORAS, isProjectKey } from "@/lib/config";
import { ISO_DATE, todayISO, weekRange } from "@/lib/dates";
import { db } from "@/lib/supabase";
import type { TeamMember, TeamResponse } from "@/lib/types";

type MemberRow = {
  id: string;
  role: string;
  allocation: number | string;
  start_date: string | null;
  end_date: string | null;
  assignment_type: string;
  employee: { id: string; full_name: string; email: string | null };
};

export async function GET(request: NextRequest, ctx: RouteContext<"/api/projects/[project]/team">) {
  if (!(await isAuthenticated())) return unauthorizedResponse();
  const { project } = await ctx.params;
  if (!isProjectKey(project)) return errorResponse(new Error("Proyecto no válido"), 404);

  const param = request.nextUrl.searchParams.get("date") ?? "";
  const date = ISO_DATE.test(param) ? param : todayISO();
  const { start, end } = weekRange(date);

  try {
    const [membersRes, logsRes] = await Promise.all([
      db()
        .from("project_members")
        .select("id, role, allocation, start_date, end_date, assignment_type, employee:employees!inner(id, full_name, email)")
        .eq("project_key", project)
        .eq("active", true),
      db()
        .from("activity_logs")
        .select("employee_id, work_date, hours")
        .eq("project_key", project)
        .is("deleted_at", null)
        .gte("work_date", start)
        .lte("work_date", end),
    ]);
    if (membersRes.error) throw new Error(membersRes.error.message);
    if (logsRes.error) throw new Error(logsRes.error.message);

    const day = new Map<string, { hours: number; count: number }>();
    const week = new Map<string, number>();
    for (const log of logsRes.data) {
      const hours = Number(log.hours);
      week.set(log.employee_id, (week.get(log.employee_id) ?? 0) + hours);
      if (log.work_date === date) {
        const d = day.get(log.employee_id) ?? { hours: 0, count: 0 };
        day.set(log.employee_id, { hours: d.hours + hours, count: d.count + 1 });
      }
    }

    const members: TeamMember[] = (membersRes.data as unknown as MemberRow[])
      .map((m) => {
        const allocation = Number(m.allocation);
        const inRange = (!m.start_date || m.start_date <= date) && (!m.end_date || m.end_date >= date);
        return {
          memberId: m.id,
          employeeId: m.employee.id,
          name: m.employee.full_name,
          email: m.employee.email,
          role: m.role,
          allocation,
          assignmentType: m.assignment_type,
          startDate: m.start_date,
          endDate: m.end_date,
          inRange,
          expectedHours: Math.round(JORNADA_HORAS * allocation * 100) / 100,
          dayHours: day.get(m.employee.id)?.hours ?? 0,
          dayCount: day.get(m.employee.id)?.count ?? 0,
          weekHours: week.get(m.employee.id) ?? 0,
        };
      })
      .sort((a, b) => b.allocation - a.allocation || a.name.localeCompare(b.name, "es"));

    const body: TeamResponse = {
      projectKey: project,
      date,
      weekStart: start,
      weekEnd: end,
      members,
      totals: {
        dayHours: members.reduce((s, m) => s + m.dayHours, 0),
        weekHours: members.reduce((s, m) => s + m.weekHours, 0),
        dayActivities: members.reduce((s, m) => s + m.dayCount, 0),
        reported: members.filter((m) => m.dayHours > 0).length,
        total: members.length,
      },
    };
    return Response.json(body);
  } catch (error) {
    return errorResponse(error);
  }
}
