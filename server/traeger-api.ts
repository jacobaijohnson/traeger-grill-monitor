import axios, { AxiosError } from "axios";
import type { TraegerTokens, TraegerUserData, TraegerMqttCredentials } from "@shared/traeger-types";

// Traeger auth proxy (wraps Cognito — preferred approach per go-traeger SDK)
const TRAEGER_AUTH_URL = "https://auth-api.iot.traegergrills.io/tokens";

// Cognito direct auth (fallback — used by Home Assistant integration)
const COGNITO_URL = "https://cognito-idp.us-west-2.amazonaws.com/";
const COGNITO_CLIENT_ID = "2fuohjtqv1e63dckp5v84rau0j";

// Traeger API Gateway (for grill data, commands, MQTT)
const TRAEGER_API_URL = "https://mobile-iot-api.iot.traegergrills.io";

const traegerClient = axios.create({
  timeout: 15000,
});

// ─── P1: Retry with exponential backoff ─────────────────

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

/**
 * Retry a function with exponential backoff.
 * Does NOT retry on 401/403 auth errors (non-transient).
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = opts;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Don't retry auth errors
      const errAny = err as Record<string, any>;
      const status = errAny?.response?.status ?? (err instanceof AxiosError ? err.response?.status : undefined);
      if (status === 401 || status === 403) throw err;
      if (attempt < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        const jitter = delay * (0.5 + Math.random() * 0.5);
        await new Promise(resolve => setTimeout(resolve, jitter));
      }
    }
  }
  throw lastError;
}

// ─── P1: Response validation ────────────────────────────

/**
 * Validate a token response has all required fields.
 */
export function validateTokenResponse(tokens: Record<string, unknown>): boolean {
  return (
    typeof tokens.accessToken === "string" && tokens.accessToken.length > 0 &&
    typeof tokens.idToken === "string" && tokens.idToken.length > 0 &&
    typeof tokens.refreshToken === "string" && tokens.refreshToken.length > 0 &&
    typeof tokens.expiresIn === "number" && tokens.expiresIn > 0
  );
}

/**
 * Validate MQTT credentials response.
 */
export function validateMqttCredentials(creds: Record<string, unknown>): boolean {
  return (
    typeof creds.signedUrl === "string" && creds.signedUrl.length > 0 &&
    typeof creds.expirationSeconds === "number" && creds.expirationSeconds > 0
  );
}

/**
 * Extract a useful error message from an Axios error
 */
