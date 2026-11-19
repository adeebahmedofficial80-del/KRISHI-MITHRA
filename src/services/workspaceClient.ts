export interface FpoContact {
  resourceName: string;
  name: string;
  email: string;
  phone: string;
}

export interface ChatSpace {
  name: string;
  displayName: string;
  spaceType: string;
}

export async function fetchGoogleContacts(accessToken: string): Promise<FpoContact[]> {
  const res = await fetch(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers&pageSize=30',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        'Contacts permission not granted yet. Click "Connect Google Workspace" to grant Contacts access.',
      );
    }
    throw new Error(`Unable to load Google Contacts (HTTP ${res.status}).`);
  }
  const data = await res.json();
  const connections: any[] = data.connections ?? [];
  return connections
    .map((c) => ({
      resourceName: String(c.resourceName || ''),
      name: String(c.names?.[0]?.displayName || 'Contact'),
      email: String(c.emailAddresses?.[0]?.value || ''),
      phone: String(c.phoneNumbers?.[0]?.value || ''),
    }))
    .filter((c) => c.name || c.email || c.phone);
}

export async function fetchChatSpaces(accessToken: string): Promise<ChatSpace[]> {
  const res = await fetch('https://chat.googleapis.com/v1/spaces?pageSize=25', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!res.ok) {
    if (res.status === 404 || res.status === 403) {
      throw new Error(
        'Google Chat spaces require a Google Workspace account with Chat API enabled in Cloud Console. Consumer @gmail.com accounts can still copy and share the formatted market report below.',
      );
    }
    if (res.status === 401) {
      throw new Error('Workspace session expired. Please reconnect Google Workspace.');
    }
    throw new Error(`Unable to fetch Google Chat spaces (HTTP ${res.status}).`);
  }
  const data = await res.json();
  const spaces: any[] = data.spaces ?? [];
  return spaces.map((s) => ({
    name: String(s.name || ''),
    displayName: String(s.displayName || s.name || 'Chat Space'),
    spaceType: String(s.spaceType || 'SPACE'),
  }));
}

export async function sendChatMessage(
  accessToken: string,
  spaceName: string,
  text: string,
): Promise<void> {
  const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({text}),
  });
  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 403 || res.status === 404) {
      throw new Error(
        'Unable to post directly to this Google Chat space (requires a Workspace account & configured Chat app). Use "Copy Report" to share manually.',
      );
    }
    throw new Error(`Failed to send Chat message (${res.status}): ${errText.slice(0, 120)}`);
  }
}
