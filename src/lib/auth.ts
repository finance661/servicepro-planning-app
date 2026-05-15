// src/lib/auth.ts

import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN;
const ALLOWED_EMAILS = process.env.ALLOWED_EMAILS
  ? process.env.ALLOWED_EMAILS.split(',').map(e => e.trim())
  : [];

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
          hd: ALLOWED_DOMAIN, // restrict to workspace domain
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const email = user.email || '';
      
      // Check domain or specific email whitelist
      if (ALLOWED_DOMAIN && email.endsWith(`@${ALLOWED_DOMAIN}`)) return true;
      if (ALLOWED_EMAILS.length > 0 && ALLOWED_EMAILS.includes(email)) return true;
      
      // If no restrictions configured, allow all Google logins (dev mode)
      if (!ALLOWED_DOMAIN && ALLOWED_EMAILS.length === 0) return true;
      
      return false; // deny
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours (work day)
  },
};
