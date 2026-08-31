# build-msix.ps1
# Script to build MSIX package locally for Strata (Tauri 2) with DevTools enabled

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Building Strata MSIX Bundle Locally " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Certificate Setup
$expectedPublisher = "CN=2A6645F7-50D0-4D25-AF43-D299C49EA719"
$pfxPath = "certificate.pfx"
$pfxPass = "strata-auto-signed-msix"

if (-not (Test-Path $pfxPath)) {
    Write-Host "[1/3] Generating self-signed certificate ($expectedPublisher)..." -ForegroundColor Yellow
    
    # Attempt PKI module import first
    try {
        Import-Module PKI -ErrorAction SilentlyContinue
        Import-Module Microsoft.PowerShell.Security -ErrorAction SilentlyContinue
    } catch {}

    if (Test-Path "Cert:\") {
        $cert = New-SelfSignedCertificate -Type Custom `
          -Subject $expectedPublisher `
          -KeyUsage DigitalSignature `
          -FriendlyName "FrStudios Strata Local" `
          -CertStoreLocation "Cert:\CurrentUser\My" `
          -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3")

        $secPass = ConvertTo-SecureString -String $pfxPass -AsPlainText -Force
        Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $secPass | Out-Null
    } else {
        Write-Host "Using .NET CertificateRequest fallback..." -ForegroundColor Yellow
        Add-Type -AssemblyName System.Security

        $rsa = [System.Security.Cryptography.RSA]::Create(2048)
        $req = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
            $expectedPublisher,
            $rsa,
            [System.Security.Cryptography.HashAlgorithmName]::SHA256,
            [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
        )

        $req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new([System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature, $true))

        $oidCollection = [System.Security.Cryptography.OidCollection]::new()
        $oidCollection.Add([System.Security.Cryptography.Oid]::new("1.3.6.1.5.5.7.3.3"))
        $req.CertificateExtensions.Add([System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oidCollection, $false))

        $cert = $req.CreateSelfSigned([DateTimeOffset]::Now.AddDays(-1), [DateTimeOffset]::Now.AddYears(5))
        $pfxBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Pfx, $pfxPass)
        [System.IO.File]::WriteAllBytes($pfxPath, $pfxBytes)
    }

    Write-Host "Certificate generated successfully at $pfxPath." -ForegroundColor Green
} else {
    Write-Host "[1/3] Using existing $pfxPath..." -ForegroundColor Green
}

# Copy PFX to required Tauri directories
New-Item -ItemType Directory -Force -Path "src-tauri\gen\windows" | Out-Null
Copy-Item $pfxPath src-tauri\certificate.pfx -Force
Copy-Item $pfxPath src-tauri\gen\windows\certificate.pfx -Force

# Set environment variable for PFX password
$env:MSIX_PFX_PASSWORD = $pfxPass

# 2. Build MSIX Bundle using @choochmeque/tauri-windows-bundle
Write-Host "[2/3] Building MSIX package with @choochmeque/tauri-windows-bundle..." -ForegroundColor Yellow

npx @choochmeque/tauri-windows-bundle build --arch x64 --runner npm --verbose

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[3/3] MSIX Build Complete!" -ForegroundColor Green
    Write-Host "Output bundle location:" -ForegroundColor Cyan
    Get-ChildItem -Path "src-tauri\target\msix\*.msixbundle", "src-tauri\target\msix\*.msix" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
} else {
    Write-Host "[ERROR] MSIX build failed with exit code $LASTEXITCODE" -ForegroundColor Red
}
