using API.DTOs;
using API.Extensions;
using API.Helpers;
using API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Text.RegularExpressions;

namespace API.Controllers;

[Authorize]
public class DocumentsController(
    IDocumentService documentService,
    INotificationService notificationService) : BaseApiController
{
    private readonly IDocumentService _documentService = documentService;
    private readonly INotificationService _notificationService = notificationService;

    private static readonly HashSet<string> AllowedExts = new(StringComparer.OrdinalIgnoreCase)
        { ".pdf", ".docx", ".ppt", ".xlsx", ".txt" };

    private static readonly Dictionary<string, string> AllowedMimeByExt = new(StringComparer.OrdinalIgnoreCase)
    {
        [".pdf"] = "application/pdf",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".ppt"] = "application/vnd.ms-powerpoint",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        [".txt"] = "text/plain"
    };

    private static string StripModuleSuffix(string? message)
    {
        if (string.IsNullOrWhiteSpace(message)) return message ?? string.Empty;
        return Regex.Replace(message, @"\s*\(Module:\s*[^)]+\)\s*$", string.Empty, RegexOptions.IgnoreCase);
    }

    private static (bool ok, string? error) ValidateFile(IFormFile? file)
    {
        if (file == null || file.Length == 0)
            return (false, "No file provided.");

        var ext = Path.GetExtension(file.FileName ?? string.Empty);
        if (string.IsNullOrWhiteSpace(ext) || !AllowedExts.Contains(ext))
            return (false, "Only PDF, DOCX, PPT, XLSX, TXT are allowed.");

        // Enforce MIME to match allow-list exactly
        var contentType = file.ContentType ?? string.Empty;
        if (!AllowedMimeByExt.TryGetValue(ext, out var expected) || !string.Equals(contentType, expected, StringComparison.OrdinalIgnoreCase))
            return (false, "Only PDF, DOCX, PPT, XLSX, TXT are allowed.");

        // NOTE: .pptx is intentionally NOT allowed unless already supported; we only accept .ppt here.
        return (true, null);
    }

    [Authorize(Roles = "Lecturer,Coordinator,Admin")]
    [HttpPost("upload")]
    public async Task<ActionResult<DocumentDto>> Upload([FromForm] UploadDocumentDto dto)
    {
        // Defensive API-level allow-list enforcement (extension AND MIME)
        var (ok, error) = ValidateFile(dto.File);
        if (!ok)
            return StatusCode(415, "Only PDF, DOCX, PPT, XLSX, TXT are allowed.");

        var userName = User.GetUsername();
        var result = await _documentService.UploadDocumentAsync(dto, userName);
        if (result == null) return BadRequest("Upload failed.");

        var notification = new CreateNotificationDto
        {
            Type = "DocumentUpload",
            Title = "New Module Document Uploaded",
            Message = StripModuleSuffix($"A new document has been uploaded with title: {dto.Title}."),
            Image = null,
            ModuleId = dto.ModuleId
        };

        await _notificationService.CreateAsync(notification, userName);
        return Ok(result);
    }

    [HttpGet("module/{moduleId}")]
    public async Task<ActionResult<IEnumerable<DocumentDto>>> GetByModule(int moduleId)
    {
        var result = await _documentService.GetDocumentsByModuleAsync(moduleId);
        return Ok(result);
    }

    [HttpGet("module/{moduleId}/paged")]
    public async Task<ActionResult<PagedList<DocumentDto>>> GetByModulePaged(
        int moduleId, [FromQuery] PaginationParams paginationParams)
    {
        var pagedResult = await _documentService.GetDocumentsByModulePaginatedAsync(moduleId, paginationParams);
        Response.AddPaginationHeader(pagedResult);
        return Ok(pagedResult);
    }

    [Authorize]
    [HttpDelete("{documentId}")]
    public async Task<ActionResult> Delete(int documentId)
    {
        var userName = User.GetUsername();
        var isPrivileged = User.IsInRole("Coordinator") || User.IsInRole("Admin");

        var success = await _documentService.DeleteDocumentAsync(documentId, userName, isPrivileged);
        if (!success)
            return StatusCode(403, new { message = "You do not have permission to delete this document." });

        return Ok(new { message = "Document deleted successfully." });
    }

    [Authorize(Roles = "Lecturer,Coordinator,Admin")]
    [HttpGet("all")]
    public async Task<ActionResult<IEnumerable<DocumentDto>>> GetAllModuleDocuments()
    {
        var allModuleDocs = await _documentService.GetDocumentsByModuleAsync(0);
        return Ok(allModuleDocs);
    }
}
