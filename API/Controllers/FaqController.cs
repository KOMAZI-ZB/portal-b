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

    // Validation rules (character-based)
    private const int MinChars = 5;
    private const int MaxChars = 5000;

    public FaqController(IFAQService faqService, INotificationService notificationService)
    {
        _faqService = faqService;
        _notificationService = notificationService;
    }

    [HttpGet]
    public async Task<ActionResult<PagedList<FaqEntryDto>>> GetAll([FromQuery] QueryParams queryParams)
    {
        var result = await _faqService.GetAllPaginatedFAQsAsync(queryParams);

        Response.AddPaginationHeader(result);
        return Ok(result);
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpPost("create")]
    public async Task<ActionResult> Create([FromBody] FaqEntryDto dto)
    {
        var (ok, error) = ValidateFaq(dto.Question, dto.Answer ?? string.Empty);
        if (!ok) return BadRequest(error);

        var success = await _faqService.CreateFaqAsync(dto.Question, dto.Answer ?? string.Empty);
        if (!success) return BadRequest("Failed to create FAQ.");

        var userName = User.GetUsername();
        await _notificationService.CreateAsync(new CreateNotificationDto
        {
            Type = "FaqUpdate",
            Title = "FAQ Created",
            Message = $"A new FAQ was posted: {dto.Question}",
            Audience = "All",
            ModuleId = null
        }, userName);

        return Ok(new { message = "FAQ created successfully." });
    }

    [Authorize(Policy = "RequireAdminRole")]
    [HttpPut("update/{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] FaqEntryDto dto)
    {
        var (ok, error) = ValidateFaq(dto.Question, dto.Answer ?? string.Empty);
        if (!ok) return BadRequest(error);

        var success = await _faqService.UpdateFaqAsync(id, dto.Question, dto.Answer ?? string.Empty);
        if (!success) return BadRequest("Failed to update FAQ.");

        var userName = User.GetUsername();
        await _notificationService.CreateAsync(new CreateNotificationDto
        {
            Type = "FaqUpdate",
            Title = "FAQ Updated",
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
        if (!success) return BadRequest("Failed to delete FAQ entry.");
        return Ok(new { message = "FAQ entry deleted successfully." });
    }

    // ---- helpers (character-based) ----
    private static int CharCount(string? s)
    {
        return string.IsNullOrWhiteSpace(s) ? 0 : s.Trim().Length;
    }

    private static (bool ok, string? error) ValidateFaq(string? question, string? answer)
    {
        if (string.IsNullOrWhiteSpace(question))
            return (false, "Question cannot be empty or whitespace.");
        if (string.IsNullOrWhiteSpace(answer))
            return (false, "Answer cannot be empty or whitespace.");

        var qLen = CharCount(question);
        var aLen = CharCount(answer);

        if (qLen < MinChars)
            return (false, $"Question is too short. Minimum {MinChars} characters required.");
        if (aLen < MinChars)
            return (false, $"Answer is too short. Minimum {MinChars} characters required.");

        if (qLen > MaxChars)
            return (false, $"Question is too long. Maximum {MaxChars} characters allowed.");
        if (aLen > MaxChars)
            return (false, $"Answer is too long. Maximum {MaxChars} characters allowed.");

        return (true, null);
    }
}
