import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase';
import { checkRateLimit, validateApiKey } from '@/lib/apiSecurity';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // 1. Rate limiting per IP
  const rateLimit = checkRateLimit(req);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again in 1 minute.' },
      { status: 429 }
    );
  }

  // 2. API key validation
  const apiKeyCheck = validateApiKey(req);
  if (!apiKeyCheck.valid) {
    return NextResponse.json(
      { error: apiKeyCheck.error },
      { status: 401 }
    );
  }

  // 3. Query parameter validation
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  // 4. Supabase DB query
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Database service not configured' },
      { status: 503 }
    );
  }

  try {
    let query = supabase
      .from('audit_logs')
      .select('id, user_id, score, band, features, flags, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (userId && userId.trim() && userId !== 'all' && userId !== '*') {
      query = query.eq('user_id', userId.trim());
    }

    const { data: logs, error } = await query;

    if (error) {
      console.error('Supabase audit logs fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to retrieve audit logs' },
        { status: 500 }
      );
    }

    let enrichedLogs = logs || [];
    if (enrichedLogs.length > 0) {
      // Find logs that miss baselineVector in their features
      const needsBaselineUserIds = Array.from(
        new Set(
          enrichedLogs
            .filter(l => !l.features?.baselineVector)
            .map(l => l.user_id)
        )
      );

      if (needsBaselineUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, baseline')
          .in('user_id', needsBaselineUserIds);

        if (profiles && profiles.length > 0) {
          const profileMap = new Map<string, any>();
          profiles.forEach(p => profileMap.set(p.user_id, p.baseline));

          enrichedLogs = enrichedLogs.map(log => {
            const feat = log.features || {};
            if (!feat.baselineVector && profileMap.has(log.user_id)) {
              const pb = profileMap.get(log.user_id);
              const centroid = pb?.centroid || (Array.isArray(pb?.sessions) && pb.sessions[0]) || pb;
              if (centroid) {
                const bVec = Array.isArray(centroid)
                  ? centroid
                  : [
                      centroid.avgHoldTime ?? 120,
                      centroid.avgFlightTime ?? 100,
                      centroid.wpm ?? 50,
                      centroid.holdTimeVariance ?? 25,
                      centroid.flightTimeVariance ?? 30,
                    ];
                return {
                  ...log,
                  features: {
                    ...feat,
                    baselineVector: bVec,
                  },
                };
              }
            }
            return log;
          });
        }
      }
    }

    return NextResponse.json({
      logs: enrichedLogs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown internal error';
    console.error('Audit query error:', message);
    return NextResponse.json(
      { error: 'Internal server error retrieving audit records' },
      { status: 500 }
    );
  }
}
