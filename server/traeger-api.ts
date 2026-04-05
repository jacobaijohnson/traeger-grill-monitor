import axios from "axios";
import type { TraegerTokens, TraegerUserData, TraegerMqttCredentials } from "@shared/traeger-types";

// Cognito direct auth endpoint (not the auth-api proxy)
const COGNITO_URL = "https://cognito-idp.us-west-2.amazonaws.com/";
const COGNITO_CLIENT_ID = "2fuohjtqv1e63dckp5v84rau0j";

// Traeger API Gateway
const TRAEGER_API_URL = "https://1ywgyc65d1.execute-api.us-west-2.amazonaws.com/prod";

const traegerClient = axios.create({
  timeout: 15000,
});

/**
 * Generate AWS date format for Cognito requests
 */
function getAmzDate(): string {
  const t = new Date();
  return t.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Authenticate with Traeger using email/password via AWS Cognito InitiateAuth.
 * This calls the Cognito Identity Provider directly with USER_PASSWORD_AUTH flow.
 */
export async function traegerLogin(email: string, password: string): Promise<TraegerTokens> {
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
    throw new Error("Authentication failed: no AuthenticationResult in response");
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
 * Refresh Traeger tokens using the refresh token via Cognito.
 */
export async function traegerRefreshTokens(refreshToken: string): Promise<TraegerTokens> {
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
    throw new Error("Token refresh failed: no AuthenticationResult in response");
  }

  return {
    // Cognito refresh does not return a new RefreshToken, keep the old one
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    refreshToken: refreshToken,
    expiresIn: result.ExpiresIn || 3600,
    tokenType: result.TokenType || "Bearer",
  };
}

/**
 * Get user data including registered grills.
 * Uses idToken for authorization (not accessToken).
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
  const response = await traegerClient.post(
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
 * Uses idToken for authorization.
 */
export async function traegerSendCommand(
  idToken: string,
  thingName: string,
  command: string
): Promise<{ success: boolean }> {
  const response = await traegerClient.post(
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
  );

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
  const response = await traegerClient.get(
    `${TRAEGER_API_URL}/things/${thingName}`,
    {
      headers: {
        Authorization: idToken,
        "Content-Type": "application/json",
        "Accept-Language": "en-us",
        "User-Agent": "Traeger/11 CFNetwork/1209 Darwin/20.2.0",
      },
    }
  );

  return response.data;
}
