import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

export function sanitizeSentryEvent(event: ErrorEvent) {
  delete event.user;
  if (event.request) {
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.query_string;
    if (event.request.headers) {
      delete event.request.headers.cookie;
      delete event.request.headers.Cookie;
      delete event.request.headers.authorization;
      delete event.request.headers.Authorization;
    }
  }
  return event;
}

export function sanitizeBreadcrumb(breadcrumb: Breadcrumb) {
  return breadcrumb.category === "console" ? null : breadcrumb;
}
