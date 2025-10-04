using API.Data;
using API.DTOs;
using API.Entities;
using API.Helpers;
using API.Interfaces;
using AutoMapper;
using AutoMapper.QueryableExtensions;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Microsoft.EntityFrameworkCore;

namespace API.Services
{
    public class DocumentRepository : IDocumentService
    {
        private readonly DataContext _context;
        private readonly IMapper _mapper;
        private readonly Cloudinary _cloudinary;

        public DocumentRepository(DataContext context, IMapper mapper, IConfiguration config)
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

        public async Task<DocumentDto> UploadDocumentAsync(UploadDocumentDto dto, string uploaderUserName)
        {
            var user = await _context.Users
                .Include(u => u.UserModules)
                .SingleOrDefaultAsync(u => u.UserName == uploaderUserName);

            if (user == null)
                throw new Exception("User not found.");

            if (dto.Source == "Module")
            {
                if (!dto.ModuleId.HasValue)
                    throw new Exception("ModuleId is required for module uploads.");

                var moduleId = dto.ModuleId.Value;

                var moduleExists = await _context.Modules.AnyAsync(m => m.Id == moduleId);
                if (!moduleExists)
                    throw new Exception("Module not found.");

                var roles = await _context.UserRoles
                    .Include(ur => ur.Role)
                    .Where(ur => ur.UserId == user.Id)
                    .Select(ur => ur.Role.Name)
                    .ToListAsync();

                bool isAdmin = roles.Contains("Admin");
                bool isCoordinator = roles.Contains("Coordinator");
                bool isLecturer = roles.Contains("Lecturer");

                if (isLecturer && !isCoordinator && !isAdmin)
                {
                    var lecturerAssigned = user.UserModules.Any(um =>
                        um.ModuleId == moduleId &&
                        (um.RoleContext == "Lecturer" || um.RoleContext == "Coordinator"));

                    if (!lecturerAssigned)
                        throw new Exception("Lecturers can only upload to modules they are assigned to.");
                }
            }

            if (dto.File == null || dto.File.Length == 0)
                throw new Exception("No file provided.");

            RawUploadResult uploadResult;
            using var stream = dto.File.OpenReadStream();

            var uploadParams = new RawUploadParams
            {
                File = new FileDescription(dto.File.FileName, stream),
                Folder = "academic-portal-docs",
                Type = "upload"
            };

            uploadResult = await _cloudinary.UploadAsync(uploadParams, "raw");

            if (uploadResult.Error != null)
                throw new Exception(uploadResult.Error.Message);

            var fileUrl =
                uploadResult.SecureUrl?.AbsoluteUri ??
                uploadResult.Url?.AbsoluteUri ??
                throw new Exception("Upload succeeded, but no URL was returned by Cloudinary.");

            var userRole = await _context.UserRoles
                .Include(ur => ur.Role)
                .Where(ur => ur.UserId == user.Id)
                .Select(ur => ur.Role.Name)
                .FirstOrDefaultAsync();

            var document = new Document
            {
                Title = dto.Title,
                FilePath = fileUrl,
                UploadedBy = userRole ?? "Unknown",
                UploadedByUserName = user.UserName
                    ?? throw new InvalidOperationException("User has no username."),
                UploadedAt = DateTimeOffset.UtcNow,
                ModuleId = dto.ModuleId,
                Source = dto.Source
            };

            _context.Documents.Add(document);
            await _context.SaveChangesAsync();

            return _mapper.Map<DocumentDto>(document);
        }

        public async Task<IEnumerable<DocumentDto>> GetDocumentsByModuleAsync(int moduleId)
        {
            var isSqlite = _context.Database.IsSqlite();

            var query = _context.Documents.AsQueryable();

            if (moduleId > 0)
                query = query.Where(d => d.ModuleId == moduleId);
            else
                query = query.Where(d => d.ModuleId != null);

            // SQLite cannot ORDER BY DateTimeOffset. Use Id as a proxy on SQLite.
            query = isSqlite
                ? query.OrderByDescending(d => d.Id)
                : query.OrderByDescending(d => d.UploadedAt);

            return await query
                .ProjectTo<DocumentDto>(_mapper.ConfigurationProvider)
                .ToListAsync();
        }

        public async Task<PagedList<DocumentDto>> GetDocumentsByModulePaginatedAsync(
            int moduleId, PaginationParams paginationParams)
        {
            var isSqlite = _context.Database.IsSqlite();

            var query = _context.Documents.AsQueryable();

            if (moduleId > 0)
                query = query.Where(d => d.ModuleId == moduleId);
            else
                query = query.Where(d => d.ModuleId != null);

            query = isSqlite
                ? query.OrderByDescending(d => d.Id)
                : query.OrderByDescending(d => d.UploadedAt);

            return await PagedList<DocumentDto>.CreateAsync(
                query.ProjectTo<DocumentDto>(_mapper.ConfigurationProvider),
                paginationParams.PageNumber,
                paginationParams.PageSize
            );
        }

        public async Task<IEnumerable<DocumentDto>> GetInternalRepositoryDocumentsAsync()
        {
            var isSqlite = _context.Database.IsSqlite();

            var query = _context.Documents
                .Where(d => d.ModuleId == null);

            query = isSqlite
                ? query.OrderByDescending(d => d.Id)
                : query.OrderByDescending(d => d.UploadedAt);

            return await query
                .ProjectTo<DocumentDto>(_mapper.ConfigurationProvider)
                .ToListAsync();
        }

        public async Task<bool> DeleteDocumentAsync(int documentId, string requesterUserName, bool isAdminOrCoordinator)
        {
            var document = await _context.Documents.FindAsync(documentId);
            if (document == null) return false;

            // ⛔ Uploader-only rule: ignore any admin/coordinator overrides
            if (!string.Equals(document.UploadedByUserName, requesterUserName, StringComparison.Ordinal))
                return false;

            _context.Documents.Remove(document);
            return await _context.SaveChangesAsync() > 0;
        }
    }
}
