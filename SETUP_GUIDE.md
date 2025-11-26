# Quick Setup Guide: Firebase Login to OpenRouter API Key Integration

## Prerequisites

1. **Firebase Service Extension** must be installed and configured
2. **OpenRouter account** with a provisioning API key
3. **Firebase Firestore** database set up

## Step-by-Step Setup

### 1. Set Up Firebase Collections

Create the following collections in your Firebase Firestore:

#### Collection: `static-data`

This stores the OpenRouter provisioning API key.

**Document ID**: `siid-code`

```javascript
// In Firebase Console:
{
  "defaultOpenRouterApiKey": "YOUR_OPENROUTER_PROVISIONING_KEY_HERE"
}
```

⚠️ **Important**: The provisioning key should have permission to create new API keys on OpenRouter.

#### Collection: `users`

This will automatically store user API keys (no manual setup needed).

**Document structure** (auto-created):

```javascript
// Document ID: {userId}
{
  "apiKey": "sk-or-v1-...",
  "keyHash": "...",
  "keyName": "...",
  "limit": 10,
  "limitRemaining": 10,
  "limitReset": "monthly",
  "createdAt": "...",
  "expiresAt": null,
  "lastUpdated": "..."
}
```

### 2. Get OpenRouter Provisioning Key

1. Go to [OpenRouter Settings](https://openrouter.ai/settings/keys)
2. Create a new **Provisioning API Key**
3. Copy the key (starts with `sk-or-v1-`)
4. Add it to Firebase `static-data/siid-code` document

### 3. Configure Firebase Security Rules

Add security rules to protect the provisioning key:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Static data - read-only for all authenticated users
    match /static-data/{document=**} {
      allow read: if request.auth != null;
      allow write: if false; // Only admins via console
    }

    // User API keys - users can only access their own keys
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4. Test the Integration

1. **Build and run the extension**:

    ```powershell
    pnpm install
    pnpm run watch
    ```

2. **Open VS Code** and press `F5` to run the extension

3. **Log in via Firebase**:

    - Click on the Firebase login button in the extension
    - Complete the authentication flow

4. **Check the logs**:

    - Open VS Code Developer Tools: `Help > Toggle Developer Tools`
    - Look for these log messages:
        ```
        [OpenRouterKeyService] Fetching default provisioning API key from Firebase...
        [OpenRouterKeyService] Successfully fetched default provisioning API key
        [OpenRouterKeyService] Creating new API key: siid-code-user@example.com-...
        [OpenRouterKeyService] Successfully created API key: ...
        [OpenRouterKeyService] Successfully stored API key for user: ...
        ```

5. **Verify in Firebase**:
    - Go to Firebase Console
    - Check `users` collection
    - You should see a new document with your user ID containing the API key

### 5. Verify API Key Works

Test the created API key on OpenRouter:

```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer YOUR_USER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Troubleshooting

### Error: "Provisioning API key not set"

**Cause**: The provisioning key is not in Firebase or is incorrect.

**Solution**:

1. Check Firebase Console: `static-data/siid-code`
2. Verify the `defaultOpenRouterApiKey` field exists
3. Ensure the key is valid and has provisioning permissions

### Error: "Failed to create API key: 401"

**Cause**: The provisioning key is invalid or expired.

**Solution**:

1. Go to OpenRouter and regenerate your provisioning key
2. Update Firebase `static-data/siid-code` with the new key
3. Try logging in again

### Error: "Failed to store API key"

**Cause**: Firebase Service extension is not working or permissions issue.

**Solution**:

1. Verify Firebase Service extension is installed
2. Check Firebase authentication is working
3. Verify Firestore security rules allow write access

### No logs appear

**Cause**: Extension not running in development mode.

**Solution**:

1. Open VS Code Developer Tools: `Help > Toggle Developer Tools`
2. Go to Console tab
3. Filter by "OpenRouterKeyService"

### User already has a key message

**Behavior**: This is normal! On subsequent logins, the service detects the existing key and doesn't create a new one.

**Verify**:

```
[OpenRouterKeyService] User {userId} already has an API key
```

## Monitoring

### Check User API Keys

Firebase Console → Firestore → `users`

You'll see:

- User ID (document ID)
- API key
- Usage limits
- Creation date

### Check OpenRouter Dashboard

[OpenRouter Settings](https://openrouter.ai/settings/keys)

You can see:

- All created keys
- Usage statistics
- Spending limits
- Key status

## Default Settings

New user keys are created with these defaults:

| Setting        | Value   |
| -------------- | ------- |
| Spending Limit | $10 USD |
| Limit Reset    | Monthly |
| Include BYOK   | Yes     |
| Expiry         | Never   |

To change these, edit `src/services/openrouter/api-key-service.ts`:

```typescript
public async createDefaultUserKey(userId: string, userEmail: string) {
  const params: CreateKeyParams = {
    name: `siid-code-${userEmail}-${Date.now()}`,
    limit: 20,              // Change to $20
    limit_reset: 'weekly',  // Change to weekly
    include_byok_in_limit: true,
  }
  return this.createUserApiKey(params)
}
```

## Next Steps

1. ✅ Set up Firebase collections
2. ✅ Add provisioning API key
3. ✅ Test login flow
4. ✅ Verify key creation
5. 🔲 Implement key rotation (future)
6. 🔲 Add usage dashboard (future)
7. 🔲 Set up monitoring alerts (future)

## Support

If you encounter issues:

1. Check the logs in VS Code Developer Tools
2. Verify Firebase configuration
3. Test OpenRouter API key manually
4. Check Firebase security rules
5. Review the error messages in the console

## Resources

- [OpenRouter API Documentation](https://openrouter.ai/docs)
- [Firebase Service Extension](link-to-firebase-service)
- [Implementation Summary](IMPLEMENTATION_SUMMARY.md)
- [Service README](src/services/openrouter/README.md)
