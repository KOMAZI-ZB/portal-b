using API.DTOs;
using API.Extensions;
using API.Interfaces;
using API.Helpers;
using AutoMapper;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using API.Data;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[Authorize]
public class RepositoryController(
    IDocumentService documentService,
    INotificationService notificationService,
    IRepositoryService repositoryService,
    IMapper mapper,
    DataContext context) : BaseApiController
{
    private readonly IDocumentService _documentService = documentService;
    private readonly INotificationService _notificationService = notificationService;
    private readonly IRepositoryService _repositoryService = repositoryService;
    private readonly IMapper _mapper = mapper;
    private readonly DataContext _context = context;

    // ============================
    //   Internal Repository Documents
    // ============================

    [Authorize(Roles = "Lecturer,Coordinator,Admin")]
    [HttpPost("upload")]
    public async Task<ActionResult<DocumentDto>> UploadToRepository([FromForm] UploadDocumentDto dto)
    {
        var userName = User.GetUsername();
        dto.Source = "Repository";
        dto.ModuleId = null;

        var result = await _documentService.UploadDocumentAsync(dto, userName);
        if (result == null)
            return BadRequest("Upload failed.");

        // Resolve FirstName + LastName + Role for notification
        var userRecord = await _context.Users
            .Where(u => u.UserName == userName)
            .Select(u => new { u.Id, u.FirstName, u.LastName })
            .SingleOrDefaultAsync();

        string displayName = userName;
        if (userRecord != null)
        {
            var first = (userRecord.FirstName ?? string.Empty).Trim();
            var last = (userRecord.LastName ?? string.Empty).Trim();
            var combined = string.Join(" ", new[] { first, last }.Where(s => !string.IsNullOrWhiteSpace(s)));
            if (!string.IsNullOrWhiteSpace(combined))
                displayName = combined;
        }

        // Pull roles and choose a label (Coordinator > Lecturer > Admin)
        string? roleLabel = null;
        if (userRecord != null)
        {
            var roles = await _context.UserRoles
                .Include(ur => ur.Role)
                .Where(ur => ur.UserId == userRecord.Id)
                .Select(ur => ur.Role.Name)
                .ToListAsync();

            if (roles.Contains("Coordinator")) roleLabel = "Coordinator";
            else if (roles.Contains("Lecturer")) roleLabel = "Lecturer";
            else if (roles.Contains("Admin")) roleLabel = "Admin";
        }

        // Build final display text:
        // - Admin => "Admin" (role only)
        // - Coordinator/Lecturer => "Role First Last"
        // - Fallback => name or username
        string displayWithRole =
            roleLabel == "Admin" ? "Admin"
            : !string.IsNullOrWhiteSpace(roleLabel) ? $"{roleLabel} {displayName}"
            : displayName;

        var notification = new CreateNotificationDto
        {
            Type = "RepositoryUpdate",
            Title = "Internal Repository Updated",
            Message = $"A new document was uploaded by {displayWithRole} to the internal repository.",
            Image = null,
            ModuleId = null
        };

        await _notificationService.CreateAsync(notification, userName);
        return Ok(result);
    }

    [HttpGet]
    public async Task<ActionResult<PagedList<DocumentDto>>> GetRepositoryDocs([FromQuery] QueryParams queryParams)
    {
        var result = await _repositoryService.GetPaginatedInternalDocsAsync(queryParams);
        Response.AddPaginationHeader(result);
        return Ok(result);
    }

    [Authorize]
    [HttpDelete("{documentId}")]
    public async Task<ActionResult> Delete(int documentId)
    {
        var userName = User.GetUsername();
        var isPrivileged = User.IsInRole("Coordinator") || User.IsInRole("Admin");

        var success = await _documentService.DeleteDocumentAsync(documentId, userName, isPrivileged);
        if (!success)
            return StatusCode(403, new { message = "You are not authorized to delete this document." });

        return Ok(new { message = "Document deleted successfully." });
    }

    // ============================
    //   External Repository Links
    // ============================

    [AllowAnonymous]
    [HttpGet("external")]
    public async Task<ActionResult<PagedList<RepositoryDto>>> GetExternalRepositories([FromQuery] QueryParams queryParams)
    {
        var result = await _repositoryService.GetPaginatedExternalAsync(queryParams);
        Response.AddPaginationHeader(result);
        return Ok(result);
    }

    [Authorize(Roles = "Coordinator,Admin")]
    [HttpPost("external")]
    public async Task<ActionResult<RepositoryDto>> AddExternalRepository([FromForm] RepositoryDto dto)
    {
        // Fallback if no image is uploaded
        if (dto.Image == null)
        {
            dto.ImageUrl = "/assets/database.png";
        }
        else
        {
            dto.ImageUrl = await _repositoryService.UploadImageAsync(dto.Image);
        }

        var created = await _repositoryService.AddAsync(dto);

        //   NEW: Fire a clickable notification that routes to Repository → Links
        var createdBy = User.GetUsername();
        await _notificationService.CreateAsync(new CreateNotificationDto
        {
            Type = "RepositoryUpdate",
            Title = "External Repository Link Added",
            Message = $"A new external repository link \"{created.Label}\" was added.",
            Audience = "All",
            ModuleId = null
        }, createdBy);

        return CreatedAtAction(nameof(GetExternalRepositories), new { id = created.Id }, created);
    }

    [Authorize(Roles = "Coordinator,Admin")]
    [HttpDelete("external/{id}")]
    public async Task<ActionResult> DeleteExternalRepository(int id)
    {
        var success = await _repositoryService.DeleteAsync(id);
        if (!success)
            return NotFound(new { message = "Repository link not found or already removed." });

        return Ok(new { message = "External repository removed." });
    }
}
