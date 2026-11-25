import mixpanel from "mixpanel-browser";

const ANON_ID_KEY = "fold.analytics.v1";
let ready = false;

function anonId(): string {
  const existing = localStorage.getItem(ANON_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(ANON_ID_KEY, id);
  return id;
}

export const Events = {
  APP_OPENED: "app_opened",
  LEVEL_STARTED: "level_started",
  LEVEL_CLEARED: "level_cleared",
  SKIN_SELECTED: "skin_selected",
  PURCHASE_TAPPED: "purchase_tapped",
  PURCHASE_SUCCEEDED: "purchase_succeeded",
  PURCHASE_CANCELLED: "purchase_cancelled",
  PURCHASE_FAILED: "purchase_failed",
  RESTORE_TAPPED: "restore_tapped",
  RESTORE_FINISHED: "restore_finished",
} as const;

export function initAnalytics(): void {
  const token = import.meta.env.VITE_MIXPANEL_TOKEN;
  if (!token || ready) return;
  mixpanel.init(token, {
    api_host: import.meta.env.VITE_MIXPANEL_API_HOST || undefined,
    persistence: "localStorage",
    ignore_dnt: false,
    track_pageview: false,
    autocapture: false,
    record_sessions_percent: 0,
    ip: false,
  });
  mixpanel.identify(anonId());
  mixpanel.register({ app: "fold" });
  ready = true;
}

export function trackEvent(name: string, props?: Record<string, string | number | boolean>): void {
  if (!ready) return;
  mixpanel.track(name, props);
}
