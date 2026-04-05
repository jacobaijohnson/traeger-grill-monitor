import axios from "axios";
import type { TraegerTokens, TraegerUserData, TraegerMqttCredentials } from "@shared/traeger-types";

const TRAEGER_AUTH_URL = "https://auth-api.iot.traegergrills.io";
const TRAEGER_API_URL = "https://1ywgyc65d1.execute-api.us-west-2.amazonaws.com/prod";

const traegerClient = axios.create({
  timeout: 15000,
});

/**
 * Authenticate with Traeger using email/password.
 * Returns Cognito tokens.
 */
export async function traegerLogin(email: string, password: string): Promise<TraegerTokens> {
  const response = await traegerClient.post(`${TRAEGER_AUTH_URL}/tokens`, {
    email,
    password,
  });

  const data = response.data;
  return {
    accessToken: data.access_token || data.accessToken,
    idToken: data.id_token || data.idToken,
    refreshToken: data.refresh_token || data.refreshToken,
    expiresIn: data.expires_in || data.expiresIn || 3600,
    tokenType: data.token_type || data.tokenType || "Bearer",
  };
}

/**
 * Refresh Traeger tokens using the refresh token.
 */
export async function traegerRefreshTokens(refreshToken: string): Promise<TraegerTokens> {
  const response = await traegerClient.post(`${TRAEGER_AUTH_URL}/tokens`, {
    refresh_token: refreshToken,
  });

  const data = response.data;
  return {
    accessToken: data.access_token || data.accessToken,
    idToken: data.id_token || data.idToken,
    refreshToken: data.refresh_token || data.refreshToken || refreshToken,
    expiresIn: data.expires_in || data.expiresIn || 3600,
    tokenType: data.token_type || data.tokenType || "Bearer",
  };
}

/**
 * Get user data including registered grills.
 */
export async function traegerGetUser(accessToken: string): Promise<TraegerUserData> {
  const response = await traegerClient.get(`${TRAEGER_API_URL}/users/self`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
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
 */
export async function traegerGetMqttCredentials(
  accessToken: string,
  thingName: string
): Promise<TraegerMqttCredentials> {
  const response = await traegerClient.post(
    `${TRAEGER_API_URL}/mqtt-connections`,
    { thingName },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = response.data;
  return {
    signedUrl: data.signedUrl || data.signed_url,
    expirationSeconds: data.expirationSeconds || data.expiration_seconds || 3600,
    expiresAt: data.expiresAt || data.expires_at || new Date(Date.now() + 3600000).toISOString(),
  };
}

/**
 * Send a command to the grill via the Traeger API.
 * Commands are sent as comma-separated values: "commandCode,value"
 */
export async function traegerSendCommand(
  accessToken: string,
  thingName: string,
  command: string
): Promise<{ success: boolean }> {
  const response = await traegerClient.post(
    `${TRAEGER_API_URL}/things/${thingName}/commands`,
    { command },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return { success: response.status === 200 || response.status === 201 };
}

/**
 * Get grill details/status from the API.
 */
export async function traegerGetGrillDetails(
  accessToken: string,
  thingName: string
): Promise<Record<string, unknown>> {
  const response = await traegerClient.get(
    `${TRAEGER_API_URL}/things/${thingName}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  return response.data;
}
