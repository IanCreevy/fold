declare module "mixpanel-browser" {
  interface InitOptions {
    api_host?: string;
    persistence?: "localStorage" | "cookie";
    ignore_dnt?: boolean;
    track_pageview?: boolean;
    autocapture?: boolean;
    record_sessions_percent?: number;
    ip?: boolean;
  }

  interface Mixpanel {
    init(token: string, options?: InitOptions): void;
    identify(id: string): void;
    register(props: Record<string, string>): void;
    track(name: string, props?: Record<string, string | number | boolean>): void;
  }

  const mixpanel: Mixpanel;
  export default mixpanel;
}
