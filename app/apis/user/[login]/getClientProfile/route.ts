

import { NextResponse } from 'next/server';

// --- Configuration ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const CLIENT_PROFILE_PATH = process.env.CLIENT_PROFILE_PATH;
const CLIENT_PROFILE_ENDPOINT = '/getClientProfile';

// ⚠️ IMPORTANT: Replace this with your actual token retrieval logic.
// This function must return a valid, non-expired token for your API.
async function getAuthorizationToken(): Promise<string | null> {
    return "YOUR_AUTH_TOKEN_FROM_LOGIN_PROCESS";
}

// The main GET handler
export async function GET(
  request: Request,
  context: { params: Promise<{ login: string }> }
) {
  const params = await context.params;
  const login = params.login;

  // 1. Configuration Check
  if (!API_BASE_URL || !CLIENT_PROFILE_PATH) {
    return NextResponse.json({ success: false, error: 'Configuration Error: Missing environment variables.' }, { status: 500 });
  }

  try {
    const token = await getAuthorizationToken();

    // 2. Construct the External API URL
    const externalApiUrl = `${API_BASE_URL}${CLIENT_PROFILE_PATH}${login}${CLIENT_PROFILE_ENDPOINT}`;

    // 3. Prepare Headers
    const headers = new Headers({
      'Content-Type': 'application/json',
      // Conditionally add Authorization header if a token exists
    });
    if (token && token !== "YOUR_AUTH_TOKEN_FROM_LOGIN_PROCESS") {
        headers.set('Authorization', `Bearer ${token}`);
    }

    // 4. Fetch data from the external API
    const response = await fetch(externalApiUrl, {
      method: 'GET',
      headers: headers,
      cache: 'no-store',
    });

    // 5. Handle External API Errors (4xx/5xx status codes)
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`External API Error (${response.status}) for ${externalApiUrl}: ${errorText}`);
        return NextResponse.json({
            success: false,
            error: `External API call failed with status ${response.status}`,
            details: errorText.substring(0, 100)
        }, { status: response.status });
    }

    // 6. Success: Return the external API data
    const rawData = await response.json();

    // Check if the external API reported failure within its JSON payload
    if (rawData.Success === false) {
        return NextResponse.json({
            success: false,
            error: rawData.Message || "External API reported failure.",
            data: rawData.Data
        }, { status: 400 });
    }

    // 7. Final Success Response
    return NextResponse.json({
      success: true,
      // Map the external API's 'Data' property to your local 'data' property
      data: rawData.Data
    }, { status: 200 });

  } catch (error) {
    console.error(`[API Proxy] Internal network error or exception:`, error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error: Check network connection or SSL settings.'
    }, { status: 500 });
  }
}