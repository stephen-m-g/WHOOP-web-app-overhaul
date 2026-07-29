function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  whoop: {
    get clientId() {
      return requireEnv("WHOOP_CLIENT_ID");
    },
    get clientSecret() {
      return requireEnv("WHOOP_CLIENT_SECRET");
    },
    get redirectUri() {
      return requireEnv("WHOOP_REDIRECT_URI");
    },
    scopes: "offline read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement",
  },
  backendUrl: process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000",
};
