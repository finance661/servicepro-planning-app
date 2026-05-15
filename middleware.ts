export { default } from 'next-auth/middleware';

export const config = {
  matcher: [
    '/planning/:path*',
    '/instellingen/:path*',
    '/api/sheets/:path*',
    '/api/export/:path*',
    '/api/settings/:path*',
  ],
};
