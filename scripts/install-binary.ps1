$ErrorActionPreference="Stop"
New-Item -ItemType Directory -Force bin|Out-Null
Invoke-WebRequest "https://github.com/neospeed83/herdr-replay/releases/latest/download/herdr-replay-windows-x86_64.exe" -OutFile "bin/herdr-replay.exe"
