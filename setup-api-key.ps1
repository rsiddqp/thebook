# Setup script for MusePad Edge Functions
# Run this after logging into Supabase CLI

Write-Host "Setting up Perplexity API key..." -ForegroundColor Green

# Check if supabase CLI is installed
$supabaseVersion = supabase --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Supabase CLI not found. Please install it first." -ForegroundColor Red
    exit 1
}

Write-Host "Supabase CLI version: $supabaseVersion" -ForegroundColor Cyan

# Set the API key
Write-Host "`nSetting PERPLEXITY_API_KEY secret..." -ForegroundColor Yellow
supabase secrets set PERPLEXITY_API_KEY=YOUR_PERPLEXITY_API_KEY --project-ref yzpugjwwiyvtzmzryygu

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ API key set successfully!" -ForegroundColor Green
    Write-Host "`nYour Edge Functions are now configured with Perplexity AI." -ForegroundColor Green
    Write-Host "Refresh your browser at http://localhost:5173/ to start using AI suggestions!" -ForegroundColor Cyan
} else {
    Write-Host "`nError setting API key. You may need to:" -ForegroundColor Red
    Write-Host "1. Run: supabase login" -ForegroundColor Yellow
    Write-Host "2. Then run this script again" -ForegroundColor Yellow
    Write-Host "`nOr set it manually in the Supabase Dashboard:" -ForegroundColor Yellow
    Write-Host "https://supabase.com/dashboard/project/yzpugjwwiyvtzmzryygu/settings/functions" -ForegroundColor Cyan
}
