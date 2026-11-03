import NextAuth, { CredentialsSignin } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import GitHubProvider from 'next-auth/providers/github'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { checkRateLimits, getClientIp, AUTH_LIMITS } from '@/lib/rate-limit'
import { checkTokenFreshness } from '@/lib/auth-session'

// Shown on the login screen via the `code` returned by signIn().
class EmailNotVerified extends CredentialsSignin {
  code = 'email_not_verified'
}

class RateLimited extends CredentialsSignin {
  code = 'rate_limited'
}

// True only if GitHub reports `email` as verified for the signed-in GitHub user.
async function isGitHubEmailVerified(accessToken: string | undefined, email: string): Promise<boolean> {
  if (!accessToken) return false
  try {
    const res = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'engram-app' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return false
    const emails = (await res.json()) as { email: string; verified: boolean }[]
    return Array.isArray(emails) && emails.some((e) => e.verified && e.email.toLowerCase() === email)
  } catch {
    return false
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null
        const normalizedEmail = (credentials.email as string).toLowerCase().trim()

        const ip = request?.headers ? getClientIp(request.headers) : 'unknown'
        const limited = await checkRateLimits([
          { key: `signin:ip:${ip}`, ...AUTH_LIMITS.signInPerIp },
          { key: `signin:email-ip:${normalizedEmail}:${ip}`, ...AUTH_LIMITS.signInPerEmailIp },
        ])
        if (!limited.ok) throw new RateLimited()

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        })
        if (!user || !user.password) return null
        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        if (!passwordMatch) return null

        // Only revealed after a correct password, so it doesn't leak which emails exist.
        if (!user.emailVerified) {
          throw new EmailNotVerified()
        }

        return user
      },
    }),
  ],
  events: {
    // Auth.js creates OAuth users with emailVerified: null. The provider has proved the
    // email, so mark it verified; otherwise /api/auth/signup would treat the account as
    // unclaimed (and overwrite its password), and the signIn callback above would wipe a
    // password the user later set in settings.
    async createUser({ user }) {
      if (!user.id) return
      try {
        await prisma.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } })
      } catch (e) {
        console.error('[auth] could not mark new OAuth user verified:', e)
      }
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      try {
        // Credentials users are fully checked in authorize() (password + verified email).
        if (!account || account.provider === 'credentials') {
          return !!user?.email
        }

        if (!user.email) return false

        // The email below is trusted to link accounts, so it must be one Google has verified.
        if (account.provider === 'google' && profile?.email_verified !== true) return false

        const normalizedEmail = user.email.toLowerCase().trim()

        // Find if a user with this email already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
          include: { accounts: true },
        })

        if (!existingUser) {
          // New user — let NextAuth create them normally
          return true
        }

        // Linking a GitHub login to an existing account by email: GitHub lets people add
        // emails they haven't verified, so confirm this one is verified first.
        if (account.provider === 'github') {
          const alreadyLinked = existingUser.accounts.some(
            (a) => a.provider === 'github' && a.providerAccountId === account.providerAccountId
          )
          if (!alreadyLinked && !(await isGitHubEmailVerified(account.access_token, normalizedEmail))) {
            return false
          }
        }

        // If the existing account was never verified, the OAuth provider has now proved
        // who owns this email. Any password on the account was set by someone who never
        // proved ownership (possibly an attacker who signed up first), so remove it.
        // The real owner can set a password later with "Forgot password".
        if (!existingUser.emailVerified) {
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { emailVerified: new Date(), password: null },
          })
        }

        // User exists — check if this specific OAuth account is already linked
        const linkedAccount = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
          },
        })

        if (linkedAccount) {
          // Account already linked — this is a returning user from a different browser
          return true
        }

        // User exists but this OAuth provider not yet linked — link it now
        await prisma.account.create({
          data: {
            userId: existingUser.id,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            access_token: account.access_token ?? null,
            refresh_token: account.refresh_token ?? null,
            expires_at: account.expires_at ?? null,
            token_type: account.token_type ?? null,
            scope: account.scope ?? null,
            id_token: account.id_token ?? null,
            session_state: (account.session_state as string) ?? null,
          },
        })

        return true
      } catch (error) {
        console.error('[auth] signIn callback error:', error)
        return false
      }
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.email = user.email
        token.issuedAt = Date.now()
        // Only set at a real sign-in (never backfilled), so "recently signed in" checks are safe.
        token.signedInAt = Date.now()
        token.pwCheckedAt = Date.now()
        return token
      }
      // After the user changes their email or name, the client calls update() to refresh the session.
      if (trigger === 'update' && token.id) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { email: true, name: true },
        })
        if (!fresh) return null
        token.email = fresh.email
        token.name = fresh.name
      }
      // Returning null ends the session (e.g. password changed elsewhere).
      return checkTokenFreshness(token)
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.email = token.email as string
      }
      return session
    },
  },
})
