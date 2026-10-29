# Deployment Guide for GitHub Pages

## Overview
This guide covers the complete setup for deploying MusePad to GitHub Pages with proper authentication redirect URLs.

## GitHub Secrets Configuration

Your GitHub repository needs these 3 secrets configured. Go to:
**Settings → Secrets and variables → Actions → Repository secrets**

### Required Secrets:

1. **VITE_SUPABASE_URL**
   - Value: `https://yzpugjwwiyvtzmzryygu.supabase.co`
   - ✅ Already configured

2. **VITE_SUPABASE_ANON_KEY**
   - Value: Your Supabase anonymous key
   - ✅ Already configured

3. **VITE_AUTH_REDIRECT_URL**
   - Value: `https://rsiddqp.github.io/thebook/`
   - ✅ Already configured
   - ⚠️ **Important**: Must include trailing slash!

## Supabase Configuration

### Step 1: Configure Redirect URLs in Supabase Dashboard

1. Go to your Supabase project: https://supabase.com/dashboard/project/yzpugjwwiyvtzmzryygu

2. Navigate to: **Authentication → URL Configuration**

3. Add the following URLs to **Redirect URLs** (add each separately):
   ```
   https://rsiddqp.github.io/thebook/
   http://localhost:5173/
   http://127.0.0.1:5173/
   ```

4. Set **Site URL** to:
   ```
   https://rsiddqp.github.io/thebook/
   ```

### Step 2: Email Templates Configuration

1. In Supabase Dashboard, go to: **Authentication → Email Templates**

2. For each template (Confirm signup, Magic Link, etc.), ensure the redirect URL uses:
   ```
   {{ .SiteURL }}
   ```
   This will automatically use the Site URL you configured above.

3. The default templates should look like:
   ```html
   <h2>Confirm your signup</h2>
   <p>Follow this link to confirm your user:</p>
   <p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup">Confirm your email</a></p>
   ```

### Step 3: Verify Email Template Variables

Make sure the email templates use `{{ .SiteURL }}` and NOT hardcoded localhost URLs. Check these templates:
- Confirm signup
- Invite user  
- Magic Link
- Change Email Address
- Reset Password

## Local Development

For local development, your `.env` file should have:

```env
VITE_SUPABASE_URL=https://yzpugjwwiyvtzmzryygu.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_AUTH_REDIRECT_URL=http://localhost:5173/
```

The app will automatically use the environment-specific redirect URL.

## Deployment Process

### Automatic Deployment (Recommended)

The GitHub Actions workflow automatically deploys when you push to `main`:

```bash
git add .
git commit -m "Your commit message"
git push origin main
```

The workflow will:
1. Install dependencies
2. Build with production environment variables
3. Deploy to GitHub Pages

### Manual Deployment

If needed, you can trigger a manual deployment:
1. Go to **Actions** tab in GitHub
2. Select **Deploy to GitHub Pages**
3. Click **Run workflow**

## Testing Production Deployment

### After deploying, test the authentication flow:

1. Visit: https://rsiddqp.github.io/thebook/

2. Try signing up with a new email address

3. Check your email - the magic link should redirect to:
   ```
   https://rsiddqp.github.io/thebook/
   ```
   NOT `http://localhost:3000/` or any local URL

4. Click the link and verify you're redirected to the production site

## Troubleshooting

### Issue: Email links still redirect to localhost

**Solution:**
1. Check Supabase Dashboard → Authentication → URL Configuration
2. Ensure `https://rsiddqp.github.io/thebook/` is in the Redirect URLs list
3. Verify Site URL is set to production URL
4. Check email templates use `{{ .SiteURL }}` variable
5. Wait a few minutes for changes to propagate

### Issue: "Invalid redirect URL" error

**Solution:**
1. The URL in the email must exactly match one of the Redirect URLs in Supabase
2. Check for trailing slashes - they must match exactly
3. Ensure the GitHub secret `VITE_AUTH_REDIRECT_URL` has the correct URL with trailing slash

### Issue: Build fails in GitHub Actions

**Solution:**
1. Verify all 3 secrets are set in GitHub repository settings
2. Check the Actions logs for specific error messages
3. Ensure the secrets don't have extra spaces or newlines

### Issue: App loads but shows blank page

**Solution:**
1. Check browser console for errors
2. Verify the base path in `vite.config.ts` matches your repository name
3. The base should be `/thebook/` for GitHub Pages

## Environment-Specific Behavior

The app automatically detects the environment:

| Environment | Redirect URL Source | Base Path |
|-------------|-------------------|-----------|
| Local Dev | `.env` file or window.location | `./` |
| GitHub Pages | `VITE_AUTH_REDIRECT_URL` secret | `/thebook/` |
| Custom Domain | `VITE_AUTH_REDIRECT_URL` override | Custom |

## Security Notes

1. **Never commit** `.env` file to git (already in `.gitignore`)
2. **Rotate keys** if they're accidentally exposed
3. Keep Supabase **Redirect URLs** restrictive (only add trusted domains)
4. Use **row-level security** policies in Supabase for data protection

## Next Steps

After successful deployment:

1. ✅ Test user signup flow
2. ✅ Test magic link authentication  
3. ✅ Test password reset flow
4. ✅ Verify email confirmations work
5. Configure custom domain (optional)
6. Set up monitoring and analytics

## Support

If you encounter issues:

1. Check Supabase logs: Dashboard → Logs → Auth Logs
2. Check GitHub Actions logs: Repository → Actions tab
3. Check browser console for JavaScript errors
4. Review this guide's troubleshooting section

## Custom Domain Setup (Optional)

To use a custom domain instead of GitHub Pages:

1. Add your custom domain in: **Repository Settings → Pages → Custom domain**
2. Update DNS records (see GitHub's guide)
3. Update `VITE_AUTH_REDIRECT_URL` secret to your custom domain
4. Add custom domain to Supabase Redirect URLs
5. Update Supabase Site URL to custom domain

---

Last updated: 2026-10-29
