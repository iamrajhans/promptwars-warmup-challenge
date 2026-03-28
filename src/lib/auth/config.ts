import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"

export const authConfig = {
  providers: [Google],
  callbacks: {
    authorized({ auth, request: { nextUrl, headers } }) {
      const isLoggedIn = !!auth?.user
      const isOnOperator = nextUrl.pathname.startsWith("/operator")
      
      // ALLOW BYPASS FOR PLAYWRIGHT TESTING
      const pwHeader = headers.get("x-playwright-test");
      const isTestBypass = pwHeader === "true" || process.env.NODE_ENV === "test";

      if (isOnOperator) {
        if (isLoggedIn || isTestBypass) return true
        return false // Redirect unauthenticated users to login page
      }
      return true
    },
  },
} satisfies NextAuthConfig
