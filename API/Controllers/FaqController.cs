using API.DTOs;
using API.Extensions;
using API.Helpers;
using API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class FaqController : ControllerBase
{
    private readonly IFAQService _faqService;
    private readonly INotificationService _notificationService;

    public FaqController(IFAQService faqService, INotificationService notificationService)
    {
        _faqService = faqService;
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedList<FaqEntryDto>>> GetAll([FromQuery] QueryParams queryParams)
    {
        var result = await _faqService.GetAllPaginatedFAQsAsync(queryParams);

        // ✅ Set pagination header for client-side parsing
        Response.AddPaginationHeader(result);

        // ✅ Return paginated list directly
        return Ok(result);
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpPost("create")]
    public async Task<ActionResult> Create([FromBody] FaqEntryDto dto)
    {
        var success = await _faqService.CreateFaqAsync(dto.Question, dto.Answer ?? string.Empty);

        if (!success)
            return BadRequest("Failed to create FAQ.");

        // 🔔 Auto-announce: General Announcement → Audience: All
        var userName = User.GetUsername();
        await _notificationService.CreateAsync(new CreateNotificationDto
        {
            Type = "General",                        // announcements are General/System
            Title = "New FAQ Announcement",          // naming convention ends with “Announcement”
            Message = $"A new FAQ was posted: {dto.Question}",
            Audience = "All",                        // visible to everyone
            ModuleId = null                          // not module-scoped
        }, userName);

        return Ok(new { message = "FAQ created successfully." });
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpPut("update/{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] FaqEntryDto dto)
    {
        var success = await _faqService.UpdateFaqAsync(id, dto.Question, dto.Answer ?? string.Empty);

        if (!success)
            return BadRequest("Failed to update FAQ.");

        // 🔔 Auto-announce: General Announcement → Audience: All
        var userName = User.GetUsername();
        await _notificationService.CreateAsync(new CreateNotificationDto
        {
            Type = "General",
            Title = "FAQ Updated Announcement",
            Message = $"An FAQ was updated: {dto.Question}",
            Audience = "All",
            ModuleId = null
        }, userName);

        return Ok(new { message = "FAQ updated successfully." });
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        var success = await _faqService.DeleteFaqAsync(id);

        if (!success)
            return BadRequest("Failed to delete FAQ entry.");

        return Ok(new { message = "FAQ entry deleted successfully." });
    }
}
