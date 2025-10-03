using API.DTOs;
using API.Extensions;
using API.Interfaces;
using API.Helpers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Text.RegularExpressions;
using API.Data;
using Microsoft.EntityFrameworkCore;

namespace API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NotificationsController : BaseApiController
{
    private readonly INotificationService _notificationService;
    private readonly DataContext _context;

    public NotificationsController(INotificationService notificationService, DataContext context)
    {
        _notificationService = notificationService;
        _context = context;
    }

    private static readonly string[] AllowedTypes = new[]
    {
        "General", "System",
        "DocumentUpload", "RepositoryUpdate", "SchedulerUpdate", "ScheduleUpdate",
        // metadata-only module updates
        "ModuleUpdate",
        //   allow FAQ update notifications to appear in the feed (non-announcement)
        "FaqUpdate"
    };

    private static readonly string[] AllowedAudiences = new[]
    {
        "All", "Students", "Staff", "ModuleStudents"
    };

    private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    { ".jpg", ".jpeg", ".png", ".gif", ".webp" };

    // strips any trailing " (Module: XXXX)" redundancy
    private static string StripModuleSuffix(string? message)
    {
        if (string.IsNullOrWhiteSpace(message)) return string.Empty;
        return Regex.Replace(message, @"\s*\(Module:\s*[^)]+\)\s*$", string.Empty, RegexOptions.IgnoreCase);
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<NotificationDto>>> GetAll([FromQuery] QueryParams queryParams)
    {
        queryParams.CurrentUserName = User.GetUsername();
        var result = await _notificationService.GetAllPaginatedAsync(queryParams);
        Response.AddPaginationHeader(result);
        return Ok(result);
    }

    [HttpPost]
    [Authorize(Roles = "Lecturer,Coordinator,Admin")]
    public async Task<ActionResult<NotificationDto>> Create([FromForm] CreateNotificationDto dto)
    {
        var userName = User.GetUsername();

        // Type validation (null-safe)
        if (string.IsNullOrWhiteSpace(dto.Type) ||
            !AllowedTypes.Any(t => string.Equals(t, dto.Type, StringComparison.OrdinalIgnoreCase)))
        {
            return BadRequest("Invalid notification type.");
        }

        // Audience normalization (null-safe)
        dto.Audience ??= "All";
        if (!AllowedAudiences.Any(a => string.Equals(a, dto.Audience, StringComparison.OrdinalIgnoreCase)))
            return BadRequest("Invalid audience. Allowed: All, Students, Staff, ModuleStudents.");

        // Only Admins can post System announcements
        if (dto.Type.Equals("System", StringComparison.OrdinalIgnoreCase) && !User.IsInRole("Admin"))
            return Forbid("Only Admins can post System announcements.");

        // If audience is module students OR a module was selected, we enforce module-id and prefix the title.
        var wantsModuleScoped =
            dto.ModuleId is not null ||
            string.Equals(dto.Audience, "ModuleStudents", StringComparison.OrdinalIgnoreCase) ||
            User.IsInRole("Lecturer"); // lecturers must post to a specific module

        if (wantsModuleScoped)
        {
            if (dto.ModuleId is null)
                return BadRequest("Please choose a specific module for Module students audience.");

            // Lock the audience to ModuleStudents
            dto.Audience = "ModuleStudents";

            // Fetch module code and prepend to the title (null-safe)
            var module = await _context.Modules.AsNoTracking()
                .FirstOrDefaultAsync(m => m.Id == dto.ModuleId.Value);

            if (module is null)
                return BadRequest("Module not found.");

            var code = (module.ModuleCode ?? string.Empty).Trim();
            if (!string.IsNullOrWhiteSpace(code))
            {
                var currentTitle = dto.Title ?? string.Empty;
                var trimmedTitle = currentTitle.TrimStart();
                var bracket = $"[{code}]";

                if (!trimmedTitle.StartsWith(bracket, StringComparison.OrdinalIgnoreCase))
                {
                    dto.Title = $"{bracket} {currentTitle}".Trim();
                }
                else
                {
                    dto.Title = currentTitle; // keep as-is but ensure non-null
                }
            }
        }

        // 🔒 Restrict files to images only (server-side guard)
        if (dto.Image is not null)
        {
            var contentType = dto.Image.ContentType ?? string.Empty;
            if (string.IsNullOrWhiteSpace(contentType) || !contentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
                return BadRequest("Only image uploads are allowed.");

            var fileName = dto.Image.FileName ?? string.Empty;
            var ext = Path.GetExtension(fileName);
            if (string.IsNullOrEmpty(ext) || !AllowedImageExtensions.Contains(ext))
                return BadRequest("Unsupported image type. Allowed: .jpg, .jpeg, .png, .gif, .webp");
        }

        // Ensure message has no redundant "(Module: CODE)"
        dto.Message = StripModuleSuffix(dto.Message);

        // Also ensure Title is not null when it reaches the service
        dto.Title ??= string.Empty;

        var result = await _notificationService.CreateAsync(dto, userName);
        return Ok(result);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var userName = User.GetUsername();
        var isAdmin = User.IsInRole("Admin");

        var success = await _notificationService.DeleteAsync(id, userName, isAdmin);
        if (!success) return Forbid("You are not authorized to delete this notification.");

        return Ok(new { message = "Notification deleted successfully." });
    }

    [HttpPost("{id}/read")]
    public async Task<ActionResult> MarkRead(int id)
    {
        var userId = int.Parse(User.GetUserId());
        var ok = await _notificationService.MarkAsReadAsync(id, userId);
        if (!ok) return NotFound(new { message = "Notification not found." });
        return Ok(new { message = "Marked as read." });
    }

    [HttpDelete("{id}/read")]
    public async Task<ActionResult> UnmarkRead(int id)
    {
        var userId = int.Parse(User.GetUserId());
        var ok = await _notificationService.UnmarkAsReadAsync(id, userId);
        if (!ok) return NotFound(new { message = "Notification not found or not marked as read." });
        return Ok(new { message = "Marked as unread." });
    }
}
