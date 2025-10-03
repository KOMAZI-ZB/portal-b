using API.Data;
using API.DTOs;
using API.Entities;
using API.Helpers;
using API.Interfaces;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;

namespace API.Services;

public class RepositoryService : IRepositoryService
{
    private readonly DataContext _context;
    private readonly IMapper _mapper;
    private readonly Cloudinary _cloudinary;

    public RepositoryService(DataContext context, IMapper mapper, IConfiguration config)
    {
        _context = context;
        _mapper = mapper;

        var acc = new Account(
            config["CloudinarySettings:CloudName"],
            config["CloudinarySettings:ApiKey"],
            config["CloudinarySettings:ApiSecret"]
        );

        _cloudinary = new Cloudinary(acc);
    }

    // ✅ Return all external repositories (legacy use only)
    public async Task<IEnumerable<Repository>> GetAllAsync()
    {
        return await _context.Repositories.ToListAsync();
    }

    // ✅ Return paginated external repositories
    public async Task<PagedList<RepositoryDto>> GetPaginatedExternalAsync(QueryParams queryParams)
    {
        var query = _context.Repositories
            .OrderBy(r => r.Label)
            .ProjectTo<RepositoryDto>(_mapper.ConfigurationProvider)
            .AsQueryable();

        return await PagedList<RepositoryDto>.CreateAsync(query, queryParams.PageNumber, queryParams.PageSize);
    }

    // ✅ Add new repository (with fallback if no image is provided)
    public async Task<RepositoryDto> AddAsync(RepositoryDto dto)
    {
        var repo = new Repository
        {
            Label = dto.Label,
            LinkUrl = dto.LinkUrl,
            ImageUrl = string.IsNullOrWhiteSpace(dto.ImageUrl)
                ? "/assets/database.png"
                : dto.ImageUrl
        };

        _context.Repositories.Add(repo);
        await _context.SaveChangesAsync();

        return _mapper.Map<RepositoryDto>(repo);
    }

    // ✅ Upload repository image to Cloudinary
    public async Task<string> UploadImageAsync(IFormFile file)
    {
        using var stream = file.OpenReadStream();
        var uploadParams = new RawUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            Folder = "academic-portal-repositories"
        };

        var uploadResult = await _cloudinary.UploadAsync(uploadParams);

        if (uploadResult.Error != null)
            throw new Exception(uploadResult.Error.Message);

        return uploadResult.SecureUrl.AbsoluteUri;
    }

    // ✅ Delete external repository
    public async Task<bool> DeleteAsync(int id)
    {
        var repo = await _context.Repositories.FindAsync(id);
        if (repo == null) return false;

        _context.Repositories.Remove(repo);
        return await _context.SaveChangesAsync() > 0;
    }

    // ✅ Paginated internal documents where Source = "Repository"
    public async Task<PagedList<DocumentDto>> GetPaginatedInternalDocsAsync(QueryParams queryParams)
    {
        var isSqlite = _context.Database.IsSqlite();

        var baseQuery = _context.Documents
            .Where(d => d.Source == "Repository");

        // SQLite can't ORDER BY DateTimeOffset — fall back to Id for consistent newest-first ordering.
        var ordered = isSqlite
            ? baseQuery.OrderByDescending(d => d.Id)
            : baseQuery.OrderByDescending(d => d.UploadedAt);

        var projected = ordered
            .ProjectTo<DocumentDto>(_mapper.ConfigurationProvider)
            .AsQueryable();

        return await PagedList<DocumentDto>.CreateAsync(projected, queryParams.PageNumber, queryParams.PageSize);
    }
}
