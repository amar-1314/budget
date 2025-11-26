# How to Fix Contributions & Enable Real Push Notifications

## Part 1: Fix "Way Off" Contributions

The error you saw (`column "PaymentType" does not exist`) happened because we needed to create the missing columns first. I have updated the script to do exactly that.

1.  Go to **Supabase Dashboard > SQL Editor**.
2.  Open **`FIX_PAYMENT_TYPES.sql`** (the one I just updated).
3.  **Run it.**
4.  Reload your app. The contributions should now be correct!

---

## Part 2: Fix Push Notifications (iPhone/Background)

The reason you aren't getting notifications on iPhone is that the current system relies on the app being **Open/Active**. iOS kills the connection as soon as the app is suspended.

To get notifications when the app is **Closed**, you need "Web Push".

### Step A: Setup Database
1.  Run **`SETUP_WEB_PUSH_DB.sql`** in Supabase SQL Editor.
    *   This creates a `subscriptions` table to store iPhone push tokens.

### Step B: Setup Edge Function (The Server)
You need a server to tell Apple/Google to wake up your phone.
1.  Install Supabase CLI if you haven't: `brew install supabase/tap/supabase`
2.  Login: `supabase login`
3.  Deploy the function I created for you:
    ```bash
    supabase functions deploy push --no-verify-jwt
    ```
4.  **Generate VAPID Keys** (Required for security):
    *   Run: `npx web-push generate-vapid-keys`
    *   Save the **Public** and **Private** keys.
5.  Set the secrets in Supabase:
    ```bash
    supabase secrets set VAPID_PUBLIC_KEY="your_public_key_here"
    supabase secrets set VAPID_PRIVATE_KEY="your_private_key_here"
    ```

### Step C: Connect Database to Function
1.  Go to **Supabase Dashboard > Database > Webhooks**.
2.  Create a new Webhook:
    *   Name: `push-on-insert`
    *   Table: `Budget`
    *   Events: `INSERT`
    *   Type: `HTTP Request`
    *   URL: `https://[YOUR_PROJECT_REF].supabase.co/functions/v1/push`
    *   Method: `POST`

### Step D: Update App Code (Client)
1.  Open `script.js`.
2.  Find `requestNotificationPermission`.
3.  Replace the logic to use `swRegistration.pushManager.subscribe` using your **Public Key**.
    *(I can provide the exact code snippet once you have your Public Key).*

### 🚦 Summary
If you just want the math fixed, **do Part 1**.
If you really want background notifications on iPhone, you need to do **Part 2**.

