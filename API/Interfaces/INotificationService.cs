using API.DTOs;
using API.Helpers;

namespace API.Interfaces
{
    public interface INotificationService
    {
        Task<PagedList<NotificationDto>> GetAllPaginatedAsync(QueryParams queryParams);
        Task<NotificationDto?> CreateAsync(CreateNotificationDto dto, string createdByUserName);
        Task<bool> DeleteAsync(int id, string requesterUserName, bool isAdmin);

        Task<bool> MarkAsReadAsync(int notificationId, int userId);
        Task<bool> UnmarkAsReadAsync(int notificationId, int userId); // 🆕
    }
}
