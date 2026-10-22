import { createServerSupabaseClient } from "@/lib/supabase/server";
import { liveEventSchema } from "@/lib/live-event";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 800;
const ERROR_BACKOFF_MS = 5000;

function delay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timer);
      resolve();
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
  });
}

/**
 * Server-sent events for signed-in sessions. Catalogue changes are written by
 * a database trigger; this stream forwards rows inserted after the client
 * connected (or after the Last-Event-ID it sends on reconnect).
 */
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Sign in required", { status: 401 });
  }

  const lastEventId = Number(request.headers.get("last-event-id"));
  let cursor = Number.isSafeInteger(lastEventId) && lastEventId >= 0 ? lastEventId : 0;
  if (cursor === 0) {
    const { data, error } = await supabase
      .from("storefront_events")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error("[events] failed to read the latest storefront event", error);
    } else if (data) {
      cursor = data.id;
    }
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const stop = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      request.signal.addEventListener("abort", stop, { once: true });
      send("retry: 2000\n\n");
      send(": connected\n\n");

      const pump = async () => {
        while (!request.signal.aborted && !closed) {
          let waitMs = POLL_MS;
          const { data, error } = await supabase
            .from("storefront_events")
            .select("id, event_type, message, product_id, created_at")
            .gt("id", cursor)
            .order("id", { ascending: true })
            .limit(25);

          if (error) {
            console.error("[events] poll failed", error);
            waitMs = ERROR_BACKOFF_MS;
          } else {
            for (const row of data ?? []) {
              cursor = row.id;
              const parsed = liveEventSchema.safeParse({
                id: row.id,
                type: row.event_type,
                message: row.message,
                productId: row.product_id,
                at: row.created_at,
              });
              if (!parsed.success) continue;
              send(`id: ${parsed.data.id}\ndata: ${JSON.stringify(parsed.data)}\n\n`);
            }
            send(": ping\n\n");
          }

          await delay(waitMs, request.signal);
        }
        stop();
      };

      void pump();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
