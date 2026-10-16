# Instalador de bond para Windows:
#   powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/jmanuelcorral/bond/main/install.ps1 | iex"
#
# Descarga bond-windows-x64.exe de la release de GitHub, comprueba su SHA-256 y lo deja en
# %LOCALAPPDATA%\bond\bin (o en $env:BOND_INSTALL_DIR), que añade al PATH del usuario.
#   $env:BOND_VERSION = "v1.0.0"   versión concreta (defecto: la última)
$ErrorActionPreference = "Stop"

$Repo = "jmanuelcorral/bond"
$Dir = if ($env:BOND_INSTALL_DIR) { $env:BOND_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA "bond\bin" }
$Version = if ($env:BOND_VERSION) { $env:BOND_VERSION } else { "latest" }
$Asset = "bond-windows-x64.exe"
$Base = if ($Version -eq "latest") { "https://github.com/$Repo/releases/latest/download" } else { "https://github.com/$Repo/releases/download/$Version" }

if ($env:PROCESSOR_ARCHITECTURE -notin @("AMD64", "ARM64")) { throw "arquitectura no soportada: $env:PROCESSOR_ARCHITECTURE" }

$Tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("bond-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $Tmp | Out-Null
try {
	Write-Host "==> Descargando $Asset ($Version)"
	Invoke-WebRequest -UseBasicParsing "$Base/$Asset" -OutFile (Join-Path $Tmp $Asset)
	Invoke-WebRequest -UseBasicParsing "$Base/SHA256SUMS" -OutFile (Join-Path $Tmp "SHA256SUMS")

	$Line = Get-Content (Join-Path $Tmp "SHA256SUMS") | Where-Object { $_ -match " $([regex]::Escape($Asset))$" }
	if (-not $Line) { throw "$Asset no aparece en SHA256SUMS" }
	$Expected = ($Line -split " ")[0]
	$Actual = (Get-FileHash -Algorithm SHA256 (Join-Path $Tmp $Asset)).Hash.ToLower()
	if ($Expected -ne $Actual) { throw "la suma SHA-256 no coincide: descarga corrupta o alterada" }

	New-Item -ItemType Directory -Force -Path $Dir | Out-Null
	Copy-Item (Join-Path $Tmp $Asset) (Join-Path $Dir "bond.exe") -Force
	$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
	if (($UserPath -split ";") -notcontains $Dir) {
		[Environment]::SetEnvironmentVariable("Path", "$UserPath;$Dir", "User")
		Write-Host "==> $Dir añadido al PATH del usuario (abre una terminal nueva)"
	}
	Write-Host "==> bond instalado en $Dir\bond.exe"
	Write-Host ""
	Write-Host "Siguiente: bond setup"
} finally {
	Remove-Item -Recurse -Force $Tmp
}
