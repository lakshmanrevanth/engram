import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string
    // When this session was first issued (ms). Compared with passwordChangedAt.
    issuedAt?: number
    // Last time passwordChangedAt was checked (ms).
    pwCheckedAt?: number
    // Time of the actual sign-in (ms). Not set on sessions from before this field existed.
    signedInAt?: number
  }
}
