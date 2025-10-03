using API.DTOs;
using API.Entities;
using API.Helpers;
using Microsoft.AspNetCore.Http;

namespace API.Interfaces
{
    public interface IRepositoryService
    {
        // External Repositories (e.g., JoVE, Scopus)
        Task<IEnumerable<Repository>> GetAllAsync();  // optional legacy
        Task<PagedList<RepositoryDto>> GetPaginatedExternalAsync(QueryParams queryParams);
        Task<RepositoryDto> AddAsync(RepositoryDto dto);
        Task<bool> DeleteAsync(int id);
        Task<string> UploadImageAsync(IFormFile file); //   For uploading image to Cloudinary

        // Internal Repository Documents (stored under "Repository" source)
        Task<PagedList<DocumentDto>> GetPaginatedInternalDocsAsync(QueryParams queryParams);
    }
}
