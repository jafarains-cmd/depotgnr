"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, usernameClient, phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  plugins: [usernameClient(), phoneNumberClient(), adminClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
