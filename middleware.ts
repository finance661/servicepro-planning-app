// middleware.ts
// Beschermt alle routes behalve /login en /api/auth

import { withAuth } from 'next-auth/middleware';

export default withAuth({
  pages: {
    signIn: '/login',
  },
});

export const config = {
  matcher: [
    '/planning/:path*',
    '/instellingen/:path*',
    '/api/sheets/:path*',
    '/api/export/:path*',
    '/api/settings/:path*',
  ],
};
