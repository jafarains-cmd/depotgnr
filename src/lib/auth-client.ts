"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient, usernameClient, phoneNumberClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  // baseURL dikosongkan supaya pakai origin saat ini (works di localhost & domain produksi)
  plugins: [usernameClient(), phoneNumberClient(), adminClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
