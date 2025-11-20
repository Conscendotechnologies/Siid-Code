# Firebase Login to OpenRouter API Key Integration - Implementation Summary

## Overview

Implemented a complete flow to automatically fetch a default OpenRouter provisioning API key and create new user-specific API keys upon successful Firebase login.

## Files Created

### 1. `src/services/openrouter/api-key-service.ts`

**OpenRouter API Key Service** - Main service for managing API keys

**Features:**

- Fetch default provisioning API key from Firebase
- Create new API keys for users with spending limits
- Store user API keys in Firebase
- Retrieve existing user API keys
- Complete setup flow (fetch → create → store)

**Key Methods:**

- `fetchDefaultProvisioningKey()`: Gets the provisioning key from Firebase `static-data/siid-code`
- `createUserApiKey(params)`: Creates a new API key via OpenRouter API
- `createDefaultUserKey(userId, userEmail)`: Creates a key with default $10/month limit
- `storeUserApiKey(userId, apiKey, metadata)`: Stores key in Firebase `user_api_keys/{userId}`
- `getUserApiKey(userId)`: Retrieves existing user API key
- `setupUserApiKey(userId, userEmail)`: Complete flow for new users

### 2. `src/services/openrouter/README.md`

Comprehensive documentation covering:

- Integration overview
- Firebase data structure
- Usage examples
- Security best practices
- Error handling
- Troubleshooting guide

## Files Modified

### 1. `webview-ui/src/App.tsx`

**Changes:**

- Added handler for `loginSuccess` message type
- Sends `storeLoginDetails` message to extension with user info

```typescript
if (message.type === "loginSuccess") {
	vscode.postMessage({ type: "storeLoginDetails", loginData: message.loginData })
}
```

### 2. `src/shared/WebviewMessage.ts`

**Changes:**

- Added `"storeLoginDetails"` to message type enum
- Added `loginData` field to WebviewMessage interface

### 3. `src/shared/ExtensionMessage.ts`

**Changes:**

- Added `loginData` field with user info structure to ExtensionMessage interface

```typescript
loginData?: {
  userInfo?: {
    uid: string
    email: string | null
    displayName: string | null
    photoURL: string | null
    emailVerified: boolean
    provider: string
  }
}
```

### 4. `src/core/webview/webviewMessageHandler.ts`

**Changes:**

- Added `case "storeLoginDetails"` handler
- Implements complete flow:
    1. Extract user info from message
    2. Import and initialize OpenRouter key service
    3. Call `setupUserApiKey()` to create/retrieve API key
    4. Show success/error messages to user

```typescript
case "storeLoginDetails":
  if (message.loginData?.userInfo) {
    const { getOpenRouterKeyService } = await import("../../services/openrouter/api-key-service")
    const keyService = getOpenRouterKeyService()
    const userApiKey = await keyService.setupUserApiKey(userId, userEmail)
    // Success message shown to user
  }
  break
```

## Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User logs in via Firebase                                    │
│    → Firebase Service extension handles authentication          │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Firebase Service sends "loginSuccess" message to webview     │
│    → Contains loginData with user info (uid, email, etc.)       │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Webview (App.tsx) receives loginSuccess                      │
│    → Sends "storeLoginDetails" message to extension             │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Extension (webviewMessageHandler) receives storeLoginDetails │
│    → Initializes OpenRouter key service                         │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. OpenRouter Key Service executes setup flow:                  │
│    a) Fetch provisioning key from Firebase                      │
│       → firebase-service.retrieveData('static-data', 'siid-code')│
│    b) Check if user already has an API key                      │
│       → firebase-service.retrieveData('user_api_keys', userId)  │
│    c) If no key exists, create new key via OpenRouter API       │
│       → POST https://openrouter.ai/api/v1/keys                  │
│    d) Store new key in Firebase                                 │
│       → firebase-service.storeData('user_api_keys', userId, ...) │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ 6. Success/Error message shown to user                          │
│    → "Welcome {name}! Your account is ready."                   │
└─────────────────────────────────────────────────────────────────┘
```

## Firebase Data Structure

### Collection: `static-data`

**Document ID:** `siid-code`

Stores the provisioning API key (has permission to create new keys):

```json
{
	"defaultOpenRouterApiKey": "sk-or-v1-xxxxxxxxxx"
}
```

### Collection: `user_api_keys`

**Document ID:** `{userId}` (Firebase UID)

Stores user-specific API keys:

```json
{
	"apiKey": "sk-or-v1-yyyyyyyyyy",
	"keyHash": "abc123...",
	"keyName": "siid-code-user@example.com-1234567890",
	"limit": 10,
	"limitRemaining": 10,
	"limitReset": "monthly",
	"createdAt": "2025-11-19T12:00:00Z",
	"expiresAt": null,
	"lastUpdated": "2025-11-19T12:00:00Z"
}
```

## Default API Key Settings

New user keys are created with:

- **Name**: `siid-code-{email}-{timestamp}`
- **Spending Limit**: $10 USD
- **Limit Reset**: Monthly
- **Include BYOK**: Yes

## OpenRouter API Integration

### Endpoint

`POST https://openrouter.ai/api/v1/keys`

### Authentication

Provisioning API key in `Authorization: Bearer {key}` header

### Request

```json
{
	"name": "siid-code-user@example.com-1700000000",
	"limit": 10,
	"limit_reset": "monthly",
	"include_byok_in_limit": true
}
```

### Response

```json
{
  "data": {
    "hash": "abc123...",
    "name": "siid-code-user@example.com-1700000000",
    "limit": 10,
    "limit_remaining": 10,
    "limit_reset": "monthly",
    "created_at": "2025-11-19T12:00:00Z",
    ...
  },
  "key": "sk-or-v1-yyyyyyyyyy"  // Only returned once!
}
```

## Error Handling

All steps include comprehensive error handling:

- Provisioning key fetch failures
- API key creation errors
- Firebase storage errors
- Network issues

Errors are:

1. Logged with full context
2. Shown to user with friendly messages
3. Properly propagated for debugging

## Security Considerations

✅ **Provisioning key** stored server-side (Firebase)  
✅ **User keys** stored per-user (Firebase)  
✅ **Keys never exposed** in client code  
✅ **Spending limits** enforced ($10/month default)  
✅ **Error messages** don't expose sensitive data

## Testing Checklist

- [ ] Set up Firebase collections (`static-data`, `user_api_keys`)
- [ ] Add provisioning API key to `static-data/siid-code`
- [ ] Test Firebase login flow
- [ ] Verify API key creation on first login
- [ ] Verify existing key retrieval on subsequent logins
- [ ] Test error handling (invalid provisioning key, network errors)
- [ ] Verify keys are stored correctly in Firebase
- [ ] Check user messages appear correctly

## Next Steps

1. **Set up Firebase**: Create collections and add provisioning key
2. **Test integration**: Log in and verify key creation
3. **Monitor usage**: Track API key usage in OpenRouter dashboard
4. **Implement key rotation**: Add periodic key refresh mechanism
5. **Add usage dashboard**: Show users their API usage and limits

## Dependencies

- `vscode`: VS Code extension API
- `firebase-service` extension: For Firebase integration
- OpenRouter API: For API key creation
- `@siid-code/types`: Type definitions
- `logging`: Logger utility

## References

- [OpenRouter API Documentation](https://openrouter.ai/docs/api-reference/api-keys/create-keys)
- Firebase Service Extension integration example
- VS Code Extension API documentation
