# Rendered by CI from packaging/chocolatey/tools/chocolateyinstall.ps1:
# __VERSION__ -> release version, __EXESHA__ -> SHA-256 of the x64 NSIS installer.
$ErrorActionPreference = 'Stop'

$packageArgs = @{
    packageName    = $env:ChocolateyPackageName
    fileType       = 'exe'
    url            = 'https://github.com/KurtStevenK/cursor-auto-runner/releases/download/v__VERSION__/Cursor%20Auto%20Runner%20Setup%20__VERSION__.exe'
    checksum       = '__EXESHA__'
    checksumType   = 'sha256'
    silentArgs     = '/S'
    validExitCodes = @(0)
}

Install-ChocolateyPackage @packageArgs
