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

    public async Task<PagedList<FaqEntryDto>> GetAllPaginatedFAQsAsync(QueryParams queryParams)
    {
        // SQLite cannot ORDER BY DateTimeOffset; use Id fallback there.
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
        var newEntry = new FaqEntry
        {
            Question = question,
            Answer = answer,
            LastUpdated = DateTimeOffset.UtcNow // UTC with offset
        };

        _context.FaqEntries.Add(newEntry);
        return await _context.SaveChangesAsync() > 0;
    }

    public async Task<bool> UpdateFaqAsync(int id, string question, string answer)
    {
        var entry = await _context.FaqEntries.FindAsync(id);
        if (entry == null) return false;

        entry.Question = question;
        entry.Answer = answer;
        entry.LastUpdated = DateTimeOffset.UtcNow; // UTC with offset

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
