import { NextResponse } from 'next/server';

/**
 * Edge middleware to protect /admin routes from unauthenticated access.
 * Performs fast cookie-presence check at the edge, redirecting unauthenticated
 * requests to /admin/login before rendering any admin layout or components.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Exclude login page and static assets
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return NextResponse.next();
  }

  // Check for sb-access-token cookie
  const token = request.cookies.get('sb-access-token')?.value;

  if (!token) {
    const loginUrl = new URL('/admin/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
