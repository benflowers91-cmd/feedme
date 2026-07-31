import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { refreshGoogleAccessToken } from '@/lib/google-calendar'

declare module 'next-auth/jwt' {
  interface JWT {
    access_token?: string
    refresh_token?: string
    expires_at?: number
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/calendar.events',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.access_token = account.access_token
        token.refresh_token = account.refresh_token
        token.expires_at = account.expires_at
        return token
      }

      if (token.expires_at && Date.now() / 1000 < token.expires_at) {
        return token
      }

      if (!token.refresh_token) return token

      try {
        const refreshed = await refreshGoogleAccessToken(token.refresh_token)
        token.access_token = refreshed.access_token
        token.expires_at = refreshed.expires_at
      } catch {
        // Keep the stale token; the calling route will surface a re-auth error.
      }
      return token
    },
    async session({ session }) {
      return session
    },
  },
}
