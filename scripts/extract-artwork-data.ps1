$ErrorActionPreference = "Stop"
$refDir = "C:\Users\galdi\Downloads\בניית אתר 2026\Disegni Local Backup\reference\artwork"
$imgDir = "C:\Users\galdi\Downloads\בניית אתר 2026\Disegni Local Backup\images\artworks"
New-Item -ItemType Directory -Force -Path $imgDir | Out-Null

$order = @(
  @{slug="light"; name="Light"},
  @{slug="precious"; name="Precious"},
  @{slug="dreaming-reality"; name="Dreaming Reality"},
  @{slug="orin"; name="Orin"},
  @{slug="vulnerability-is-strength"; name="Vulnerability Is Strength"},
  @{slug="seed-of-joy"; name="Seed of Joy"},
  @{slug="pure-masculine-and-feminine"; name="Pure Masculine and Feminine"},
  @{slug="moon-cycle-of-healing"; name="Moon Cycle of Healing"},
  @{slug="third-eye-engine"; name="Third Eye Engine"},
  @{slug="power-crystal"; name="Power Crystal"},
  @{slug="exaltation"; name="Exaltation"},
  @{slug="soul-dna"; name="Soul DNA"},
  @{slug="the-pyramid-of-the-one"; name="The Pyramid of the One"},
  @{slug="ying-yang-couple"; name="Ying Yang Couple"},
  @{slug="release-control"; name="Release Control"},
  @{slug="divine-feminine-rivers"; name="Divine Feminine Rivers"},
  @{slug="absorbing-fire"; name="Absorbing Fire"},
  @{slug="peace-with-femininity"; name="Peace With Femininity"},
  @{slug="mystical-yoni"; name="Mystical Yoni"},
  @{slug="transforming-fire-to-water"; name="Transforming Fire to Water"}
)

$results = @()

foreach ($item in $order) {
  $slug = $item.slug
  $name = $item.name
  if ($slug -eq "light") {
    # already built manually
    continue
  }
  $f = Get-ChildItem -LiteralPath $refDir -File | Where-Object { $_.Name -like "$name ｜*" }
  if (-not $f) {
    Write-Output "MISSING FILE FOR: $name"
    continue
  }
  $c = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8

  $medium = [regex]::Match($c, 'class="artwork-detail-medium">([^<]*)<').Groups[1].Value
  $h1 = [regex]::Match($c, 'artwork-detail-copy[^>]*>\s*<p[^>]*>[^<]*</p>\s*<h1[^>]*>([^<]*)<').Groups[1].Value
  $desc = [regex]::Match($c, 'class="artwork-detail-description">([^<]*)<').Groups[1].Value
  $imgMatch = [regex]::Match($c, 'id=artwork-main-image src="data:image/webp;base64,([^"]+)"\s+alt="([^"]*)"')
  if (-not $imgMatch.Success) {
    $imgMatch = [regex]::Match($c, 'id=artwork-main-image alt="([^"]*)" src="data:image/webp;base64,([^"]+)"')
  }

  $alt = ""
  $imgB64 = ""
  # try both attribute orders
  $m1 = [regex]::Match($c, 'id=artwork-main-image src="data:image/webp;base64,([^"]+)" alt="([^"]*)"')
  if ($m1.Success) {
    $imgB64 = $m1.Groups[1].Value
    $alt = $m1.Groups[2].Value
  } else {
    $m2 = [regex]::Match($c, 'id=artwork-main-image alt="([^"]*)" src="data:image/webp;base64,([^"]+)"')
    if ($m2.Success) {
      $alt = $m2.Groups[1].Value
      $imgB64 = $m2.Groups[2].Value
    }
  }

  if ($imgB64) {
    $bytes = [Convert]::FromBase64String($imgB64)
    [IO.File]::WriteAllBytes((Join-Path $imgDir "$slug+WEB.webp"), $bytes)
  } else {
    Write-Output "MISSING IMAGE FOR: $name"
  }

  $results += [PSCustomObject]@{
    slug = $slug
    name = $name
    medium = $medium
    h1 = $h1
    description = $desc
    alt = $alt
    imgBytes = $bytes.Length
  }
}

$results | ConvertTo-Json -Depth 3 | Out-File -FilePath "C:\Users\galdi\Downloads\בניית אתר 2026\Disegni Local Backup\scripts\artwork-data.json" -Encoding utf8
Write-Output "DONE"
$results | Format-Table slug, medium, imgBytes -AutoSize
