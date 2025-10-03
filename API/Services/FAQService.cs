using API.Data;
using API.DTOs;
using API.Entities;
using API.Helpers;
using API.Interfaces;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using Microsoft.EntityFrameworkCore;

namespace API.Services;

public class FAQService(DataContext context, IMapper mapper) : IFAQService
{
    private readonly DataContext _context = context;
    private readonly IMapper _mapper = mapper;

    // Character-based limits
    private const int MinChars = 5;
    private const int MaxChars = 5000;

    private static bool IsValid(string? question, string? answer)
    {
        if (string.IsNullOrWhiteSpace(question) || string.IsNullOrWhiteSpace(answer)) return false;

        var qLen = question.Trim().Length;
        var aLen = answer.Trim().Length;

        if (qLen < MinChars || aLen < MinChars) return false;
        if (qLen > MaxChars || aLen > MaxChars) return false;
        return true;
    }

    public async Task<PagedList<FaqEntryDto>> GetAllPaginatedFAQsAsync(QueryParams queryParams)
    {
        var isSqlite = _context.Database.IsSqlite();

        var baseQuery = _context.FaqEntries.AsQueryable();

        var ordered = isSqlite
            ? baseQuery.OrderByDescending(f => f.Id)
            : baseQuery.OrderByDescending(f => f.LastUpdated);

        var projected = ordered
            .ProjectTo<FaqEntryDto>(_mapper.ConfigurationProvider)
            .AsQueryable();

        return await PagedList<FaqEntryDto>.CreateAsync(
            projected,
            queryParams.PageNumber,
            queryParams.PageSize
        );
    }

    public async Task<IEnumerable<FaqEntryDto>> GetAllFAQsAsync()
    {
        var isSqlite = _context.Database.IsSqlite();

        var baseQuery = _context.FaqEntries.AsQueryable();

        var ordered = isSqlite
            ? baseQuery.OrderByDescending(f => f.Id)
            : baseQuery.OrderByDescending(f => f.LastUpdated);

        return await ordered
            .ProjectTo<FaqEntryDto>(_mapper.ConfigurationProvider)
            .ToListAsync();
    }

    public async Task<bool> CreateFaqAsync(string question, string answer)
    {
        // Defensive validation (character-based)
        if (!IsValid(question, answer)) return false;

        var newEntry = new FaqEntry
        {
            Question = question.Trim(),
            Answer = answer.Trim(),
            LastUpdated = DateTimeOffset.UtcNow
        };

        _context.FaqEntries.Add(newEntry);
        return await _context.SaveChangesAsync() > 0;
    }

    public async Task<bool> UpdateFaqAsync(int id, string question, string answer)
    {
        // Defensive validation (character-based)
        if (!IsValid(question, answer)) return false;

        var entry = await _context.FaqEntries.FindAsync(id);
        if (entry == null) return false;

        entry.Question = question.Trim();
        entry.Answer = answer.Trim();
        entry.LastUpdated = DateTimeOffset.UtcNow;

        return await _context.SaveChangesAsync() > 0;
    }

    public async Task<bool> DeleteFaqAsync(int id)
    {
        var entry = await _context.FaqEntries.FindAsync(id);
        if (entry == null) return false;

        _context.FaqEntries.Remove(entry);
        return await _context.SaveChangesAsync() > 0;
    }
}
