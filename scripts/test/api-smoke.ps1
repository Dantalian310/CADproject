param(
  [string]$BaseUrl = "http://127.0.0.1:8080"
)

$ErrorActionPreference = "Stop"

function Invoke-CloudCadApi {
  param(
    [string]$Method,
    [string]$Path,
    [object]$Body = $null,
    [string]$Token = ""
  )

  $headers = @{}
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  $parameters = @{
    Method = $Method
    Uri = "$BaseUrl$Path"
    Headers = $headers
  }

  if ($null -ne $Body) {
    $parameters["ContentType"] = "application/json"
    $parameters["Body"] = ($Body | ConvertTo-Json -Depth 30)
  }

  Invoke-RestMethod @parameters
}

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) {
    throw "Assertion failed: $Message"
  }
  Write-Host "[PASS] $Message"
}

$stamp = "{0}{1}" -f (Get-Date -Format "yyyyMMddHHmmssfff"), (Get-Random -Minimum 1000 -Maximum 9999)
$owner = "owner$stamp"
$member = "member$stamp"

Write-Host "Cloud CAD API smoke test against $BaseUrl"

$ownerAuth = Invoke-CloudCadApi POST "/api/auth/register" @{
  username = $owner
  email = "$owner@example.com"
  password = "Password123"
}
$ownerToken = $ownerAuth.data.token
Assert-True ($ownerAuth.success -and $ownerToken) "owner registration returns token"

$me = Invoke-CloudCadApi GET "/api/auth/me" $null $ownerToken
Assert-True ($me.data.username -eq $owner) "authenticated current user"

$memberAuth = Invoke-CloudCadApi POST "/api/auth/register" @{
  username = $member
  email = "$member@example.com"
  password = "Password123"
}
$memberToken = $memberAuth.data.token
Assert-True ($memberAuth.success -and $memberToken) "member registration returns token"

$project = Invoke-CloudCadApi POST "/api/projects" @{
  name = "Smoke CAD Project $stamp"
  description = "Created by api-smoke.ps1"
} $ownerToken
Assert-True ($project.data.defaultDocumentId -gt 0) "project creation creates default document"

$projects = Invoke-CloudCadApi GET "/api/projects" $null $ownerToken
Assert-True ($projects.data.Count -ge 1) "owner can list projects"

$updatedProject = Invoke-CloudCadApi PATCH "/api/projects/$($project.data.id)" @{
  name = "Smoke CAD Project Updated $stamp"
  description = "Updated by api-smoke.ps1"
} $ownerToken
Assert-True ($updatedProject.data.name -like "*Updated*") "owner can update project metadata"

$invitation = Invoke-CloudCadApi POST "/api/projects/$($project.data.id)/invitations" @{
  account = "$member@example.com"
  role = "EDITOR"
} $ownerToken
Assert-True ($invitation.data.role -eq "EDITOR" -and $invitation.data.status -eq "PENDING") "owner can invite editor member"

$pendingInvitations = Invoke-CloudCadApi GET "/api/project-invitations/pending" $null $memberToken
Assert-True (@($pendingInvitations.data | Where-Object { $_.id -eq $invitation.data.id }).Count -eq 1) "member can list pending invitation"

$acceptedInvitation = Invoke-CloudCadApi POST "/api/project-invitations/$($invitation.data.id)/accept" $null $memberToken
Assert-True ($acceptedInvitation.data.status -eq "ACCEPTED") "member can accept project invitation"

$memberProjects = Invoke-CloudCadApi GET "/api/projects" $null $memberToken
Assert-True ($memberProjects.data.Count -ge 1) "accepted member can list shared project"

$documentId = $project.data.defaultDocumentId
$document = Invoke-CloudCadApi GET "/api/documents/$documentId" $null $ownerToken
Assert-True ($document.data.currentVersion -ge 1) "default document has initial version"

$snapshot = $document.data.snapshotJson
$snapshot.metadata.currentVersion = $document.data.currentVersion
$snapshot.features += [pscustomobject]@{
  id = "smoke-feature-$stamp"
  type = "extrude"
  name = "Smoke Extrude"
  suppressed = $false
  sourceSketchId = "sketch-001"
  sourceEntityId = "smoke-rect-$stamp"
  depth = 20
  operation = "new"
}
$snapshot.sketches[0].entities += [pscustomobject]@{
  id = "smoke-rect-$stamp"
  type = "rectangle"
  name = "Smoke Rectangle"
  visible = $true
  origin = @{ x = 0; y = 0 }
  width = 40
  height = 30
}

$saved = Invoke-CloudCadApi PUT "/api/documents/$documentId/save" @{
  baseVersion = $document.data.currentVersion
  snapshotJson = $snapshot
  message = "smoke save"
} $ownerToken
Assert-True ($saved.data.currentVersion -eq ($document.data.currentVersion + 1)) "saving document creates next version"

$versions = Invoke-CloudCadApi GET "/api/documents/$documentId/versions" $null $ownerToken
Assert-True ($versions.data.Count -ge 2) "version list contains initial and saved versions"

$restored = Invoke-CloudCadApi POST "/api/documents/$documentId/versions/$($versions.data[-1].id)/restore" @{
  message = "smoke restore"
} $ownerToken
Assert-True ($restored.data.currentVersion -eq ($saved.data.currentVersion + 1)) "restore creates a new version"

$conflictDetected = $false
try {
  Invoke-CloudCadApi PUT "/api/documents/$documentId/save" @{
    baseVersion = $document.data.currentVersion
    snapshotJson = $snapshot
    message = "stale save"
  } $ownerToken | Out-Null
} catch {
  $conflictDetected = $_.Exception.Response.StatusCode.value__ -eq 409
}
Assert-True $conflictDetected "stale save is rejected with 409 conflict"

$deleted = Invoke-CloudCadApi DELETE "/api/projects/$($project.data.id)" $null $ownerToken
Assert-True ($deleted.data -eq $true) "owner can delete project"

$projectsAfterDelete = Invoke-CloudCadApi GET "/api/projects" $null $ownerToken
$deletedProjectVisible = @($projectsAfterDelete.data | Where-Object { $_.id -eq $project.data.id }).Count -gt 0
Assert-True (-not $deletedProjectVisible) "deleted project is removed from owner project list"

Write-Host "Cloud CAD API smoke test completed."
