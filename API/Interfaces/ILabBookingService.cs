using System;
using API.DTOs;

namespace API.Interfaces;

public interface ILabBookingService
{
    Task<IEnumerable<LabBookingDto>> GetAllBookingsAsync();
    Task<IEnumerable<LabBookingDto>> GetBookingsByUserAsync(string userName);
    Task<bool> CreateBookingAsync(string userName, CreateLabBookingDto dto);
    Task<bool> DeleteBookingAsync(int id, string userName, bool isAllowed);
}