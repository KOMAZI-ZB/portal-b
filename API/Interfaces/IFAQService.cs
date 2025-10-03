using API.DTOs;
using API.Helpers;

namespace API.Interfaces
{
    public interface IFAQService
    {
        Task<PagedList<FaqEntryDto>> GetAllPaginatedFAQsAsync(QueryParams queryParams);
        Task<IEnumerable<FaqEntryDto>> GetAllFAQsAsync();
        Task<bool> CreateFaqAsync(string question, string answer);
        Task<bool> UpdateFaqAsync(int id, string question, string answer);
        Task<bool> DeleteFaqAsync(int id);
    }
}
