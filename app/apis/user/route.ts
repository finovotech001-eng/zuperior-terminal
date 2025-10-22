// /app/apis/user/route.ts

import { NextRequest, NextResponse } from 'next/server';
import * as https from 'https'; // Required for custom HTTPS agent

// --- Configuration loaded from .env.local ---
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const MANAGER_USERNAME = process.env.MANAGER_USERNAME;
const MANAGER_PASSWORD = process.env.MANAGER_PASSWORD;
const MANAGER_SERVER_IP = process.env.MANAGER_SERVER_IP;
const MANAGER_PORT = process.env.MANAGER_PORT;
const MANAGER_LOGIN_PATH = process.env.MANAGER_LOGIN_PATH;
const CLIENT_LOGIN_PATH = process.env.CLIENT_LOGIN_PATH;

// --- SSL Bypass Agent ---
// FIX: This agent bypasses certificate verification for untrusted/self-signed hosts.
const agent = new https.Agent({
  rejectUnauthorized: false,
});

/**
 * 1. Internal function to get the Master Token using Manager Credentials.
 */
async function getMasterToken(): Promise<string | null> {
  if (!API_BASE_URL || !MANAGER_USERNAME || !MANAGER_PASSWORD || !MANAGER_LOGIN_PATH) {
    console.error('CRITICAL: Missing manager environment variables for platform connection.');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${MANAGER_LOGIN_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      agent: agent, // <-- FIX APPLIED
      body: JSON.stringify({
        Username: MANAGER_USERNAME,
        Password: MANAGER_PASSWORD,
        Server: MANAGER_SERVER_IP,
        Port: parseInt(MANAGER_PORT || '443', 10),
      }),
    });

    if (!response.ok) {
      const errorDetails = await response.text();
      console.error('Manager Login Failed:', response.status, errorDetails);
      // If login fails due to bad credentials, the platform connection is also effectively blocked
      return null;
    }

    const data = await response.json();
    return data.Token || data.AccessToken || null;

  } catch (error) {
    console.error('Network Error during Manager Login:', error);
    return null;
  }
}

/**
 * Handles POST requests for client (user) login to /apis/user/
 */
export async function POST(request: NextRequest) {
  if (!CLIENT_LOGIN_PATH) {
    return NextResponse.json(
      { success: false, message: 'Server configuration error: Client login path missing.' },
      { status: 500 }
    );
  }

  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: 'Missing AccountId or Password.' },
        { status: 400 }
      );
    }

    // --- Step 1: Get the Master Token (Manager Auth) ---
    const masterToken = await getMasterToken();

    if (!masterToken) {
      // Return the specific error message to help pinpoint the issue
      return NextResponse.json(
        { success: false, message: 'Platform connection failure: Cannot obtain master token.' },
        { status: 503 }
      );
    }

    // --- Step 2: Authenticate the Client using the Master Token ---
    const clientAuthResponse = await fetch(`${API_BASE_URL}${CLIENT_LOGIN_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${masterToken}`,
      },
      agent: agent, // <-- FIX APPLIED
      body: JSON.stringify({
        AccountId: parseInt(username, 10),
        Password: password,
        DeviceId: 'zuperior_web_terminal',
        DeviceType: 'Web',
      }),
    });

    // Handle client login failure
    if (!clientAuthResponse.ok) {
      const status = clientAuthResponse.status;
      let errorMessage = 'Login failed. Invalid account ID or password.';
      try {
        const errorData = await clientAuthResponse.json();
        errorMessage = errorData.Message || errorData.message || errorMessage;
      } catch (e) {
        // Ignore JSON parsing error
      }
      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: status }
      );
    }

    // --- Step 3: Successful Client Login ---
    const clientData = await clientAuthResponse.json();

    return NextResponse.json(
      {
        success: true,
        user: {
            id: username,
            accountId: parseInt(username, 10),
            clientToken: clientData.Token || clientData.AccessToken
        },
        token: clientData.Token || clientData.AccessToken
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('Unhandled Login API Error:', error);
    return NextResponse.json(
      { success: false, message: 'An internal server error occurred.' },
      { status: 500 }
    );
  }
}