function extractErrorMessage(err: unknown): string {
  if (err instanceof AxiosError) {
    const status = err.response?.status;
    const data = err.response?.data;
    const detail =
      typeof data === "string"
        ? data
        : data?.message || data?.__type || data?.error || JSON.stringify(data);
    return `HTTP ${status}: ${detail}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Generate AWS date format for Cognito requests
 */
function getAmzDate(): string {
  const t = new Date();
  return t.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Authenticate via the Traeger auth proxy (preferred).
 * Endpoint: POST https://auth-api.iot.traegergrills.io/tokens
 * Body: {"username": "email", "password": "password"}
 */
async function traegerProxyLogin(email: string, password: string): Promise<TraegerTokens> {
  const response = await traegerClient.post(
    TRAEGER_AUTH_URL,
    {
      username: email,
      password: password,
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": "en-us",
        "User-Agent": "Traeger/11 CFNetwork/1209 Darwin/20.2.0",
      },
    }
  );

  const data = response.data;
  if (!data?.idToken && !data?.accessToken) {
    throw new Error("No tokens returned from Traeger auth proxy");
  }

  return {
    accessToken: data.accessToken || data.access_token || "",
    idToken: data.idToken || data.id_token || "",
    refreshToken: data.refreshToken || data.refresh_token || "",
    expiresIn: data.expiresIn || data.expires_in || 86400,
    tokenType: data.tokenType || data.token_type || "Bearer",
  };
}

/**
 * Authenticate via direct AWS Cognito InitiateAuth (fallback).
 */
async function cognitoDirectLogin(email: string, password: string): Promise<TraegerTokens> {
  const amzDate = getAmzDate();

  const response = await traegerClient.post(
    COGNITO_URL,
    {
      ClientMetadata: {},
      AuthParameters: {
        PASSWORD: password,
        USERNAME: email,
      },
      AuthFlow: "USER_PASSWORD_AUTH",
      ClientId: COGNITO_CLIENT_ID,
    },
    {
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Date": amzDate,
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
    }
  );

  const result = response.data?.AuthenticationResult;
  if (!result) {
    throw new Error("No AuthenticationResult from Cognito");
  }

  return {
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    refreshToken: result.RefreshToken,
    expiresIn: result.ExpiresIn || 3600,
    tokenType: result.TokenType || "Bearer",
  };
}

/**
 * Authenticate with Traeger. Tries the Traeger auth proxy first,
 * falls back to direct Cognito if that fails.
 */
export async function traegerLogin(email: string, password: string): Promise<TraegerTokens> {
  // Attempt 1: Traeger auth proxy (with retry for transient failures)
  try {
    console.log("[Traeger Auth] Attempting auth via Traeger proxy...");
    const tokens = await withRetry(() => traegerProxyLogin(email, password), { maxRetries: 2, baseDelay: 500 });
    if (!validateTokenResponse(tokens as unknown as Record<string, unknown>)) {
      throw new Error("Invalid token response from Traeger proxy");
    }
    console.log("[Traeger Auth] Success via Traeger proxy");
    return tokens;
  } catch (proxyErr) {
    const proxyMsg = extractErrorMessage(proxyErr);
    console.warn(`[Traeger Auth] Proxy auth failed: ${proxyMsg}`);

    // Attempt 2: Direct Cognito
    try {
      console.log("[Traeger Auth] Attempting auth via direct Cognito...");
      const tokens = await withRetry(() => cognitoDirectLogin(email, password), { maxRetries: 2, baseDelay: 500 });
      if (!validateTokenResponse(tokens as unknown as Record<string, unknown>)) {
        throw new Error("Invalid token response from Cognito");
      }
      console.log("[Traeger Auth] Success via direct Cognito");
      return tokens;
    } catch (cognitoErr) {
      const cognitoMsg = extractErrorMessage(cognitoErr);
      console.error(`[Traeger Auth] Cognito auth also failed: ${cognitoMsg}`);

      // Return the most useful error
      throw new Error(
        `Authentication failed.\n` +
        `Traeger proxy: ${proxyMsg}\n` +
        `Cognito direct: ${cognitoMsg}\n` +
        `Please verify your Traeger email and password are correct.`
      );
    }
  }
}

/**
 * Refresh tokens. Tries Traeger proxy first, then Cognito.
 */
export async function traegerRefreshTokens(refreshToken: string): Promise<TraegerTokens> {
  // Attempt 1: Traeger auth proxy refresh
  try {
    const response = await traegerClient.post(
      TRAEGER_AUTH_URL,
      { refreshToken },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Traeger/11 CFNetwork/1209 Darwin/20.2.0",
        },
      }
    );

    const data = response.data;
    if (data?.idToken || data?.accessToken) {
      return {
        accessToken: data.accessToken || data.access_token || "",
        idToken: data.idToken || data.id_token || "",
        refreshToken: data.refreshToken || data.refresh_token || refreshToken,
        expiresIn: data.expiresIn || data.expires_in || 86400,
        tokenType: data.tokenType || data.token_type || "Bearer",
      };
    }
  } catch {
    // Fall through to Cognito
  }

  // Attempt 2: Direct Cognito refresh
  const amzDate = getAmzDate();
  const response = await traegerClient.post(
    COGNITO_URL,
    {
      ClientMetadata: {},
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: COGNITO_CLIENT_ID,
    },
    {
      headers: {
        "Content-Type": "application/x-amz-json-1.1",
        "X-Amz-Date": amzDate,
        "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth",
      },
    }
  );

  const result = response.data?.AuthenticationResult;
  if (!result) {
    throw new Error("Token refresh failed via both methods");
  }

  return {
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    refreshToken: refreshToken, // Cognito refresh doesn't return new refresh token
    expiresIn: result.ExpiresIn || 3600,
    tokenType: result.TokenType || "Bearer",
  };
}

/**
 * Get user data including registered grills.
 * Uses idToken for authorization.
 */
export async function traegerGetUser(idToken: string): Promise<TraegerUserData> {
  const response = await traegerClient.get(`${TRAEGER_API_URL}/users/self`, {
    headers: {
      Authorization: idToken,
      "Content-Type": "application/json",
      "Accept-Language": "en-us",
      "User-Agent": "Traeger/11 CFNetwork/1209 Darwin/20.2.0",
    },
  });

  const data = response.data;
  return {
    userId: data.userId || data.user_id,
    givenName: data.givenName || data.given_name || "",
    familyName: data.familyName || data.family_name || "",
    email: data.email || "",
    things: (data.things || []).map((t: Record<string, unknown>) => ({
      thingName: t.thingName || t.thing_name,
      friendlyName: t.friendlyName || t.friendly_name || t.thingName || t.thing_name,
      deviceTypeId: t.deviceTypeId || t.device_type_id || "",
      status: t.status || "unknown",
    })),
  };
}

/**
 * Get MQTT WebSocket connection credentials.
 * Uses idToken for authorization.
 */
export async function traegerGetMqttCredentials(
  idToken: string,
  _thingName: string
): Promise<TraegerMqttCredentials> {
  const response = await withRetry(() => traegerClient.post(
    `${TRAEGER_API_URL}/mqtt-connections`,
    {},
    {
      headers: {
        Authorization: idToken,
        "Content-Type": "application/json",
        "Accept-Language": "en-us",
        "User-Agent": "Traeger/11 CFNetwork/1209 Darwin/20.2.0",
      },
    }
  ));

  const data = response.data;
  const creds = {
    signedUrl: data.signedUrl || data.signed_url,
    expirationSeconds: data.expirationSeconds || data.expiration_seconds || 3600,
    expiresAt: data.expiresAt || data.expires_at || new Date(Date.now() + 3600000).toISOString(),
  };
  if (!validateMqttCredentials(creds as unknown as Record<string, unknown>)) {
    throw new Error("Invalid MQTT credentials response");
  }
  return creds;
}

/**
 * Send a command to the grill via the Traeger API.
 * Uses idToken for authorization.
 */
export async function traegerSendCommand(
  idToken: string,
  thingName: string,
  command: string
): Promise<{ success: boolean }> {
  const response = await withRetry(() => traegerClient.post(
    `${TRAEGER_API_URL}/things/${thingName}/commands`,
    { command },
    {
      headers: {
        Authorization: idToken,
        "Content-Type": "application/json",
        "Accept-Language": "en-us",
        "User-Agent": "Traeger/11 CFNetwork/1209 Darwin/20.2.0",
      },
    }
  ));

  return { success: response.status === 200 || response.status === 201 };
}

/**
 * Get grill details/status from the API.
 * Uses idToken for authorization.
 */
export async function traegerGetGrillDetails(
  idToken: string,
  thingName: string
): Promise<Record<string, unknown>> {
  const response = await withRetry(() => traegerClient.get(
    `${TRAEGER_API_URL}/things/${thingName}`,
    {
      headers: {
        Authorization: idToken,
        "Content-Type": "application/json",
        "Accept-Language": "en-us",
        "User-Agent": "Traeger/11 CFNetwork/1209 Darwin/20.2.0",
      },
    }
  ));

  return response.data;
}
