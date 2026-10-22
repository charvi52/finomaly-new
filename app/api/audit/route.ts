import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase';
import {
  checkRateLimit,
  validateApiAuth,
  getCorsHeaders,
  handleCorsPreflight,
} from '@/lib/apiSecurity';
import { sanitizeUserId } from '@/lib/security';
import { detectHandoff, HandoffRecord } from '@/lib/handoff';

export const runtime = 'nodejs';

export async function OPTIONS(req: NextRequest) {
  return handleCorsPreflight(req);
}

export async function GET(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req);

  // 1. Rate limiting per IP
  const rateLimit = checkRateLimit(req, { routeKey: 'audit', maxRequests: 40 });
  const baseHeaders = {
    ...corsHeaders,
    'X-RateLimit-Limit': '40',
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(rateLimit.resetAt),
  };

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again in 1 minute.' },
      { status: 429, headers: baseHeaders }
    );
  }

  // 2. Base API authorization check
  const authCheck = validateApiAuth(req);
  if (!authCheck.valid) {
    return NextResponse.json(
      { error: authCheck.error || 'Unauthorized' },
      { status: 401, headers: baseHeaders }
    );
  }

  // 3. Query parameter validation
  const { searchParams } = new URL(req.url);
  const rawUserId = searchParams.get('userId');
  const isGlobalQuery = !rawUserId || rawUserId.trim() === 'all' || rawUserId.trim() === '*';
  const cleanUserId = sanitizeUserId(rawUserId || '');

  // 4. Supabase DB query
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      {
        logs: [],
        handoffStatus: null,
        handoffReason: null,
        error: 'Database service not configured',
      },
      { status: 503, headers: baseHeaders }
    );
  }

  try {
    let query = supabase
      .from('audit_logs')
      .select('id, user_id, score, band, features, flags, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (!isGlobalQuery && cleanUserId) {
      query = query.eq('user_id', cleanUserId);
    }

    const { data: logs, error } = await query;

    if (error) {
      return NextResponse.json(
        {
          logs: [],
          handoffStatus: null,
          handoffReason: null,
          error: 'Failed to retrieve audit records',
        },
        { status: 500, headers: baseHeaders }
      );
    }

    const rawLogs = (logs || []) as Array<{
      id: string;
      user_id: string;
      score: number;
      band: string;
      features: unknown;
      flags: { pasteDetected?: boolean; botSuspected?: boolean; zeroVariance?: boolean } | null;
      created_at: string;
    }>;

    // Group logs by user_id
    const logsByUser = new Map<string, typeof rawLogs>();
    for (const log of rawLogs) {
      const uid = log.user_id || 'unknown';
      const existing = logsByUser.get(uid);
      if (existing) {
        existing.push(log);
      } else {
        logsByUser.set(uid, [log]);
      }
    }

    const handoffByAccount: Record<
      string,
      { handoffStatus: string | null; handoffReason: string | null }
    > = {};

    logsByUser.forEach((userLogs, uid) => {
      try {
        // Sort each account's records by timestamp (oldest -> newest) before calling detectHandoff
        const sortedRecords = [...userLogs].sort((a, b) => {
          const tA = new Date(a.created_at).getTime() || 0;
          const tB = new Date(b.created_at).getTime() || 0;
          return tA - tB;
        });

        const handoffInputs: HandoffRecord[] = sortedRecords.map((r) => {
          let verdict = 'Match';
          const b = (r.band || '').toLowerCase();
          if (b === 'anomaly') verdict = 'Hard Flag';
          else if (b === 'rushed') verdict = 'Soft Flag';
          else if (b === 'match') verdict = 'Match';
          else verdict = r.band || 'Match';

          return {
            verdict,
            band: r.band,
            score: r.score,
            timestamp: r.created_at,
            created_at: r.created_at,
            flags: r.flags || undefined,
            pasteDetected: Boolean(r.flags?.pasteDetected),
            botSuspected: Boolean(r.flags?.botSuspected),
            zeroVariance: Boolean(r.flags?.zeroVariance),
          };
        });

        const result = detectHandoff(handoffInputs);
        handoffByAccount[uid] = {
          handoffStatus: result.status,
          handoffReason: result.reason,
        };
      } catch {
        // Catch errors per account (handoffStatus: null) so one bad row never breaks the response
        handoffByAccount[uid] = {
          handoffStatus: null,
          handoffReason: null,
        };
      }
    });

    // Extend existing logs with handoffStatus and handoffReason per record
    const enrichedLogs = rawLogs.map((log) => {
      const uid = log.user_id || 'unknown';
      const acct = handoffByAccount[uid];
      return {
        ...log,
        handoffStatus: acct ? acct.handoffStatus : null,
        handoffReason: acct ? acct.handoffReason : null,
      };
    });

    return NextResponse.json(
      {
        logs: enrichedLogs,
        handoffByAccount,
        handoffs: handoffByAccount,
        handoffStatus: cleanUserId ? (handoffByAccount[cleanUserId]?.handoffStatus ?? null) : null,
        handoffReason: cleanUserId ? (handoffByAccount[cleanUserId]?.handoffReason ?? null) : null,
      },
      { status: 200, headers: baseHeaders }
    );
  } catch {
    return NextResponse.json(
      {
        logs: [],
        handoffStatus: null,
        handoffReason: null,
        error: 'Internal server error retrieving audit records',
      },
      { status: 500, headers: baseHeaders }
    );
  }
}
